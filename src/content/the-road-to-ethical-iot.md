+++
author = "lf"
date = 2018-11-08T13:55:26Z
description = ""
draft = true
path = "/blog/the-road-to-ethical-iot"
title = "The Road to Ethical IoT"

+++

I very much subscribe to Stallman's ideas that the Internet of Stings is an oppression system, but there are also obvious benefits to having more things available to computers to automate. 

The schism that currently exists between those two parties is largely because many IoT devices are fiercely proprietary devices that don't belong to the user, horrifying free software advocates. To make it worse, even those who find the lack of ownership acceptable detest the massive numbers of security issues in these systems caused by their code being quickly and poorly written, with development credentials or backdoors left intact at release. 

Something must be done. An ethical IoT device must respect the user, first and foremost. Custom firmware should be allowed and encouraged, though perhaps after flipping a switch on the physical device to ensure malware doesn't take advantage of it. Network communication must be done through an audited outer layer which throws out any packets which are invalid and encrypted with the wrong key. An example of such a layer is WireGuard.

