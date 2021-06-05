+++
date = "2021-06-01"
draft = false
path = "/blog/systemd-monitoring-dbus"
tags = ["linux", "systemd"]
title = "Monitoring D-Bus calls from systemd-run"
+++

Recently, I was [working][cargo-play] on a tool that incidentally makes
ephemeral units on the systemd user instance to do what one would use `atd` for
on an older system. As part of working on that, I needed to figure out what RPC
calls I had to do to add the unit. Attempts to use `dbus-monitor` or `busctl
monitor` on the session bus failed to find any traffic.

I investigated this by `strace`ing the execution to find it was using some socket
`/run/user/1000/systemd/private`. From some helpful folks on irc in `#systemd`,
I found out that this is some kind of socket using the D-Bus serialization
stuff but is *not* a bus, and thus can't be intercepted (I tried).

The solution to this was to use `--machine @.host`, which will cause
`systemd-run` to communicate on the session/system D-Bus instances as it is
going through the code path to connect to a container but connecting to the
host. Thus I got my traffic and could do the same calls myself.

[cargo-play]: https://github.com/lf-/dotfiles/tree/main/pwaygwoumd

