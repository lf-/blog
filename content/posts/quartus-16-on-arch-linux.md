+++
date = "2021-09-12"
draft = false
path = "/blog/quartus-16-on-arch-linux"
tags = ["fpga", "quartus", "linux", "archlinux"]
title = "Setting up Quartus 16+18 on Arch Linux"
+++

In this year's crop of classes, I am using some Fun™ software in obsolete
versions that would work properly if I would just use Windows like a reasonable
person. That was not an acceptable choice for me, so I got cracking on the
experience that is trying to get old proprietary software running on Linux.

This procedure was tested working on Quartus 16.1 and 18.1. It is entirely
unnecessary for Quartus 20.1, for instance.

Let `$QUARTUS_BASE` be the base directory of your Quartus install, for instance
`/opt/intelFPGA_lite/18.1`.

## Quartus

Quartus 16 and 18 have basically the same process to run on modern Linux. There
are a few points that need to be addressed to get this working:

For Quartus, I needed to install `libpng12` from the repos. It may use some
other libraries that may not be installed. You can see what's missing with the
following:

```
$ LD_LIBRARY_PATH=$QUARTUS_BASE/quartus/linux64 ldd $QUARTUS_BASE/quartus/linux64/quartus
```

# ModelSim

ModelSim (v10.5b) has more interesting problems! To begin the fun, it's 32 bit
software.

It will not run with a modern version of freetype2, and to further complicate
matters, modern versions of its dependent library, fontconfig, have ABI
compatibility issues if loaded with a sufficiently obsolescent version of
freetype2. Thus, we have to provide obsolescent versions of both that are built
against each other in 32 bit mode.

I have written a script that automatically builds such a pair, [available
here][boomer script]. Copy the `out` directory it produces to something like
`/opt/intelFPGA_lite/boomer-fontconfig`, such that
`/opt/intelFPGA_lite/boomer-fontconfig/lib` corresponds to `out/lib`, and so
on.

[boomer script]: https://gist.github.com/lf-/3e642f409e99dd7faa8ce353992e53f4

I needed to install the following multilib libraries from the repos:
`lib32-libx11 lib32-libxrender lib32-libxft lib32-fontconfig lib32-ncurses
lib32-libxext`.

In addition to the packages from the repos, `lib32-ncurses5-compat-libs` from
the AUR is required, providing `libncurses.so.5`.

ModelSim requires several hacks to its launcher script, most of which are
inspired by [this gist][gist] and [this PDF][document] originally. Open
`$QUARTUS_BASE/modelsim_ase/vco` in a text editor. (If this is not writable,
consider using `sudoedit`/`sudo -e`!)

On line 13, `mode=${MTI_VCO_MODE:-""}` should be changed to
`mode=${MTI_VCO_MODE:-"32"}`.

This script then does some extremely dubious Linux version detection that also
does not work as it tries to pointlessly load binaries from a directory that
does not exist. On line 210, in the `*` case, change `vco="linux_rh60"` to
`vco="linux"`.

Finally, at the bottom of the script, just before the `if` statement that
`exec`s into whatever program (this is line 323 for me), insert this:

```
export LD_LIBRARY_PATH=/opt/intelFPGA_lite/boomer-fontconfig/lib:$LD_LIBRARY_PATH
```

This will force ModelSim to load the obsolete versions of fontconfig and
freetype2 built earlier rather than the system versions.

## Final steps

Consider creating an environment script such as the following:


{% codesample(desc="`env.sh` sample") %}
```
base=/opt/intelFPGA_lite/18.1
export PS1="(quartus) ${PS1:-}"
export PATH=$PATH:$base/quartus/bin:$base/modelsim_ase/bin
```
{% end %}

Then, when you want to use the tools, do `. ./env.sh`. This avoids polluting
the global `PATH` and makes the tools only available when you need them.

[document]: https://mil.ufl.edu/3701/docs/quartus/linux/ModelSim_linux.pdf
[gist]: https://gist.github.com/PrieureDeSion/e2c0945cc78006b00d4206846bdb7657
