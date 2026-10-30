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
    [ValidateSet('Probe', 'Rename', 'FlushDirectory', 'CloneAcl')]
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

switch ($Operation) {
    'CloneAcl' {
        if ([string]::IsNullOrWhiteSpace($From) -or [string]::IsNullOrWhiteSpace($To)) {
            throw 'From and To are required for CloneAcl'
        }
        $sourcePath = [System.IO.Path]::GetFullPath($From)
        $destinationPath = [System.IO.Path]::GetFullPath($To)
        if (-not [System.IO.Directory]::Exists($sourcePath) -or
            -not [System.IO.Directory]::Exists($destinationPath)) {
            throw 'CloneAcl requires two existing directories'
        }
        $sourceProfile = Get-DkfStorageProfile $sourcePath
        $destinationProfile = Get-DkfStorageProfile $destinationPath
        if (-not $sourceProfile.supportedAutomaticRestore -or
            -not $destinationProfile.supportedAutomaticRestore -or
            $sourceProfile.volumeRoot -ne $destinationProfile.volumeRoot) {
            throw 'CloneAcl requires the same supported local fixed NTFS volume'
        }
        $reparse = [System.IO.FileAttributes]::ReparsePoint
        if (([System.IO.File]::GetAttributes($sourcePath) -band $reparse) -or
            ([System.IO.File]::GetAttributes($destinationPath) -band $reparse)) {
            throw 'CloneAcl refuses reparse-point directories'
        }
        $acl = [System.IO.Directory]::GetAccessControl($sourcePath)
        [System.IO.Directory]::SetAccessControl($destinationPath, $acl)
        $sections = [System.Security.AccessControl.AccessControlSections]::Access
        $expected = $acl.GetSecurityDescriptorSddlForm($sections)
        $actual = ([System.IO.Directory]::GetAccessControl($destinationPath)).GetSecurityDescriptorSddlForm($sections)
        if ($actual -cne $expected) {
            throw ("CloneAcl DACL verification failed; expected={0}; actual={1}" -f $expected, $actual)
        }
        [PSCustomObject]@{
            operation = 'CloneAcl'
            source = $sourcePath
            destination = $destinationPath
            daclVerified = $true
        } | ConvertTo-Json -Compress
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
