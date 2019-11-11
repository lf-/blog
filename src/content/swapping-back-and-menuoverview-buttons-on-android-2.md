+++
author = "lf"
categories = ["android", "cyanogenmod", "oneplus"]
date = 2016-03-04T05:08:07Z
description = ""
draft = false
path = "/blog/swapping-back-and-menuoverview-buttons-on-android-2"
tags = ["android", "cyanogenmod", "oneplus"]
title = "Swapping Back and Menu/Overview buttons on Android"

+++

I use a OnePlus One as my daily driver. Unfortunately, like nearly every phone on the market with capacitive buttons, they're *backwards*! I could enable software keys, but that's admitting defeat. CyanogenMod doesn't allow swapping the keys in the settings, because it would  result in some pretty horrible user experience.

None of this is relevant however, because this is *Android*, and I have root:

In `/system/usr/keylayout/Generic.kl`, you can see the key mapping for all keys on the system. Simply swap the stuff in the rightmost column: `BACK` and `MENU`.

MENU is at `key 139` and BACK is at `key 158`.

I use this on the latest Cyanogen OS based on Lollipop. It works perfectly. If you want to revert this, simply do the reverse of what's written.

A little note: my blog is just stuff I need to write down for easy reference later. It's on completely random themes, although centered around technology. I should probably make a wiki for this stuff.

