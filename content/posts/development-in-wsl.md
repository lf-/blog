+++
date = "2020-07-19"
draft = false
path = "/blog/development-in-wsl"
tags = []
title = "My software development setup in WSL 2"
+++

I'm writing this post because I work every day in WSL 2 on my main computer and
I feel it might be useful to those trying to get a productive setup running.

I use Arch Linux inside WSL, with the [ArchWSL
project](https://github.com/yuk7/ArchWSL). Arch is used since it's what I've
installed on my other computers, and is compelling for the same reasons: up to
date packages, reliable, and is easy to package things for.

## Shell/completion performance

Since I use a zsh shell with syntax highlighting and relatively slow command
completion, I found that the stock setup of putting the ~30 directories in my
Windows PATH into the Linux one was causing massive shell performance issues.
This is resolved with some `wsl.conf` options on the Linux side:

`/etc/wsl.conf`:

```
[interop]
enabled = true
appendWindowsPath = false

# It was also not picking up my DNS settings so have it stop trying to do that
[network]
generateResolvConf = false
```

## Terminal

Before switching to WSL for essentially all of my needs (except flashing my QMK
peripherals), I used msys2, which uses mintty as a terminal. WSL with mintty is
done through [wsltty](https://github.com/mintty/wsltty) these days, and that is
what I use.  It does not require significant configuration.

The new [Windows Terminal](https://github.com/microsoft/terminal) is likely
viable these days (and possibly faster in terms of rendering performance), but
I haven't investigated it.

## Daemons

I use nix for managing Haskell dependencies for a work project, and I sometimes
need to use Docker for development. Neither WSL nor WSL 2 natively support
running systemd as an init system. With WSL 2, process ID namespaces can be
used to make a namespace where systemd is PID 1 in which you can just run it. I
use a tool called [genie](https://github.com/arkane-systems/genie) that manages
this automatically.

## Clipboard integration

Download [`win32yank`](https://github.com/equalsraf/win32yank), make this file
and `chmod +x` it and neovim will pick it up as the clipboard provider:

`/usr/local/bin/win32yank.exe`:

```
#!/bin/sh

/mnt/c/Progs/win32yank.exe "$@"
```

This hack is required because of the PATH integration being disabled. I believe
you could also copy the executable into a bin folder (don't change the
extension) and it would work without the intermediate script.

## Memory

I limit the memory available to my WSL lower than the default 80% of my RAM
because I would rather stuff get killed on the Linux side or the Linux kernel
drop some of its cache rather than making Windows swap a whole bunch. Further,
I sometimes run `sudo sysctl vm.drop_caches=2` to drop Linux caches when
`vmmem` is causing memory pressure to the rest of my system.

`%USERPROFILE%\.wslconfig`:

```
[wsl2]
memory=20GB
swap=0
```

