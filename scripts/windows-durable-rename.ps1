# DKF v0.13 Windows State Engine durability helper.
#
# Narrow audited boundary for:
# - local storage-profile detection,
# - same-volume write-through directory rename,
# - write-capable parent-directory FlushFileBuffers barrier.
#
# This helper does NOT claim universal physical power-loss durability. Runtime
# recovery remains witness-based and fail-closed. Arguments are literal process
# arguments; this script never evaluates command text or interpolates a shell.
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Probe', 'Rename', 'FlushDirectory', 'CreateSecureStage', 'CopyAclTree')]
    [string]$Operation,

    [string]$Path,
    [string]$From,
    [string]$To
)

$ErrorActionPreference = 'Stop'

$source = @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Win32.SafeHandles;

public static class DkfWindowsDurability {
    public const uint MOVEFILE_WRITE_THROUGH = 0x00000008;
    public const uint GENERIC_WRITE = 0x40000000;
    public const uint FILE_SHARE_READ = 0x00000001;
    public const uint FILE_SHARE_WRITE = 0x00000002;
    public const uint FILE_SHARE_DELETE = 0x00000004;
    public const uint OPEN_EXISTING = 3;
    public const uint FILE_FLAG_WRITE_THROUGH = 0x80000000;
    public const uint FILE_FLAG_BACKUP_SEMANTICS = 0x02000000;
    public const uint DRIVE_FIXED = 3;

    [DllImport("kernel32.dll", EntryPoint = "MoveFileExW",
        CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool MoveFileEx(
        string existingName,
        string newName,
        uint flags);

    [DllImport("kernel32.dll", EntryPoint = "GetVolumePathNameW",
        CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetVolumePathName(
        string fileName,
        StringBuilder volumePathName,
        uint bufferLength);

    [DllImport("kernel32.dll", EntryPoint = "GetVolumeInformationW",
        CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetVolumeInformation(
        string rootPathName,
        StringBuilder volumeNameBuffer,
        uint volumeNameSize,
        out uint volumeSerialNumber,
        out uint maximumComponentLength,
        out uint fileSystemFlags,
        StringBuilder fileSystemNameBuffer,
        uint fileSystemNameSize);

    [DllImport("kernel32.dll", EntryPoint = "GetDriveTypeW",
        CharSet = CharSet.Unicode)]
    private static extern uint GetDriveType(string rootPathName);

    [DllImport("kernel32.dll", EntryPoint = "CreateFileW",
        CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern SafeFileHandle CreateFile(
        string fileName,
        uint desiredAccess,
        uint shareMode,
        IntPtr securityAttributes,
        uint creationDisposition,
        uint flagsAndAttributes,
        IntPtr templateFile);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool FlushFileBuffers(SafeFileHandle handle);

    private static Win32Exception LastError(string operation) {
        return new Win32Exception(Marshal.GetLastWin32Error(), operation);
    }

    public static string VolumeRoot(string path) {
        var buffer = new StringBuilder(32768);
        if (!GetVolumePathName(path, buffer, (uint)buffer.Capacity)) {
            throw LastError("GetVolumePathNameW failed");
        }
        return buffer.ToString();
    }

    public static string FileSystem(string root) {
        var volume = new StringBuilder(261);
        var fs = new StringBuilder(261);
        uint serial;
        uint maxComponent;
        uint flags;
        if (!GetVolumeInformation(
            root, volume, (uint)volume.Capacity,
            out serial, out maxComponent, out flags,
            fs, (uint)fs.Capacity)) {
            throw LastError("GetVolumeInformationW failed");
        }
        return fs.ToString();
    }

    public static uint DriveType(string root) {
        return GetDriveType(root);
    }

    public static void FlushDirectory(string directory) {
        const uint share = FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE;
        const uint flags = FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_WRITE_THROUGH;
        using (var handle = CreateFile(
            directory,
            GENERIC_WRITE,
            share,
            IntPtr.Zero,
            OPEN_EXISTING,
            flags,
            IntPtr.Zero)) {
            if (handle.IsInvalid) {
                throw LastError("CreateFileW directory durability handle failed");
            }
            if (!FlushFileBuffers(handle)) {
                throw LastError("FlushFileBuffers directory barrier failed");
            }
        }
    }

    public static void RenameWriteThrough(string from, string to) {
        if (!MoveFileEx(from, to, MOVEFILE_WRITE_THROUGH)) {
            throw LastError("MoveFileExW(MOVEFILE_WRITE_THROUGH) failed");
        }
    }
}
'@

Add-Type -TypeDefinition $source -ErrorAction Stop

function Get-DkfStorageProfile([string]$InputPath) {
    if ([string]::IsNullOrWhiteSpace($InputPath)) {
        throw 'Path is required'
    }
    $full = [System.IO.Path]::GetFullPath($InputPath)
    $root = [DkfWindowsDurability]::VolumeRoot($full)
    $fileSystem = [DkfWindowsDurability]::FileSystem($root)
    $driveType = [DkfWindowsDurability]::DriveType($root)
    [PSCustomObject]@{
        path = $full
        volumeRoot = $root
        fileSystem = $fileSystem
        driveType = [int]$driveType
        localFixed = ($driveType -eq [DkfWindowsDurability]::DRIVE_FIXED)
        supportedAutomaticRestore = (
            $driveType -eq [DkfWindowsDurability]::DRIVE_FIXED -and
            $fileSystem -eq 'NTFS'
        )
    }
}


# Create a protected staging root with its DACL supplied atomically at mkdir
# time. A sibling's inherited ACL must never expose copied project data.
function New-DkfSecureStage([string]$StagePath) {
    if ([string]::IsNullOrWhiteSpace($StagePath)) { throw 'Stage path is required' }
    $stage = [System.IO.Path]::GetFullPath($StagePath)
    $parent = [System.IO.Path]::GetDirectoryName($stage)
    if (-not [System.IO.Directory]::Exists($parent)) { throw 'Stage parent is missing' }
    $profile = Get-DkfStorageProfile $parent
    if (-not $profile.supportedAutomaticRestore) { throw 'Secure staging requires local fixed NTFS' }
    if ([System.IO.Directory]::Exists($stage) -or [System.IO.File]::Exists($stage)) {
        throw 'Secure stage already exists'
    }
    $acl = New-Object System.Security.AccessControl.DirectorySecurity
    $acl.SetAccessRuleProtection($true, $false)
    $sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
        $sid,
        [System.Security.AccessControl.FileSystemRights]::FullControl,
        ([System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor
         [System.Security.AccessControl.InheritanceFlags]::ObjectInherit),
        [System.Security.AccessControl.PropagationFlags]::None,
        [System.Security.AccessControl.AccessControlType]::Allow)
    $acl.AddAccessRule($rule)
    [System.IO.Directory]::CreateDirectory($stage, $acl) | Out-Null
    $actual = Get-Acl -LiteralPath $stage
    if (-not $actual.AreAccessRulesProtected) {
        throw 'Stage DACL was not protected at creation'
    }
    return $stage
}

# Post-order: descendants are copied while the staging root remains private.
# Copy exact source DACLs only after all copied bytes are present. Any failure
# prevents promotion and leaves the original untouched.
function Copy-DkfAclTree([string]$Source, [string]$Destination) {
    $src = Get-Item -LiteralPath $Source -Force -ErrorAction Stop
    $dst = Get-Item -LiteralPath $Destination -Force -ErrorAction Stop
    if (($src.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0 -or
        ($dst.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw 'Cannot preserve ACLs for a reparse point; refusing restore promotion'
    }
    if ($src.PSIsContainer -ne $dst.PSIsContainer) {
        throw 'Source and staged object kinds differ during ACL preservation'
    }
    if ($src.PSIsContainer) {
        foreach ($child in Get-ChildItem -LiteralPath $Source -Force -ErrorAction Stop) {
            Copy-DkfAclTree (Join-Path $Source $child.Name) (Join-Path $Destination $child.Name)
        }
    }
    $acl = Get-Acl -LiteralPath $Source -ErrorAction Stop
    Set-Acl -LiteralPath $Destination -AclObject $acl -ErrorAction Stop
    $sections = [System.Security.AccessControl.AccessControlSections]::Access
    $expected = $acl.GetSecurityDescriptorSddlForm($sections)
    $actual = (Get-Acl -LiteralPath $Destination -ErrorAction Stop).GetSecurityDescriptorSddlForm($sections)
    if ($expected -cne $actual) {
        throw 'Staged NTFS DACL does not match source after copy'
    }
}

switch ($Operation) {

    'CreateSecureStage' {
        $created = New-DkfSecureStage $Path
        [PSCustomObject]@{ operation = 'CreateSecureStage'; path = $created; protected = $true } |
            ConvertTo-Json -Compress
        break
    }

    'CopyAclTree' {
        if ([string]::IsNullOrWhiteSpace($From) -or [string]::IsNullOrWhiteSpace($To)) {
            throw 'Source and stage paths are required'
        }
        $sourcePath = [System.IO.Path]::GetFullPath($From)
        $destinationPath = [System.IO.Path]::GetFullPath($To)
        $sourceProfile = Get-DkfStorageProfile $sourcePath
        $destinationProfile = Get-DkfStorageProfile $destinationPath
        if (-not $sourceProfile.supportedAutomaticRestore -or
            -not $destinationProfile.supportedAutomaticRestore -or
            $sourceProfile.volumeRoot -ne $destinationProfile.volumeRoot) {
            throw 'NTFS ACL copy requires local fixed same-volume source and stage'
        }
        Copy-DkfAclTree $sourcePath $destinationPath
        [PSCustomObject]@{ operation = 'CopyAclTree'; source = $sourcePath;
            destination = $destinationPath; verified = $true } | ConvertTo-Json -Compress
        break
    }


    'Probe' {
        $profile = Get-DkfStorageProfile $Path
        $profile | ConvertTo-Json -Compress
        break
    }

    'FlushDirectory' {
        $profile = Get-DkfStorageProfile $Path
        if (-not $profile.supportedAutomaticRestore) {
            throw ("Unsupported automatic Windows durability profile: filesystem={0}, driveType={1}" -f
                $profile.fileSystem, $profile.driveType)
        }
        [DkfWindowsDurability]::FlushDirectory($profile.path)
        [PSCustomObject]@{
            operation = 'FlushDirectory'
            profile = $profile
            flushed = $true
        } | ConvertTo-Json -Compress -Depth 4
        break
    }

    'Rename' {
        if ([string]::IsNullOrWhiteSpace($From) -or [string]::IsNullOrWhiteSpace($To)) {
            throw 'From and To are required for Rename'
        }
        $sourcePath = [System.IO.Path]::GetFullPath($From)
        $destinationPath = [System.IO.Path]::GetFullPath($To)
        $destinationParent = [System.IO.Path]::GetDirectoryName($destinationPath)
        $sourceProfile = Get-DkfStorageProfile $sourcePath
        $destinationProfile = Get-DkfStorageProfile $destinationParent

        if (-not $sourceProfile.supportedAutomaticRestore -or
            -not $destinationProfile.supportedAutomaticRestore) {
            throw ("Unsupported automatic Windows durability profile: source={0}/{1}, destination={2}/{3}" -f
                $sourceProfile.fileSystem, $sourceProfile.driveType,
                $destinationProfile.fileSystem, $destinationProfile.driveType)
        }
        if ($sourceProfile.volumeRoot -ne $destinationProfile.volumeRoot) {
            throw 'Durable directory rename requires source and destination on the same volume'
        }
        if ([System.IO.Directory]::Exists($destinationPath) -or
            [System.IO.File]::Exists($destinationPath)) {
            throw 'Durable rename destination already exists'
        }

        [DkfWindowsDurability]::RenameWriteThrough($sourcePath, $destinationPath)
        [DkfWindowsDurability]::FlushDirectory($destinationParent)

        [PSCustomObject]@{
            operation = 'Rename'
            source = $sourcePath
            destination = $destinationPath
            profile = $destinationProfile
            renamed = $true
            parentFlushCompleted = $true
        } | ConvertTo-Json -Compress -Depth 4
        break
    }
}
