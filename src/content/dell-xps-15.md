+++
author = "lf"
categories = ["linux", "arch-linux", "hardware", "laptop", "dell-xps-15"]
date = 2018-03-18T07:12:05Z
description = ""
draft = false
path = "/blog/dell-xps-15"
tags = ["linux", "arch-linux", "hardware", "laptop", "dell-xps-15"]
title = "Dell XPS 15: \"I can't understand why some people _still_ think ACPI is a good idea..\" -Linus Torvalds"

+++

I got my new machine in the mail, an XPS 15 bought on one of the numerous sales which pretty much happen every couple of days, and while most of the hardware is amazing compared to my previous machine (a beat-up X220), there are some significant hardware issues that need to be worked around. Besides, of course, the fact that the keyboard and lack of trackpoint is objectively inferior to the previous machine.

The first thing that many people may do after booting up a new machine on any operating system is to make sure they got what they paid for, and check detected hardware. So, naturally, I run `lspci`... and it hangs. I could change virtual console, but it said something about a watchdog catching a stalled CPU core. Fun! Off to Google, which states that it's the NVidia driver, specifically related to Optimus (which, by the way, [this video](https://youtu.be/MShbP3OpASA?t=48m13s) remains an excellent description of). So I blacklist it, and lspci seems to work fine. Next, I install X and all the other applications I want to use, and being a sensible Arch user, I read the Arch wiki on the hardware, which states that the dedicated graphics card will use a lot of power if it isn't turned off.

So, I turn it off. For this, I use `acpi_call` with a `systemd-tmpfiles` rule to turn it off at boot. The setup is as follows:

```
~ » cat /etc/tmpfiles.d/acpi_call.conf
w /proc/acpi/call - - - - \\_SB.PCI0.PEG0.PEGP._OFF
~ » cat /etc/modules-load.d/acpi_call.conf
acpi_call
```

Next, I get to work doing some programming on it. It was a massive improvement on the previous hardware on account of having a 1080p screen instead of a 1366x768 device-usability-eliminator. However, my terminal-based vim sessions kept getting disturbed by messages such as the following:

```
kernel: pcieport 0000:00:1c.0: PCIe Bus Error: severity=Corrected, type=Data Link Layer, id=00e0(Transmitter ID)
kernel: pcieport 0000:00:1c.0:   device [8086:a110] error status/mask=00001000/00002000
```

After looking in the wiki again, I set `pci=nommconf` in the kernel options. At this point I was entirely unconvinced that the `acpi_rev_override=1` stuff was necessary since I got rid of any NVidia software that could possibly break my machine.

Satisfied with my handiwork, I put the machine into service, and took it to school. Naturally, one may want to put a machine into sleep mode if it is not in use. Unfortunately, doing so was causing it to lock up upon any attempt at waking it. Another strange behaviour that I had been starting to notice at this point was that Xorg could not be started more than once a boot due to the same hard lock issue.

As it turns out, this was again the same issue as the sleep, which is fixed by the `acpi_rev_override=1` in the kernel parameters. I had been dissuaded by the Arch developers disabling `CONFIG_ACPI_REV_OVERRIDE_POSSIBLE` at some point in the past, which was what was suggested by an outdated forum post (lesson learned: do more research on things which could easily change), but they reenabled it recently.

So, finally, the situation:

- Power management appears to work correctly
- Battery life is incredible (but could probably be hugely improved to "ridiculous")
- The touchpad is a touchpad, which means it sucks, although it is one of the better ones
- There is a significant and very annoying key-repeatt isssuee which happens on occasion, some users have reported it also occurs on Windows. It has happened at least 5 times while writing this post.
- I hadn't noticed this earlier, but the *keyboard has a tendency to scratch the screen* while the laptop is closed. Since this is a thoroughly modern machine, there isn't really space to just shove a microfiber cloth between the screen and keyboard like I had done with my X220 with missing rubber standoffs.

### Would I recommend buying one?

**Maybe**. For my use case, it made sense since I want to have a dedicated GPU which can be used in Windows for CAD work. The hardware with the exception of the keyboard and trackpad is very nice, especially for the price (a bit more than half what Apple charges for a similarly specced MacBook Pro 15"). If you don't need or want a dedicated GPU, ***buy another machine***. NVidia still has awful Linux problems.

Which machine? Probably a ThinkPad since they have very good Linux support right out of the box. That being said, I acknowledge that Dell has a group dedicated to Linux support on their hardware, and both companies have similar complete lacks of desire to lift a finger with regards to pressuring their fingerprint reader vendor (the same one for both companies!) to release the driver spec.

Since Linus Torvalds provides such excellent material to quote,

<pre><code>The thing is, you have two choices:
 - define interfaces in hardware
 - not doing so, and then trying to paper it over with idiotic tables.

Sadly, Intel decided that they should do the latter, and invented ACPI.

There are two kinds of interfaces: the simple ones, and the broken ones.

<...>

The broken ones are the ones where hardware people know what they want to
do, but they think the interface is sucky and complicated, so they make it
_doubly_ sucky by then saying "we'll describe it in the BIOS tables", so
that now there is another (incompetent) group that can _also_ screw things
up. Yeehaa!
</pre></code>

