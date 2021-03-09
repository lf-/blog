+++
author = "lf"
categories = ["windows", "PowerShell", "win32"]
date = 2016-11-29T04:20:46Z
description = ""
draft = false
path = "/blog/launching-powershell-using-the-win32-api"
tags = ["windows", "PowerShell", "win32"]
title = "Launching PowerShell using the Win32 API"

+++

I was working on a personal project in C on Windows when I stumbled upon a really strange roadblock: a PowerShell instance would not actually run the script given to it when started via Windows API but it would when launched manually from a `cmd.exe`. 

Eventually the realisation came to me: PowerShell doesn't like the `DETACHED_PROCESS` option for `CreateProcess()`. I have no idea what it was doing with it there, but it didn't involve actually working.

I changed it to `CREATE_NO_WINDOW` and all is fine in the world.

