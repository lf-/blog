+++
author = "lf"
categories = ["PowerShell", "windows"]
date = 2019-07-06T07:46:02Z
description = ""
draft = false
isPage = false
path = "/blog/auditing-world-writable-high-privilege-executables"
tags = ["PowerShell", "windows"]
title = "Auditing world-writable high-privilege executables on Windows"

+++

I was reading [Matt Nelson's post on a permissions issue causing privilege escalation](https://posts.specterops.io/cve-2019-13142-razer-surround-1-1-63-0-eop-f18c52b8be0c) and thought "I have too much software installed, I wonder if any of it is vulnerable". So on to PowerShell! I developed all of this by interactive exploration using `Get-Member`, `Format-List *`, and `Get-Command`.

At the end of this exploration, I did indeed find a vulnerable service, _however,_ it was because the application was installed in a world-writable parent directory due to my own carelessness (a situation I fixed). This finding leaves the open question of whether it is the job of the service's installer to set secure permissions on its install directory or just follow the permissions of the parent directory.

```powershell
PS> # First, let's define a function to find if a given path is interesting
PS> function Get-InterestingAccess($path) {
>> get-acl $path | %{$_.access} | ? {$_.filesystemrights.hasflag([System.Security.AccessControl.FileSystemRights]::Modify)} | ? {-not ($_.identityreference -in @('NT AUTHORITY\SYSTEM', 'BUILTIN\Administrators', 'NT SERVICE\TrustedInstaller'))}
>> }
PS> # stolen shamelessly from StackOverflow (it is ridiculous that you need P/Invoke for this)
PS> $src = @"
using System;
using System.Runtime.InteropServices;
public class ParseCmdline{
[DllImport("shell32.dll", SetLastError = true)]
static extern IntPtr CommandLineToArgvW([MarshalAs(UnmanagedType.LPWStr)] string lpCmdLine, out int pNumArgs);

public static string[] CommandLineToArgs(string commandLine)
{
    int argc;
    var argv = CommandLineToArgvW(commandLine, out argc);
    if (argv == IntPtr.Zero)
        throw new System.ComponentModel.Win32Exception();
    try
    {
        var args = new string[argc];
        for (var i = 0; i < args.Length; i++)
        {
            var p = Marshal.ReadIntPtr(argv, i * IntPtr.Size);
            args[i] = Marshal.PtrToStringUni(p);
        }

        return args;
    }
    finally
    {
        Marshal.FreeHGlobal(argv);
    }
}}
"@
PS> add-type -TypeDefinition $src
PS> # let's look for services with vulnerabilities. First find all service executables:
PS> $targets = gcim win32_service | %{[ParseCmdline]::CommandLineToArgs($_.pathname)[0]}
PS> $targets | where { Get-InterestingAccess -path $_ }
# redacted
PS> # also try:
PS> $targets = Get-ScheduledTask | %{ [System.Environment]::ExpandEnvironmentVariables($_.actions.execute) } | ? {$_}
```



