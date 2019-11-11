+++
author = "lf"
categories = ["homelab", "linux", "raspberry-pi", "udev"]
date = 2016-07-09T17:10:05Z
description = ""
draft = false
path = "/blog/my-network-ups-tools-dont-work"
tags = ["homelab", "linux", "raspberry-pi", "udev"]
title = "NUT not finding my UPS + fix"

+++

I use a CyberPower CP1500AVRLCD as a UPS in my lab. I'm just now getting more stuff running on it to the point that I want automatic shutdown (because it won't run for long with the higher power usage of more equipment). So, I plugged it into the pi that was running as a cups-cloud-print server and sitting on a shelf with my network equipment. The problem was that the driver for it in NUT didn't want to load. As is frighteningly common, it's a permissions problem:

Here's the log showing the issue:

    Jul 09 16:49:58 print_demon upsdrvctl[8816]: USB communication driver 0.33
    Jul 09 16:49:58 print_demon upsdrvctl[8816]: No matching HID UPS found
    Jul 09 16:49:58 print_demon upsdrvctl[8816]: Driver failed to start (exit status=1)

Here's the udev rule that fixes it:

    ACTION=="ADD",SUBSYSTEM=="usb",ATTR{idProduct}=="0501",ATTR{idVendor}=="0764",MODE="0660",GROUP="nut"

What this does is, when udev gets an event of the device with USB product id 0501 and vendor id 0764 being added to the system, it changes the permissions on the device files (think /dev/bus/usb/001/004 and /devices/platform/soc/20980000.usb/usb1/1-1/1-1.3) to allow group `nut` to read and write to it, allowing comms between the NUT driver and the device.

