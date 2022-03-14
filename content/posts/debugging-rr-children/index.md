+++
date = "2022-02-24"
draft = false
path = "/blog/debugging-rr-children"
tags = []
title = "Debugging: using rr to deal with unruly children (processes)"
+++

I have done multiple rounds of debugging blobs of processes that start together
and then something bad happens in one of the children several forks down.
Although gdb claims to support child processes with `set follow-fork-mode`
([docs][gdb-follow-fork-mode]), in practice, this is extremely painful since
you may have to set it to multiple different things in one reproduction.

To deal with these, I've done such hacks as writing wrapper scripts for the
executable at fault that run it in a gdbserver. However, by far the worst one
I've done is printing out the PID of the misbehaving process then waiting, to
give me time to attach the debugger ([this is even suggested in the gdb
documentation][gdb-sleep]).

[gdb-follow-fork-mode]: https://docs.jade.fyi/gnu/gdb/gdb.html#index-set-follow_002dfork_002dmode
[gdb-sleep]: https://docs.jade.fyi/gnu/gdb/gdb.html#Forks

## Using rr to do it the easy way

For this demo, I am using two programs I wrote:

- `crasher` just prints out that it's about to crash, then aborts.
- `caller` forks and executes `crasher`, then prints its return value once it
   exits.

These are written in C but their source is not super interesting. Nevertheless,
you can find their source code [at the bottom of the post](#source).

Here they are in action:

```
» ./caller
[caller] spawned pid 158938
[crasher] about to crash
[caller] waitpid: 158938, exited? 0 status 0, signaled? 1 signal 6
```

Signal 6, if you consult the table in `man 'signal(7)'`, is `SIGABRT` as
expected.

We want to figure out why the crasher is crashing. It's possible to do with
gdb, but that's unnecessarily hard because of gdb, even moreso if it forks
multiple times.

Let's use `rr` to do this more easily. First, record a run:

```
» rr record ./caller
rr: Saving execution to trace directory `/home/lf/.local/share/rr/caller-0'.
[caller] spawned pid 159146
[crasher] about to crash
[caller] waitpid: 159146, exited? 0 status 0, signaled? 1 signal 6
```

Then find the process ID of the crashing process:

```
» rr ps
PID     PPID    EXIT    CMD
159145  --      0       ./caller
159146  159145  -6      ./crasher
```

Next, use either `--onfork=<PID>` or `--onprocess=<PID>` to get a debugger on
the problem process:

```


## Demo source {#source}

{{ codefile(path="caller.c", code_lang="c", colocated=true, hide=true) }}
{{ codefile(path="crasher.c", code_lang="c", colocated=true, hide=true) }}
{{ codefile(path="Makefile", code_lang="make", colocated=true, hide=true) }}
