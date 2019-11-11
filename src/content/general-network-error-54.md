+++
author = "lf"
categories = ["PowerShell", "Windows Server", "Active Directory"]
date = 2015-05-23T21:48:15Z
description = ""
draft = false
path = "/blog/general-network-error-54"
tags = ["PowerShell", "Windows Server", "Active Directory"]
title = "General Network Error when running Install-ADDSForest"

+++

When I was messing about with AD DS a bit on Windows Server 2016 TP 2, I encountered the error General Network Error, with error ID 54. This is obviously a very unhelpful error. In troubleshooting, I noticed that the VM was being assigned an address in `169.254.x.x`. This wasn't part of my intended IP range, so I started investigating.

It turns out that `169.254.x.x` is a reserved range for APIPA (Automatic Private IP Addressing), where an operating system automatically assigns an IP when there is no DHCP available (which there wasn't because I intended to set up Windows DHCP). After disabling this, the AD setup worked correctly.

You may be wondering how to disable this problematic system. Here's how you do it (in PowerShell):

```powershell
# Disable DHCP
Get-NetAdapter | Set-NetIPInterface -Dhcp Disabled
# Disable APIPA
Set-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters' -Name IPAutoconfigurationEnabled -Value 0 -Type DWord
# Reboot to apply
Restart-Computer
```

