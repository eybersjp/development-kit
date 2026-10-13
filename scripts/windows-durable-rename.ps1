# Windows offline recovery helper. Uses the native directory-move API with
# MOVEFILE_WRITE_THROUGH; Node.js fs.renameSync exposes no equivalent flag.
# Accept only literal path arguments from the trusted DKF recovery runtime.
param(
    [Parameter(Mandatory = $true)][string]$From,
    [Parameter(Mandatory = $true)][string]$To
)

$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($From) -or [string]::IsNullOrWhiteSpace($To)) {
    throw 'Both directory paths are required'
}
# The native API checks that the source exists and the destination does not.
# Avoid .NET file-path normalization of extended-length (\\?\) Win32 paths.

$source = @'
using System;
using System.Runtime.InteropServices;
public static class DkfWindowsDurableRename {
    [DllImport("kernel32.dll", EntryPoint = "MoveFileExW", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool MoveFileEx(string source, string destination, uint flags);
}
'@
Add-Type -TypeDefinition $source -ErrorAction Stop
$MOVEFILE_WRITE_THROUGH = [uint32]8
if (-not [DkfWindowsDurableRename]::MoveFileEx($From, $To, $MOVEFILE_WRITE_THROUGH)) {
    $win32Error = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
    throw ([System.ComponentModel.Win32Exception]::new($win32Error))
}
