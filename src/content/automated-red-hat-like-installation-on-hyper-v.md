+++
author = "lf"
date = 2018-01-24T23:25:59Z
description = ""
draft = true
path = "/blog/automated-red-hat-like-installation-on-hyper-v"
title = "Automated Red Hat-like installation on Hyper-V"

+++

I have strange requirements sometimes. In this case, I had noticed that I can deploy machines with Kickstart, nearly zero-touch, but then as soon as they're installed, I have to go and log in locally to set a hostname, which is even more disruptive when they already put out a DNS registration with the wrong name.

Clearly this was a place for automation, so I set out to find a solution to read VM names from within the guest. In this vein, I found some information about reading these values from within Windows, and eventually found some technical documentation about `hypervkvpd`, which I used to develop a Python script. There were still significant issues integrating it into the kickstart to make an actual process but it was a step in the correct direction.

