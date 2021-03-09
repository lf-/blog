+++
author = "lf"
categories = ["windows", "small-fixes"]
date = 2016-06-28T21:38:26Z
description = ""
draft = false
path = "/blog/windows-folder-extremely-slow-to-load"
tags = ["windows", "small-fixes"]
title = "Windows folder extremely slow to load"

+++

Due to some weirdness and presumably thumbnail rendering, if a folder is set to "Optimize for Pictures", it takes 10+ times as long as it should to load. This was happening for my Downloads folder. It seems to only apply when it's accessed through "This PC".

Anyway, to fix it, in the properties of the folder in question, under "Customize", change "Optimize this folder for:" to "General Items" and it will work much better.

{{ image(name="slowfolder.png" alt="screenshot of the customize folder dialog demonstrating the change") }}

