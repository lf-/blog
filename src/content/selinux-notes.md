+++
author = "lf"
categories = ["linux", "selinux"]
date = 2017-07-28T00:59:52Z
description = ""
draft = false
path = "/blog/selinux-notes"
tags = ["linux", "selinux"]
title = "SELinux notes"

+++

`ausearch -m avc` to find denials. If there are none, that's probably because some distro maintainer decided that the denial should be silent:

`semodule -DB` turns on `dontaudit` events, `semodule -B` turns them back off.

When trying to get things to work correctly with `audit2allow`, skip the 15 minutes of doing things over and over triggering different denials and running `audit2allow -M mymodule < fails; semodule -i mymodule.pp` by just doing a quick `setenforce 0` before doing it once. All of the actions (AVCs?) in creating a file will show up in the log in one shot. Obviously turn on enforcing mode afterwards.

When in doubt, consult the [colouring book](https://people.redhat.com/duffy/selinux/selinux-coloring-book_A4-Stapled.pdf). Yes, that's real.

