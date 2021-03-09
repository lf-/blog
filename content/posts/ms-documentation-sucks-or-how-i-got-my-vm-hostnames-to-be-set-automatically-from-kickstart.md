+++
author = "lf"
categories = ["hyper-v", "linux"]
date = 2016-12-18T04:46:03Z
description = ""
draft = false
path = "/blog/ms-documentation-sucks-or-how-i-got-my-vm-hostnames-to-be-set-automatically-from-kickstart"
tags = ["hyper-v", "linux"]
title = "MS Documentation sucks (or how I got my VM hostnames to be set automatically from kickstart)"

+++

I wanted to automate my linux VM deployment on my Hyper-V based lab infrastructure. One small flaw: while DHCP does automatically update DNS, it does *not* do too much when your VM is named "localhost". I wanted to make the fedora deployment completely automated... which it is after I wrote a kickstart, except you can't get into the new box because you can't find its IP address.

I wrote a small tool to deal with this issue:  
https://github.com/lf-/kvputil

You want the variable `VirtualMachineName` in `/var/lib/hyperv/.kvp_pool_3`.

Documentation that took way too long to find:  
https://technet.microsoft.com/en-us/library/dn798287.aspx

