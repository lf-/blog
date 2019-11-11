+++
author = "lf"
date = 2019-02-15T04:45:44Z
description = ""
draft = true
path = "/blog/making-the-makerfarm-pegasus-usable"
title = "Making the MakerFarm Pegasus usable"

+++

I made the mistake of purchasing a MakerFarm Pegasus around August 2017. It was alluring: proper E3D extruder and hot end, more build volume and no wait time unlike the Prusa MK2S for about the same price. Unfortunately for that price you do not get as much printer by a large margin.

The primary issue with the machine in my experience is bed leveling. On newer models of the Pegasus, the bed is no longer supported on springs so the only method of leveling is manual mesh leveling, which has a very poor user experience on Marlin. I chose to use an optical bed probe, but it appears to vary in Z offset based mainly on the phase of the moon, so it needs to be babystepped at the start of every print, which is quite annoying.

I have developed a series of printed upgrades to make the machine either work better or work properly.

