+++
author = "lf"
date = 2019-08-25T04:49:46Z
description = ""
draft = true
path = "/blog/make-windows-10-mobile-hotspot-feature-stay-on-properly"
title = "Make Windows 10 \"Mobile Hotspot\" feature stay on properly"

+++

I am currently living somewhere where there is only wired access available and I would rather just use my computer as a router. One small problem: Windows seems to turn off the hotspot on random intervals, even if it is set not to turn off when not in use to "save power". The following registry key manipulation appears to fix it:

`Set-ItemProperty HKLM:\Software\Microsoft\Windows\CurrentVersion\SharedAccess -Name EnableRebootPersistConnection -Value 1`

[https://support.microsoft.com/en-ca/help/4055559/ics-doesn-t-work-after-computer-or-service-restart-on-windows-10](https://support.microsoft.com/en-ca/help/4055559/ics-doesn-t-work-after-computer-or-service-restart-on-windows-10)

