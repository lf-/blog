+++
author = "lf"
categories = ["3dprinting", "meshmixer"]
date = 2018-02-19T22:44:34Z
description = ""
draft = false
path = "/blog/make-meshmixer-display-things-usably"
tags = ["3dprinting", "meshmixer"]
title = "Meshmixer: Turn Off Smooth Display"

+++

The default display in Meshmixer is not ideal for working with technical models.

The setting responsible for this silliness is called "Mesh Normal Mode", which is unclear to most people who are not professional graphics programmers. Set that to "Face Normals" and it will display without making the model look like an amorphous blob. Alternately, hold spacebar and select the sphere that has vertices as in the picture below.

### Setting in the "Hotbox"

{% image(name="meshmixer-setting-fix.png") %}
Screenshot of the "hotbox" that appears when you hold space in meshmixer. There is a sphere with visible vertices highlighted, in the "Mesh" section under a subheading labeled "normals".
{% end %}

### Default

{% image(name="meshmixer-default.png") %}
A photo of some 3d model. There is strange visual artefacting around holes and edges are not crisp.
{% end %}

### Face Normals

{% image(name="meshmixer-fixed.png") %}
A photo of the same 3d model. All the edges are sharp.
{% end %}

