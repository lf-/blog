+++
author = "lf"
categories = ["homelab", "hyper-v", "lxd", "containers", "networking"]
date = 2016-06-24T22:55:33Z
description = ""
draft = false
path = "/blog/why-do-my-bridges-not-work-1-one"
tags = ["homelab", "hyper-v", "lxd", "containers", "networking"]
title = "Human error is the root of all problems, especially with network bridges"

+++

When in doubt, the problem is directly caused by one's own stupidity.

I was trying to run an LXD host in a Hyper-V VM and went to set up bridged networking (in this case, *notworking*). Twice. The good old rule that it's caused by my stupidity rang very true. The problem was caused by the network adapter in the VM not having the ability to change the MAC address of its packets. The toggle is in the VM properties under advanced settings in the child node on the NIC.

This is why you should have a routed network.

