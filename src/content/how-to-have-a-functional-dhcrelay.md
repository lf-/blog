+++
author = "lf"
categories = ["Windows Server", "dhcp", "linux", "homelab"]
date = 2016-03-05T05:20:54Z
description = ""
draft = false
path = "/blog/how-to-have-a-functional-dhcrelay"
tags = ["Windows Server", "dhcp", "linux", "homelab"]
title = "How to have a functional dhcrelay"

+++

I'm dumb. Or ignorant. Or inexperienced. I haven't decided which.

`dhcrelay` only gets proper responses if it's listening on both the interface that it's actually listening on for requests and the one where it will get the responses.

My command line for it to forward dhcp requests to my Windows dhcp server in my virtual lab is:

    /usr/bin/dhcrelay -4 -d -i eth1 -i eth2 10.x.x.x

`eth1` is the interface with the Windows dhcp server on its subnet

`eth2` is the interface with the clients on it

`10.x.x.x` is the address of the Windows dhcp server

This is run on my arch (yes, I know. Debian took longer than Windows to install. The only stuff on it is in `base`, `vim`, and `dhcp`) gateway VM. I could also stand up a Windows box and have it do NAT, but that doesn't use 512MB of RAM nearly as happily.

