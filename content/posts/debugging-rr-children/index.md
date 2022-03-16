+++
date = "2022-02-24"
draft = false
path = "/blog/debugging-rr-children"
tags = ["debugging", "rr"]
title = "Debugging: using rr to deal with unruly children (processes)"
+++

I have wasted a lot of time debugging multi-process systems, especially those
that are some native program with a shell startup script. Although gdb claims
to support child processes with `set follow-fork-mode`
([docs][gdb-follow-fork-mode]), in practice, this is extremely painful since
gdb needs to be told, at each fork, which way it should go.

To deal with these, I've done such hacks as writing wrapper scripts for the
executable at fault that run it in a gdbserver. Certainly, the worst such hack
I've done is printing out the PID of the misbehaving process then waiting, to
give me time to attach the debugger ([which is even a method suggested in the gdb
documentation][gdb-sleep]). Thankfully, there is a better way.

[gdb-follow-fork-mode]: https://docs.jade.fyi/gnu/gdb/gdb.html#index-set-follow_002dfork_002dmode
[gdb-sleep]: https://docs.jade.fyi/gnu/gdb/gdb.html#Forks

For this demo, I am using two programs I wrote:

- `crasher` prints out that it's about to crash, then aborts.
- `caller` forks and executes `crasher`, then prints its return value once it
   exits.

These are written in C, but they could equally be written in Rust or some other
native language. You can find their source code [at the bottom of the
post](#source).

Here they are in action:

```
» ./caller
[caller] spawned pid 158938
[crasher] about to crash
[caller] waitpid: 158938, exited? 0 status 0, signaled? 1 signal 6
```

Signal 6, after consulting the table in `man 'signal(7)'`, is `SIGABRT` as
expected.

We want to figure out where the crasher is crashing.

## Using rr to do it the easy way

For those unfamiliar, [`rr`](https://rr-project.org) is a time travel debugger
for Linux: it records a run of a program and then can deterministically replay
it (including in reverse!) as many times as you want. It's mostly replaced
running things directly in `gdb` for me.

Let's use it to find the fault in the child process. First, record a run:

```
» rr record ./caller
rr: Saving execution to trace directory `/home/jade/.local/share/rr/caller-0'.
[caller] spawned pid 1432674
[crasher] about to crash
[caller] waitpid: 1432674, exited? 0 status 0, signaled? 1 signal 6
```

Then find the process ID of the crashing process:

```
» rr ps
PID     PPID    EXIT    CMD
1432673 --      0       ./caller
1432674 1432673 -6      ./crasher
```

Next, use either `--onfork=<PID>` or `--onprocess=<PID>` to get a debugger on
the problem process. Since we believe it's failing after the process is both
`fork`'d and `exec`'d into the new program, `--onprocess` is appropriate.

```
» rr replay --onprocess=1432674
Reading symbols from /home/jade/.local/share/rr/caller-0/mmap_hardlink_37_crasher...
Remote debugging using 127.0.0.1:17412

--------------------------------------------------
 ---> Reached target process 1432674 at event 138.
--------------------------------------------------
Reading symbols from /lib64/ld-linux-x86-64.so.2...
(No debugging symbols found in /lib64/ld-linux-x86-64.so.2)
BFD: warning: system-supplied DSO at 0x6fffd000 has a section extending past end of file
0x00007f01f1ffb930 in _start () from /lib64/ld-linux-x86-64.so.2
=> 0x00007f01f1ffb930 <_start+0>:       48 89 e7        mov    %rsp,%rdi

(rr) continue
Continuing.
[caller] spawned pid 1432674
[crasher] about to crash

Program received signal SIGABRT, Aborted.
0x00007f01f1e0734c in __pthread_kill_implementation () from /usr/lib/libc.so.6
=> 0x00007f01f1e0734c <__pthread_kill_implementation+284>:      89 c5   mov    %eax,%ebp

(rr) backtrace
#0  0x00007f01f1e0734c in __pthread_kill_implementation () from /usr/lib/libc.so.6
#1  0x00007f01f1dba4b8 in raise () from /usr/lib/libc.so.6
#2  0x00007f01f1da4534 in abort () from /usr/lib/libc.so.6
#3  0x000055757da48161 in main () at crasher.c:6

(rr) frame 3
#3  0x000055757da48161 in main () at crasher.c:6
6           abort();

(rr) list
1       #include <stdio.h>
2       #include <stdlib.h>
3
4       int main(void) {
5           printf("[crasher] about to crash\n");
6           abort();
7       }

(rr)
```

Sidebar: the lack of spew on gdb startup is a gdb 11 feature! Put `set
startup-quietly on` into `~/.config/gdb/gdbearlyinit` to get that.

## Annotating output with event numbers

Another neat feature I found in `rr` is the ability to annotate output with the
PIDs and event numbers with `--mark-stdio`, which can be useful if you have a
program that is doing a bunch of things before the event of interest.

In this example, `--autopilot` makes it run without the debugger attached:

```
» rr replay --autopilot --mark-stdio
[rr 1432673 159][caller] spawned pid 1432674
[rr 1432674 271][crasher] about to crash
[rr 1432673 289][caller] waitpid: 1432674, exited? 0 status 0, signaled? 1 signal 6
```

Then I can dump myself into a debugger right at the print call that printed
"about to crash" like so:

```
» rr replay --onprocess=1432674 --goto 271
[caller] spawned pid 1432674
Reading symbols from /home/jade/.local/share/rr/caller-0/mmap_hardlink_37_crasher...
Remote debugging using 127.0.0.1:20652

--------------------------------------------------
 ---> Reached target process 1432674 at event 272.
--------------------------------------------------
Reading symbols from /usr/bin/../lib64/rr/librrpreload.so...
Reading symbols from /usr/lib/libc.so.6...
(No debugging symbols found in /usr/lib/libc.so.6)
Reading symbols from /lib64/ld-linux-x86-64.so.2...
(No debugging symbols found in /lib64/ld-linux-x86-64.so.2)
BFD: warning: system-supplied DSO at 0x6fffd000 has a section extending past end of file
0x0000000070000002 in syscall_traced ()
=> 0x0000000070000002:  c3      ret

(rr) bt
#0  0x0000000070000002 in syscall_traced ()
#1  0x00007f01f1fd0430 in _raw_syscall ()
    at /home/jade/builds/rr/src/rr-5.5.0/src/preload/raw_syscall.S:120
/* .... */
#13 0x00007f01f1dfe543 in __GI__IO_file_overflow () from /usr/lib/libc.so.6
#14 0x00007f01f1df36fa in puts () from /usr/lib/libc.so.6
#15 0x000055757da4815c in main () at crasher.c:5

(rr) frame 15
#15 0x000055757da4815c in main () at crasher.c:5
5           printf("[crasher] about to crash\n");

(rr) list
1       #include <stdio.h>
2       #include <stdlib.h>
3
4       int main(void) {
5           printf("[crasher] about to crash\n");
6           abort();
7       }
```

## Slightly less bad way with gdb

As of a release some time in the last decade, gdb supports [`set detach-on-fork
off`](detach-on-fork), which, as the docs say, keeps both parent and child as
debugees in gdb by pausing the one that's not actively being interacted with.
This is not significantly better than `follow-fork-mode`, since it instead
requires you to run each debugee to when it will wait next.

I tried it while writing this post and found I had to set an `exec`
[catchpoint](catchpoint) (with `catch exec`) then continue the parent process,
interrupt it when it is stuck in the wait call, switch threads to the other
debugee, then `continue` such that it hits the catchpoint.

I would love to hear about better ways to do this in gdb.

[detach-on-fork]: https://docs.jade.fyi/gnu/gdb/gdb.html#index-set-detach_002don_002dfork

## Demo source {#source}

{{ codefile(path="caller.c", code_lang="c", colocated=true, hide=true) }}
{{ codefile(path="crasher.c", code_lang="c", colocated=true, hide=true) }}
{{ codefile(path="Makefile", code_lang="make", colocated=true, hide=true) }}

