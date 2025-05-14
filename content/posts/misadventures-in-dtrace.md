+++
date = "2025-05-11"
draft = false
path = "/blog/misadventures-in-dtrace"
tags = ["macos", "apple", "dtrace", "nix"]
title = "Misadventures in DTrace: how to debug the macOS kernel"
+++

Recently I had a very hard problem on my hands: [Lix] on macOS wasn't terminating daemons when the client vanished (e.g. if the client got CTRL-C'd or crashed).
This is a rather .. weird symptom, since the mechanism for detecting that is very simple.
Immediately I suspected there was a kernel bug (or misused system call API) involved, since the fault only happens on macOS and the code was super simple.

I had a reproducer that worked about 80% of the time thanks to pennae (a blessing! having non-failure cases was super useful to diagnose the issue) and was pretty simple so as to not generate too many garbage system calls, and I just needed to figure out what the heck was going on.
Having the reproducer being inconsistent suggests a timing related behaviour, which wound up being the case.

The reproducer was:

```nix
builtins.derivation { system = "aarch64-darwin"; lol = "${./README.md}"; name = "foo8"; builder = "/bin/sh"; args = ["-c" "/bin/sleep 6d"]; }
```

Then it is just executed with `nix-build fail.nix`.
If it causes the problem, when you CTRL-C the reproducer, the Lix daemon attached to the `nix-build` process will linger and remain present in `pgrep -lf nix-daemon`.
I removed some pieces of the Lix daemon that were adding extra system call noise and then it was just a matter of figuring out what the kernel was doing.

The daemon not exiting is annoying since it won't interrupt any builds inside (wasting CPU) and won't release any locks on building store paths that it might be holding.

In the end, this *was* a kernel bug, which we worked around by changing the event notification API we were using to `kqueue` instead of `poll`, but figuring out what the bug was was necessary to get the confidence to know it's actually gone.
Figuring this out (and secondarily learning DTrace) was a saga, and that's what this blog post is about.

This fault was [tracked in Lix as lix#729](https://git.lix.systems/lix-project/lix/issues/729), became a problem somewhere between 2.92-dev and 2.93-dev and was fixed in Lix 2.93.0.

If you work for a certain company in Cupertino, the kernel bug described in this post is tracked as [FB17447257][fb-kernel].

[fb-kernel]: https://openradar.me/FB17447257
[fb-dtrace]: http://www.openradar.me/FB17257921

# Exposition

To understand how we got to this point, first one needs to understand the IO model of the Lix daemon and why the termination code even exists at all.

The Lix daemon forks one process per connection to it, like a traditional Unix daemon (e.g. old-school configurations of Apache2, inetd, etc).
This allows for multitidinous likely-regrettable design decisions to work fine: global variables have a single instance per client, etc, so there is less pressure to remove them.
It also produces generally pretty good client isolation performance-wise when there are relatively small numbers of clients.
Either way, the next part of this is that the daemon does *only* blocking IO on the client connection file descriptor (fd), so it only really knows about disconnects *at best* when it is actively calling IO system calls on the connection.

Thus, there was a [`MonitorFdHup`][MonitorFdHup] thread introduced whose sole purpose is to detect client disconnect and notify other threads of such a condition so that they exit at the next safe point, that is, when those threads call `checkInterrupt()` which will then throw an exception and take them down gracefully.
Internally there's also some usage of signals to knock the other threads out of any blocking system calls they're in.

This is the alternative approach to cancellation-based approaches, either in the modern async approach in Rust or other languages with e.g. [`tokio::select`] (cancellation is the source of many bugs), or with [`pthread_cancel`] in threaded approaches (*very* unsafe, injects a non-C++ exception that can nonetheless be caught by `catch (...)`).
All cancellation introduces surprise places in the code where its control is interrupted, so Lix's current approach is not strictly a better or worse approach; the `checkInterrupt` polling approach currently used by Lix (to be replaced with async cancellation) will cause slow termination bugs, while the cancellation approach will cause unexpected exit points and cancel-safety problems.

[Lix]: https://lix.systems
[MonitorFdHup]: https://git.lix.systems/lix-project/lix/src/69ba3c92db3ecca468bcd5ff7849fa8e8e0fc6c0/lix/libutil/monitor-fd.cc#L73-L134
[`tokio::select`]: https://docs.rs/tokio/latest/tokio/macro.select.html
[`pthread_cancel`]: https://man.freebsd.org/cgi/man.cgi?query=pthread_cancel&apropos=0&sektion=0&manpath=Debian+13.0+unstable&arch=default&format=html

Digression about the design of the whole thing aside, what `MonitorFdHup` does is call [`poll(2)`][poll] in a loop on the client connection file descriptor and if it finds the `POLLHUP` event set, it notifies the rest of the process by setting a flag.
This is, err, playing with fire on macOS, because their poll implementation is not very POSIX compliant: poll is supposed to return HUP events when there are no other events subscribed, and it does not do that.

[Quoth POSIX][posix poll]:

> In addition, poll() shall set the POLLHUP, POLLERR, and POLLNVAL flag in revents if the condition is true, even if the application did not set the corresponding bit in events.

Also quoth POSIX:

> POLLHUP
>
> The device has been disconnected. This event and POLLOUT are mutually-exclusive; a stream can never be writable if a hangup has occurred. However, this event and POLLIN, POLLRDNORM, POLLRDBAND, or POLLPRI are not mutually-exclusive. *This flag is only valid in the revents bitmask; it shall be ignored in the events member.*

Emphasis mine. Neither of these are true on macOS: XNU has different behaviour with `POLLHUP` in `events` than without, namely by not delivering any hangups when `POLLHUP` is not in `events`!
However, this isn't our bug, this is merely cause for being veeeeeery suspicious of their poll implementation's correctness given it violates the spec.

If anyone at Apple is reading this, the POSIX violation is ostensibly rdar://37537852 according to the last poor souls who debugged `MonitorFdHup` in CppNix derivatives several years ago.

[posix poll]: https://pubs.opengroup.org/onlinepubs/009696799/functions/poll.html
[poll]: https://man.freebsd.org/cgi/man.cgi?query=poll&apropos=0&sektion=0&manpath=Debian+13.0+unstable&arch=default&format=html

# DTrace

Okay so we probably have something misbehaving which is most easily diagnosed by a system call trace, since the actual code involved is trivial. Let's trace some system calls.
If this was Linux, you would use strace and go on with your day.

```
$ nix shell nixpkgs#strace
error: Package ‘strace-6.14’ in /nix/store/zffp7acfrlh6lz99jgilbb6gywcrjjyg-source/pkgs/by-name/st/strace/package.nix:53 is not available on the requested hostPlatform:
   hostPlatform.config = "arm64-apple-darwin"
```

Well, okay. No fun for us.

The favoured tool for system call tracing on macOS is [`dtruss(1)`][dtruss(1)], which is the old school Unix `truss(1)` but implemented on top of DTrace.

<aside>

DTrace is an advanced debugging tool supported on Illumos, FreeBSD, macOS, Windows, and (sort of, in a quite-different eBPF based version), Oracle Linux.
It originated in Solaris at Sun by several people including Adam Leventhal, Bryan Cantrill, and a few others, who now mostly work for [Oxide Computer], in order to be able to debug thorny problems on production systems.
This means that it has to not break production systems, it needs to have (nearly) no performance impact while not in use, and it needs to be *available* on the production systems without having to build new binaries.

One core value in DTrace is considering it very important to be able to figure out why stuff is broken in production, which is something I also care about a great deal as someone who is on-call for software I work on.

These are some underlying values in the tool that I share very much in my work on Lix and I *did* want to learn DTrace, but based on the thing I had to use it on, I think the monkey's paw may have curled a little bit.

</aside>

[Oxide Computer]: https://oxide.computer

If you actually have to *use* `dtruss` though, you are having a somewhat bad day, since it requires DTrace be available in its full form, which is not the case on the default configuration of macOS: System Integrity Protection (SIP) enabled:

[dtruss(1)]: https://man.freebsd.org/cgi/man.cgi?query=dtruss&apropos=0&sektion=0&manpath=macOS+15.4.1&arch=default&format=html
[dtrace(1)]: https://man.freebsd.org/cgi/man.cgi?query=dtrace&apropos=0&sektion=0&manpath=macOS+15.4.1&arch=default&format=html

```
$ sudo dtruss -a echo meow
dtrace: system integrity protection is on, some features will not be available

	PID/THRD  RELATIVE  ELAPSD    CPU SYSCALL(args) 		 = return
meow

CALL                                        COUNT
```

Disabling SIP is controversial in corporate settings since it degrades various macOS security features that make it a much more secure OS than Linux by default.
It also requires rebooting to change the state of SIP, which means that temporary changes are annoying.
My advice, and what I actually did, is to put macOS in a [UTM.app] VM with nothing of value in it, disable SIP in the VM, and do all further testing in there.

[UTM.app]: https://mac.getutm.app/

Once inside a VM with SIP disabled (or [with dtrace enabled as a fine-grained policy][fine-grained-sip]), DTrace works.
`dtruss` gives some output like the following:

[fine-grained-sip]: https://eclecticlight.co/2024/08/21/controlling-system-integrity-protection-using-csrutil-a-reference/

```
	PID/THRD  RELATIVE SYSCALL(args) 		 = return
16486/0x10ca0:      2865 write(0xB, "*\0", 0x1)		 = 1 0

              libsystem_kernel.dylib`write+0x8
              liblixutil.dylib`nix::MonitorFdHup::~MonitorFdHup()+0x40
              liblixstore.dylib`std::__1::unique_ptr<nix::MonitorFdHup, std::__1::default_delete<nix::MonitorFdHup>>::~unique_ptr[abi:v160006]()+0x20
              liblixstore.dylib`nix::daemon::processConnection(nix::AsyncIoRoot&, nix::ref<nix::Store>, nix::FdSource&, nix::FdSink&, nix::TrustedFlag, nix::daemon::RecursiveFlag)+0xa54
              nix`std::__1::__function::__func<nix::daemonLoopImpl(std::__1::optional<nix::TrustedFlag>)::$_0, std::__1::allocator<nix::daemonLoopImpl(std::__1::optional<nix::TrustedFlag>)::$_0>, void ()>::operator()()+0x2b0
              liblixutil.dylib`std::__1::__function::__func<nix::startProcess(std::__1::function<void ()>, nix::ProcessOptions const&)::$_0, std::__1::allocator<nix::startProcess(std::__1::function<void ()>, nix::ProcessOptions const&)::$_0>, void ()>::operator()()+0x48
              liblixutil.dylib`nix::startProcess(std::__1::function<void ()>, nix::ProcessOptions const&)+0x1c8
              nix`std::__1::__async_func<nix::daemonLoop(nix::AsyncIoRoot&, std::__1::optional<nix::TrustedFlag>)::$_0>::operator()()+0x9c8
              nix`std::__1::__async_assoc_state<void, std::__1::__async_func<nix::daemonLoop(nix::AsyncIoRoot&, std::__1::optional<nix::TrustedFlag>)::$_0>>::__execute()+0x2c
              nix`void* std::__1::__thread_proxy[abi:v160006]<std::__1::tuple<std::__1::unique_ptr<std::__1::__thread_struct, std::__1::default_delete<std::__1::__thread_struct>>, void (std::__1::__async_assoc_state<void, std::__1::__async_func<nix::daemonLoop(nix::AsyncIoRoot&, std::__1::optional<nix::TrustedFlag>)::$_0>>::*)(), std::__1::__async_assoc_state<void, std::__1::__async_func<nix::daemonLoop(nix::AsyncIoRoot&, std::__1::optional<nix::TrustedFlag>)::$_0>>*>>(void*)+0x70
              libsystem_pthread.dylib`_pthread_start+0x88
              libsystem_pthread.dylib`thread_start+0x8

16486/0x10ca2:        26 poll(0x16B8F6F08, 0x2, 0xFFFFFFFFFFFFFFFF)		 = 1 0

              libsystem_kernel.dylib`poll+0x8
              liblixutil.dylib`void* std::__1::__thread_proxy[abi:v160006]<std::__1::tuple<std::__1::unique_ptr<std::__1::__thread_struct, std::__1::default_delete<std::__1::__thread_struct>>, nix::MonitorFdHup::MonitorFdHup(int, std::__1::function<void ()>)::$_0>>(void*)+0x78
              libsystem_pthread.dylib`_pthread_start+0x88
              libsystem_pthread.dylib`thread_start+0x8
```

To a casual glance this might look useful, however, consider the following line:

```
16486/0x10ca2:        26 poll(0x16B8F6F08, 0x2, 0xFFFFFFFFFFFFFFFF)		 = 1 0
```

This is saying that `poll(2)` was called with `pollfds=(struct pollfd *)(void *)0x16B8F6F08`, `nfds=2` and `timeout=-1`.
That is, we're given a pointer which dtruss doesn't chase, so we have no idea what is actually being polled.
Cool beans!

One early hypothesis I had while debugging this was that the greater usage of kj, the capnproto async runtime, in Lix 2.93 was possibly related and maybe its use of `kqueue`, the *native* and better async IO primitive compared to `poll(2)`, was perhaps related to the problem.
I wanted to know what `kqueue` calls were being made and on which file descriptors they were being made.

Unfortunately it's the same deal as `poll(2)`, we get given a pointer, which doesn't do much good (side note, kevent has 6 args and dtruss only shows 3, which is sort of busted):

```
16454/0x10b8d:     24935 kevent(0x3, 0x16B63DD68, 0x1)		 = 0 0

              libsystem_kernel.dylib`kevent+0x8
              libkj-async.1.0.2.dylib`kj::setupAsyncIo()+0x3c
              nix`nix::AsyncIoRoot::AsyncIoRoot()+0x18
              nix`std::__1::__function::__func<main::$_0, std::__1::allocator<main::$_0>, void ()>::operator()()+0x2c
              liblixmain.dylib`nix::handleExceptions(std::__1::basic_string<char, std::__1::char_traits<char>, std::__1::allocator<char>> const&, std::__1::function<void ()>)+0x138
              nix`main+0x70
              dyld`start+0xb18
```

## dtruss is but a miserable pile of shell scripts

One might be led to believe that `dtruss` is a particularly advanced program.
This is quickly dispelled by [inspecting the source code][dtruss-source]: it's just a shell script generating a DTrace script.
This means we can write a better one for our specific use case.

In particular, we want to know what's behind the pointers given to `poll(2)` and `kevent(2)`, and we don't care much about other system calls.

[dtruss-source]: https://github.com/apple-oss-distributions/dtrace/blob/6a6c61d813c93d4a12a0e0cec4ae144c009bdaf1/DTTk/dtruss

The general way that DTrace works is that you can capture events and then run actions in the kernel once those events trigger.
This is implemented as a simple bytecode virtual machine in kernel space, sort of analogous to eBPF but with way smaller scope and with a lot more focus on never breaking the system.

One of the explicit design goals with DTrace is that you can't break the system you are inspecting with it: tracing expensive probes that stop the system making forward progress will kill your script, leaving the system unaffected.
Also, the bytecode interpreter *does not support backwards jumps*, a limitation which can be worked around, discussed in a bit.

Here's a snippet of DTrace code I used as part of my `kevent`/`poll` tracer:

```c
#!/usr/bin/env -S dtrace -C -s
#pragma D option quiet

#define TARGETED (pid == $target || self->child)

syscall::poll:entry
/TARGETED/
{
    printf("%5d/0x%x:  ",pid,tid);
    printf("poll(%p, %d)\n", arg0, arg1);
    self->remain_fds = arg1;
    self->pollfds = arg0;
}

syscall::poll:return
/TARGETED/
{
    // arg0 is the return value
    printf("%5d/0x%x:  poll => %d\n", pid, tid, arg0);
}
```

This shows the use of the C preprocessor (`-C` option to `dtrace(1)`), as well as `#pragma D option quiet` (disables printing the default hit-probe messages).

What is going on here is that, on entry to the `poll` syscall, the condition `/pid == $target || self->child/` is checked (conditions, like in `awk`, are in `/`s), then if it is true, the probe body in `{}` is executed.
The special variables `pid`, `tid`, and `argN` are used to get specific information; see [Special Variables](#special-variables) for more on those.

`self->pollfds` is implicitly definining a thread-local variable. By contrast `this->pollfds` would be a clause-local variable (and thus not useful for e.g. communicating information to a `return` probe from an `entry` probe since it's a different clause).
Brendan Gregg [has a post about variable types][dtrace-var-types].

[dtrace-var-types]: https://www.brendangregg.com/blog/2011-11-25/dtrace-variable-types.html

The probes being used here are using the `syscall` *provider*; the probe name syntax is `provider:module:function:name`.
In both the `syscall` and `fbt` (kernel function boundary tracing) providers, there are both `entry` and `return` probes for each function; `syscall` has probes for each system call.

`argN` represent the arguments to the probe site, which for syscall probes do have actual types (unlike in bpftrace):

```
$ sudo dtrace -l -v -n syscall::poll:entry
   ID   PROVIDER            MODULE                          FUNCTION NAME
  628    syscall                                                poll entry

	Probe Description Attributes
		Identifier Names: Private
		Data Semantics:   Private
		Dependency Class: ISA

	Argument Attributes
		Identifier Names: Private
		Data Semantics:   Private
		Dependency Class: ISA

	Argument Types
		args[0]: struct pollfd *
		args[1]: u_int
		args[2]: int
```

In syscall return probes, the probes receive the return value in `arg0` (and possibly a second return value in `arg1` only for `fork` or something?).
Either way you aren't getting the original args to the syscall in them, so you have to store those away somewhere if you need them.

```
$ sudo dtrace -l -v -n syscall::poll:return
   ID   PROVIDER            MODULE                          FUNCTION NAME
  629    syscall                                                poll return

	Probe Description Attributes
		Identifier Names: Private
		Data Semantics:   Private
		Dependency Class: ISA

	Argument Attributes
		Identifier Names: Private
		Data Semantics:   Private
		Dependency Class: ISA

	Argument Types
		args[0]: int
		args[1]: int
```

### Listing arrays in DTrace

I found a mailing list posting somewhere (and cannot find it again) about the workarounds to the "cannot have loops in DTrace" problem which suggested this trick.
I believe my thanks go to Adam Leventhal for the post.

What you can do about listing arrays, since loops don't exist and `if` statements don't exist, is to create more clauses on a given probe, with filters to determine where to stop printing:

```c
#define print_fds(NUM) \
    syscall::poll:entry, syscall::poll:return \
    /TARGETED && self->remain_fds > NUM/ \
    { \
        this->item = (struct pollfd *)copyin(self->pollfds + NUM * sizeof(struct pollfd), sizeof(struct pollfd)); \
        printf("\t {.fd = %d, .events = 0x%04x, .revents = 0x%04x}\n", this->item->fd, this->item->events, this->item->revents); \
    }

syscall::poll:entry
/TARGETED/
{
    printf("%5d/0x%x:  ",pid,tid);
    printf("poll(%p, %d)\n", arg0, arg1);
    self->remain_fds = arg1;
    self->pollfds = arg0;
}

syscall::poll:return
/TARGETED/
{
    printf("%5d/0x%x:  poll => %d\n", pid, tid, arg0);
}


print_fds(0)
print_fds(1)
print_fds(2)
```

This uses the C preprocessor to stamp out more instances to be able to print the list.

We use `copyin` to read from a pointer to user memory; since it's not kernel memory, we can't just `*` it; it needs to be copied into kernel space specifically.
One small thing to note with this is that `copyin` allocates a *clause*-local buffer, so any data you get in it needs to be used in that clause lest it vanish, thus the use of `this` since the data won't be valid after the clause.

### Putting it together: a script to trace kevent/poll usages

Some various pieces of this are taken from the `dtruss` source code.
`progenyof` seems to possibly be a macOS DTrace invention which is documented in the [`dtrace(1)`][dtrace(1)] man page.

<details>

<summary>kevent/poll tracer</summary>

```c
#!/usr/bin/env -S dtrace -C -s
#pragma D option quiet

#define TARGETED (pid == $target || self->child)

#if defined(STACKS)
#define DUMP_STACK ustack()
#else
#define DUMP_STACK
#endif

// From dtruss source code
/* MacOS X: notice first appearance of child from fork. Its parent
   fires syscall::*fork:return in the ususal way (see below) */
syscall:::entry
/progenyof($target) && self->child == 0/
{
    /* set as child */
    self->child = 1;

    /* print output */
    self->code = errno == 0 ? "" : "Err#";

    printf("fork to %d\t\t = %d %s%d\n", pid,
        0,self->code,(int)errno);
}

// From dtruss source code
/* syscall::rexit:entry */
syscall::exit:entry
/TARGETED/
{
    /* forget child */
    self->child = 0;
    printf("%5d/0x%x:  exit(%d)\n", pid, tid, arg0);
}

// From a userspace header
#pragma pack(4)

struct kevent {
    uintptr_t       ident;  /* identifier for this event */
    int16_t         filter; /* filter for event */
    uint16_t        flags;  /* general flags */
    uint32_t        fflags; /* filter-specific flags */
    intptr_t        data;   /* filter-specific data */
    void            *udata; /* opaque user data identifier */
};


#pragma pack()

#define print_fds(NUM) \
    syscall::poll:entry, syscall::poll:return \
    /TARGETED && self->remain_fds > NUM/ \
    { \
        this->item = (struct pollfd *)copyin(self->pollfds + NUM * sizeof(struct pollfd), sizeof(struct pollfd)); \
        printf("\t {.fd = %d, .events = 0x%04x, .revents = 0x%04x}\n", this->item->fd, this->item->events, this->item->revents); \
    }

syscall::poll:entry
/TARGETED/
{
    printf("%5d/0x%x:  ",pid,tid);
    printf("poll(%p, %d)\n", arg0, arg1);
    self->remain_fds = arg1;
    self->pollfds = arg0;
    DUMP_STACK;
}

syscall::poll:return
/TARGETED/
{
    // jfc arg0 is the return register... ABI abuse!
    printf("%5d/0x%x:  poll => %d\n", pid, tid, arg0);
}


print_fds(0)
print_fds(1)
print_fds(2)

syscall::kqueue:return
/TARGETED/
{
    printf("%5d/0x%x:  kqueue() => %d\n", pid, tid, arg0);
}

syscall::kevent:entry
/TARGETED/
{
    self->kq = arg0;
    self->changelist = arg1;
    self->nchanges = arg2;
    self->eventlist = arg3;
    self->nevents = arg4;
    printf("%5d/0x%x:  kevent(kq=%d, nevents=%d)\n", pid, tid, self->kq, self->nevents);
    /* DUMP_STACK; */
}


// Copy pasted out of sys/event.h
#define EVFILT_READ             (-1)
#define EVFILT_WRITE            (-2)
#define EVFILT_AIO              (-3)    /* attached to aio requests */
#define EVFILT_VNODE            (-4)    /* attached to vnodes */
#define EVFILT_PROC             (-5)    /* attached to struct proc */
#define EVFILT_SIGNAL           (-6)    /* attached to struct proc */
#define EVFILT_TIMER            (-7)    /* timers */
#define EVFILT_MACHPORT         (-8)    /* Mach portsets */
#define EVFILT_FS               (-9)    /* Filesystem events */
#define EVFILT_USER             (-10)   /* User events */
#define EVFILT_VM               (-12)   /* Virtual memory events */
#define EVFILT_EXCEPT           (-15)   /* Exception events */

#define evfilt_str_case(name) this->kev->filter == name ? (#name) :

#define print_kevent_fds0(PREFIX, ARR, COND, NUM) \
    syscall::kevent:return \
    /TARGETED && (COND)/ \
    { \
        this->kev = (struct kevent *)copyin(ARR + NUM * sizeof(struct kevent), sizeof(struct kevent)); \
        this->filter_s = \
            evfilt_str_case(EVFILT_READ) \
            evfilt_str_case(EVFILT_WRITE) \
            evfilt_str_case(EVFILT_AIO) \
            evfilt_str_case(EVFILT_VNODE) \
            evfilt_str_case(EVFILT_PROC) \
            evfilt_str_case(EVFILT_SIGNAL) \
            evfilt_str_case(EVFILT_TIMER) \
            evfilt_str_case(EVFILT_MACHPORT) \
            evfilt_str_case(EVFILT_FS) \
            evfilt_str_case(EVFILT_USER) \
            evfilt_str_case(EVFILT_VM) \
            evfilt_str_case(EVFILT_EXCEPT) \
            "??"; \
        printf("\t%s{ .ident = %d, .filter = 0x%04x(%s), .flags = 0x%04x, .fflags = 0x%08x, .data = 0x%016x }\n", \
            PREFIX, this->kev->ident, this->kev->filter, this->filter_s, this->kev->flags, this->kev->fflags, this->kev->data \
        ); \
    }
#define print_kevent_fds(NUM) print_kevent_fds0("=> ", self->eventlist, arg0 > NUM, NUM)
#define print_kevent_fds_change(NUM) print_kevent_fds0("CHG ", self->changelist, self->nchanges > NUM, NUM)

syscall::kevent:return
/TARGETED/
{
    printf("%5d/0x%x:  kevent() => %d\n", pid, tid, arg0);
}

print_kevent_fds(0)
print_kevent_fds(1)
print_kevent_fds(2)
print_kevent_fds_change(0)
print_kevent_fds_change(1)
print_kevent_fds_change(2)
```

</details>

### So that found the bug right?

*looks nervously at the scroll bar*

About that.

It did give me a lot more information: that the only things that kj was listening to were `EVFILT_USER` (the equivalent to `eventfd` on Linux/Illumos), and it was not implicated in my misbehaving file descriptor.
It also showed the symptom: that `poll` was not returning the `POLLHUP` event it was supposed to be returning, so this means we have to dig deeper.

In the trace below, you can see some calls to `kevent` for `EVFILT_USER`, but does not do anything with file descriptors.
We also see a poll call that never finishes.

```
$ sudo dtrace -C -s kqueue_snoop.d -c './outputs/out/bin/nix-daemon --daemon'
warning: $HOME ('/Users/jade') is not owned by you, falling back to the one defined in the 'passwd' file ('/var/r
oot')
fork to 2313             = 0 Err#1
 2313/0xa05c:  kqueue() => 3
 2313/0xa05c:  kevent(kq=3, nevents=0)
 2313/0xa05c:  kevent() => 0
        CHG { .ident = 0, .filter = 0xfff6(EVFILT_USER), .flags = 0x0021, .fflags = 0x00000000, .data = 0x0000000
000000000 }
fork to 2313             = 0 0
fork to 2313             = 0 0
fork to 2313             = 0 0
accepted connection from pid 2353, user jade (trusted)
fork to 2355             = 0 0
 2355/0xa1af:  kqueue() => 3
 2355/0xa1af:  kevent(kq=3, nevents=0)
 2355/0xa1af:  kevent() => 0
        CHG { .ident = 0, .filter = 0xfff6(EVFILT_USER), .flags = 0x0021, .fflags = 0x00000000, .data = 0x0000000
000000000 }
fork to 2355             = 0 0
fork to 2355             = 0 0
 2355/0xa1b1:  poll(16bdf6f08, 2)
         {.fd = 12, .events = 0x0010, .revents = 0x0000}
         {.fd = 10, .events = 0x0001, .revents = 0x0000}
<ctrl-c the other process, nothing happens>
```

# Interlude: Where to find information for use of DTrace

DTrace, especially on macOS, is not very well documented.
There is [the man page][dtrace(1)], which is probably the most notable piece of documentation.
There's not that much else to go off of, though [at least the source code is public][dtrace-src] and so one can grep for things and get some answers.

Illumos has [a book on its implementation of DTrace][illumos-dtrace-book], but some parts will not apply since while Apple DTrace and Solaris/Illumos DTrace share a common heritage, that common heritage is only really shared up to somewhere between 2006-2010.

[dtrace-src]: https://github.com/apple-oss-distributions/dtrace
[illumos-dtrace-book]: https://illumos.org/books/dtrace/preface.html

## Special variables {#special-variables}

Special variables are documented in [`dtrace(1)`][dtrace(1)], but there's some additional details I think are really important to include.

It's documented in [Illumos's book][illumos-dt-types] that `/usr/lib/dtrace` contains some auto-loaded definitions for types.
This is also true on macOS providing that `-x nolibs` is not set.

You can get an interesting set of definitions in [`/usr/lib/dtrace/darwin.d`][darwin.d], which give quite useful information on what *exactly* you can get out of `curproc`.
In reading this, you may notice a `translator` construct which is undocumented in `dtrace(1)`; Illumos [has the docs on that][translators].
This is how I figured out that `curproc->pr_fname` is a thing which was immensely useful for filtering things to just `nix` processes in my tracers.

[darwin.d]: https://github.com/apple-oss-distributions/xnu/blob/e3723e1f17661b24996789d8afc084c0c3303b26/bsd/dev/dtrace/scripts/darwin.d
[translators]: https://illumos.org/books/dtrace/chp-xlate.html#chp-xlate
[illumos-dt-types]: https://illumos.org/books/dtrace/chp-types.html#chp-types

# Kernel debugging time!

## Give me a kernel debugger, man!

<aside>

This subsection describes me wasting my time.
Nothing in it accomplishes anything of value aside from demonstrating Apple's frustrating anti-user "security" practices.

You can skip it on this basis, but it might be interesting.

</aside>

It would sure be nice to have a kernel with full debug symbols and a kernel debugger and maybe it will make DTrace work better (or so I told myself).
Fortunately, Apple releases *some* of those for *some* kernel versions, which are called KDKs (Kernel Development Kits), yay!

Unfortunately, the README on the KDK falsely states that you can't run "variant" kernels like the "development" one on Apple silicon.
That README is at `/Library/Developer/KDKs/*.kdk/KDK_ReadMe.rtfd`.

> Note: Apple silicon doesn’t support installing the kernel and kernel extension variants from the KDK.

However, there's a blog post on doing this for running debug kernels to [bypass VM quotas on macOS][bypass-vm-limits] on Apple silicon, so it seems like that's false.
Non-recommended recreational macOS license violations in that post aside, you *can* in fact run a locally-built kernel collection on a macOS VM; the machine name to use for it is `vmapple`.

[bypass-vm-limits]: https://khronokernel.com/macos/2023/08/08/AS-VM.html

```sh
#!/usr/bin/env zsh
# Put your build number here
kdk=/Library/Developer/KDKs/KDK_15.4_24E248.kdk

drivers=$(kmutil inspect -V release --no-header | grep -v "SEPHiber" | awk '{print " -b "$1; }')

sudo kmutil create \
  --arch arm64e \
  --no-authorization \
  --variant-suffix development \
  --new boot \
  --boot-path VirtualMachine.kc \
  --kernel $kdk/System/Library/Kernels/kernel.development.vmapple \
  --repository $kdk/System/Library/Extensions \
  --repository /System/Library/Extensions \
  --repository /System/Library/DriverExtensions \
  --explicit-only ${=drivers}
```

Then you boot into Recovery mode using the UTM right click menu on the VM and run this stuff in the Terminal:

```
# csrutil disable
# bputil --disable-boot-args-restriction
# kmutil configure-boot --volume /Volumes/Macintosh\ HD --custom-boot-object /Volumes/Macintosh\ HD/Users/*/VirtualMachine.kc
```

In the linked post, they set a nvram variable for kernel args.
I didn't get that piece to work, and I don't know where they got the UUID from, though it is probably the volume group UUID if we're taking guesses based on the `bputil` man page.
It didn't matter for my purposes anyway.

### Kernel debuggers?

Quoth the KDK README:

> Note: Apple silicon doesn’t support active kernel debugging. You may inspect the current state of the kernel when it is halted due to a panic or NMI. However, you cannot set breakpoints, continue code execution, step into code, step over code, or step out of the current instruction.

Well that sucks!

It [seems][asi-debugging-1] to be [somewhat corroborated][asi-debugging-2] by [actual practice][asi-debugging-3], so I think that's not an untruth in the README.
It seems *really* implausible to me that there's not any way to get a real kernel debugger since surely people trying to do this at Apple would find this highly annoying and would cause it to get fixed.

[asi-debugging-1]: https://dmaclach.medium.com/kernel-debugging-on-apple-silicon-ff5aa76c4429
[asi-debugging-2]: https://www.diverto.hr/en/blog/2022-03-06-macos-two-Machine-kernel-debugging/
[asi-debugging-3]: https://github.com/checkra1n/macs/blob/main/KDK.md

One possible hypothesis is that everyone doing macOS kernel debugging in Cupertino is using JTAG or, for VMs, the `Virtualization.framework` GDB server and thus doesn't have to care about the built-in kernel debugger being nearly useless.

Wait what? A GDB server? In MY `Virtualization.framework`? Can I use that?

Of course not!! You have to remember that the only people allowed to do kernel development on macOS are Apple.
That's why they [locked it behind an Apple-internal-only entitlement][entitlement-no-fun].
Locally signing executables with these entitlements such that they're trusted requires disabling SIP on the virtualization host machine and doing some kind of signing shenanigans I'm unfamiliar with.
I do have an M4 on hand so although I could use nested virtualization using the SIP-disabled VM as a virtualization host, I haven't tested doing the self-signed thing.

A commonly-used alternative to fussing about code signing is `nvram boot-args="amfi_get_out_of_my_way=1"` to disable the entitlements system or `nvram boot-args="amfi_allow_any_signature=1"` to allow bogus signatures.
See [this page][amfi] for more details.
There are also a couple more undocumented options about this system listed [in a random GitHub issue][amfi-gh].
Don't use these options on a system you care about, since they are likely to break random stuff.
It seems like a lot of this security system (such as the TCC components) really deserve a blog post of their own, which I may or may not write.

[amfi]: https://theapplewiki.com/wiki/AppleMobileFileIntegrity
[amfi-gh]: https://github.com/MacEnhance/MacForge/issues/30#issuecomment-604647302

I have also been told that setting up locally trusted code signing CAs is a nightmare, so I haven't looked into it any further on that basis.
If you have a link to a guide to do this, please send me an email.

Thanks to [Alice] for telling me about the entitlement.

[Alice]: https://social.treehouse.systems/@alice
[entitlement-no-fun]: https://github.com/saagarjha/VirtualApple/blob/c840b66794129014d0d59b39182fb81ebfdbc5fa/VirtualApple/ConfigurationViewController.swift#L138-L140

### About that "making DTrace work better"

Once booted up, I tried to use DTrace and it was broken altogether with an amusingly terrible error message (which is not a syntax error; it's probably a missing type or something).

This is filed as [FB17257921][fb-dtrace] for those playing along in Cupertino.

```
$ sudo dtrace -n syscall::exit:entry
dtrace: invalid probe specifier syscall::exit:entry: "/usr/lib/dtrace/darwin.d", line 26: syntax error near "uthread_t"
```

Interestingly, it looks like during the early stages of Apple silicon macOS, someone on X mentioned [hitting this exact fault on a Developer Test Kit][dtk-failures] which is how I learned of `-x nolibs`.

[dtk-failures]: https://x.com/JorgenLundman/status/1279926319866757120

Enough of this nonsense, let's use a production kernel.

Run:

```
# bputil -n
# csrutil disable
```

That should reset the boot policy (n.b. I have not tested this and forget the commands I used when I did it successfully).

# Kernel debugging time (with DTrace)

Since Apple doesn't let me use a kernel debugger on virtual machines on my own computer, let's just see what we can do with DTrace.

DTrace has a provider called `fbt`, which is the Function Boundary Tracer for kernel functions.
It lets you run trace probes on entry and return of most kernel functions on production kernels (!), assuming that DTrace is available.

Note that we don't have the sources to the exact kernel we're running because Apple source dumps are infrequent.
However, various nonsense with these notifications has been happening for literally years and this is not the kind of code to change often.

We *do* have a kernel with debug symbols from the KDK, but it breaks Ghidra, so it's easier to read the sources for the most part, and occasionally reference the decompilation to figure out which functions actually exist after inlining.

<aside>

The way that debug symbols on macOS work is that there's a `.dSYM` bundle with `Resources/DWARF/...` containing Mach-O files with DWARF symbols in them.
Tooling expects this `.dSYM` bundle to be next to the executable being debugged on the filesystem, and will automatically pick it up if present.

By using `dwarfdump --uuid` on the binary and the debug symbols, it's possible to confirm that the debug symbols are matching the binary in question.
The equivalent to this UUID on ELF platforms is the `build-id`.

</aside>

A quick overview of the parts of the kernel we will have to deal with:

- knotes: this is the basis of kqueue and is basically 1:1 mapped to kqueue in userspace, but is also used in kernel space.

  `poll(2)` on macOS is a thin wrapper of kqueue internally.
- `uipc_*` functions: the interface between the kernel socket system and the Unix domain socket protocol implementation.
  For example, `uipc_disconnect`.

  See `bsd/kern/uipc_usrreq.c`.
- `unp_*` functions: this is the inside of the Unix sockets protocol, somewhat abstracted from the socket machinery.
  Also related, `struct unpcb`, "UNix socket Protocol Control Block" or so.

  For example, `unp_disconnect`.

  See `bsd/kern/uipc_usrreq.c`.
- `so*` functions: the socket machinery.
  This is, of course, in `uipc_socket.c`, but is shared with every non-Unix socket type and has nothing Unix specific in it.

  Naturally, some other functions like `soisdisconnected` for when a socket was disconnected, are defined in `uipc_socket2.c`, because I guess the first one got too long?
  Unix kernels...

  This file also contains the implementations of things like [soo_kqfilter], the kqueue filter for sockets.

  I have no idea why that's the case, but it *is* a Unix kernel so it's allowed to not make any sense and to have a vowel shortage.
- `SB_*`, `struct sockbuf`: this is the mechanism for delivering socket data to the other end, and manages the data buffers.

  Each `struct socket` (*each end of the Unix socket*) has both a `so_rcv` and `so_snd` `struct sockbuf`.

  The state of the `sockbuf` includes `sb_waiters` and `sb_flags`, which are related to event notifications to the other end of the socket.

[soo_kqfilter]: https://github.com/apple-oss-distributions/xnu/blob/8d741a5de7ff4191bf97d57b9f54c2f6d4a15585/bsd/kern/uipc_socket.c#L6538-L6576

## Debugging approach

We know that the problem is that an event notification from a disconnect is not getting delivered.
Thus, we want to start from a place where the event exists and go from there to where it gets dropped.

My general approach to dealing with large unfamiliar codebases is [discussed somewhat in my article on dealing with C/C++][c-cpp]; in short, it's to try to find a unique string that is relatively related to what I'm looking for, then grep it and go from there.
In this case we don't get a language server because building the XNU kernel outside Apple is a pain, [although there are blog posts][xnu-build], I have better things to do than fighting Xcode and don't need the binaries, so all we get is `ctags`.

[xnu-build]: https://kernelshaman.blogspot.com/2021/02/building-xnu-for-macos-112-intel-apple.html

In this case my entry point was to think up what's unique about Unix sockets because I wanted the Unix socket code, thought "sending FDs via `SCM_RIGHTS` is special about Unix sockets". I then grepped for `SCM_RIGHTS` and found `uipc_socket.c` and `uipc_usrreq.c`.
Then I read those files for disconnect related machinery.

[c-cpp]: https://jade.fyi/blog/workflow-unfamiliar-c-cpp-codebases/

After looking through those files some, I could write a DTrace script to use the `fbt` provider to trace a tree of related functions (found via `ctags` navigation), for example:
- `soisdisconnected`
- `unp_disconnect`
- `uipc_disconnect`
- `soo_kqfilter`
- `sofreelastref`
- `sowakeup`
- `filt_sordetach`

It was really helpful to put `stack()` in a couple of them to get the kernel stack traces and familiarize myself with how control gets from system calls into the actual implementation.

## `struct fileglob *ptrauth` you say

I called `print()` on a `struct fileproc` and it gave me this:

```
  0 296202              soo_kqfilter:return struct fileproc {
    os_refcnt_t fp_iocount = {
        os_ref_atomic_t ref_count = 0x2
    }
    fileproc_vflags_t fp_vflags = FPV_NONE
    fileproc_flags_t fp_flags = FP_NONE
    uint16_t fp_guard_attrs = 0
    struct fileglob *ptrauth fp_glob = 0x4abafe29d4c22d18
    union  {
        struct select_set *fp_wset = 0
        struct fileproc_guard *ptrauth fp_guard = 0
    }
}
```

Specifically, what does `struct fileglob *ptrauth fp_glob = 0x4abafe29d4c22d18` mean?
It's a kernel pointer, but it doesn't *look* like a kernel pointer, which start with `0xffff`.

I [know about PAC][PAC], which is almost certainly what this is, but how do you do things with it in DTrace?

Knowing it was an Apple thing, I grepped the Apple DTrace sources for `ptrauth` assuming it was undocumented; turns out it's right there in the man page:

>      `void* strip(void *ptr, uint8_t key)`
>        On platforms that support encoded pointers, strips the pointer authentication bits from ptr
>        to produce a valid pointer. Valid values for key can be found in ptrauth.h.

I then found the kernel code involved and found it was using the [`pacdza`][pacda] instruction, which means it's the `DA` key, thus:

```c
    self->sock = (struct socket *)strip((void *)self->fp->fp_glob->fg_data, ptrauth_key_asda);
```

[PAC]: https://support.apple.com/en-ca/guide/security/sec8b776536b/1/web/1#sec0167b469d
[pacda]: https://developer.arm.com/documentation/dui0801/l/A64-General-Instructions/PACDA--PACDZA--A64-

## Attempting to use Ghidra

If you need to get some more info out of the kernel for whatever reason (confusing symbol names, macros, etc), it is possible to throw the kernel from the KDK in Ghidra.
I mostly wanted to do it so that I could see what was actually in the kernel (since not all functions actually are in the `fbt` DTrace provider due to inlining).

Don't use the DWARF debug symbols, since for some reason Ghidra will create literally a million structs, take forever to do so, and then be missing all function definitions and type info.

Here's a bad Python script that I hacked up out of [some Python on the internet][ghidra-script-src] that *can* add function definitions based on the `kernel.release.vmapple.dSYM` shipped in the KDK:

[ghidra-script-src]: https://gist.github.com/mogery/e277086d5b778e48921fa05788612913

<details>

<summary>Ghidra script for symbols</summary>

```python
from ghidra.program.model.symbol.SourceType import *
import ghidra.util.exception.DuplicateNameException
import string
import subprocess

functionManager = currentProgram.getFunctionManager()

f = askFile("Give me a file to open", "Go baby go!")

outp = subprocess.check_output(["objdump", "-t", f.absolutePath])

outp = outp.splitlines()[4:]
typs = set()

secs = {'__TEXT_EXEC,__text'}

for line in outp:
    addr, _, rest = line.partition(' ')
    rest = rest.lstrip()
    scope, _, rest = rest.partition(' ')
    rest = rest.lstrip()
    typ2, _, rest = rest.partition(' ')
    rest = rest.lstrip()
    section, _, rest = rest.partition(' ')
    sym = rest.lstrip()
    typs.add(typ2)

    if section not in secs:
        continue
    sym = sym[len('.hidden '):] if sym.startswith('.hidden') else sym
    if sym == 'CHECKPOINT':
        continue
    if typ2 != 'F':
        continue

    print(repr((addr, typ2, sym)))

    addr_long = long(addr, 16)
    address = toAddr(addr)

    func = functionManager.getFunctionAt(address)

    if func is not None:
        old_name = func.getName()
        print(repr(old_name), repr(sym))
        if sym == old_name: continue
        try:
            func.setName(sym, USER_DEFINED)
        except ghidra.util.exception.DuplicateNameException:
            print('Skipped: ', sym)
        print("Renamed function {} to {} at address {}".format(old_name, sym, address))
    else:
        func = createFunction(address, sym)
        print("Created function {} at address {}".format(sym, address))


print(typs)
```

</details>

## The actual bug

Between runs I got rid of excess daemons (to reduce noise) with:

```
$ pgrep -lf nix-daemon | grep -E 'nix-daemon [[:digit:]]+' | cut -d' ' -f1 | xargs sudo kill
```

The debugging strategy really just was that I dumped state in the affected functions into a log and stared at it and took notes.
After a day of debugging and grabbing a few runs of the problem, I found the following:

On the *client* side socket in a *bad* run:

```
    so_state = 0x2031: SS_ISDISCONNECTED | SS_CANTSENDMORE | SS_CANTRECVMORE | SS_NOFDREF
    so_flags = 0x8004: SOF_PCBCLEARING | SOF_NODEFUNCT
    so_snd.sb_flags = 0x100: SB_UNIX
    so_rcv.sb_flags = 0x104: SB_UNIX | SB_RECV
```

On the *client* side socket in an *ok* run:

```
    so_rcv.sb_flags = 0x144: SB_UNIX | SB_RECV | SB_KNOTE
```

The difference here is that `SB_KNOTE` is set in `so_rcv.sb_flags` on the run where the bug doesn't happen.
This makes sense, since the problem we are looking for is that a knote is not getting delivered to a kqueue (internal to `poll`)!

To recap the problem: `uipc_disconnect`'s call tree isn't calling `sowakeup` from `soisdisconnected` on the client's socket because `daemon_side_sock.so_rcv.sb_flags` does not have `SB_KNOTE` set on it.

However, that doesn't answer *why* `SB_KNOTE` is no longer set.
I figured out later what caused *that*:

```
  0 356775                   sowakeup:entry pid=17682 sb=0xfffffe1d43ba38c0 so_flags=0x00048000 so_state=0x00000082 sb_flags=0x00000144 sb_waiters=0
              kernel.release.vmapple`uipc_send+0x8b8
              kernel.release.vmapple`soo_write+0xd8
              kernel.release.vmapple`fp_writev+0x90
              kernel.release.vmapple`writev_internal+0x360

  0 354446                 knote_drop:entry pid=17684 kq=fffffe187a4df880 kn=fffffe1d3b122200
              kernel.release.vmapple`kqueue_scan+0x3c0
              kernel.release.vmapple`unix_syscall+0x304
              kernel.release.vmapple`sleh_synchronous+0x3e0
              kernel.release.vmapple`fleh_synchronous+0x28
              kernel.release.vmapple`fleh_dispatch64+0x19c

  0 356634             filt_sordetach:entry pid=17684 kn=fffffe1d3b122200 so=fffffe1d43ba3850 rcv_sb_flags=0x00000144
struct knote {
    /* ... */
    struct kevent_internal_s kn_kevent = {
        uint64_t kei_ident = 0xc
        int8_t kei_filter = '\37777777777'
        uint8_t kei_filtid = 0x17
        uint16_t kei_flags = 0x1011
        /* JADE'S NOTE:      ^^^^^^ This is kn_flags, which are EV_ADD | EV_ONESHOT | EV_FLAG0 */
        int32_t kei_qos = 0
        uint64_t kei_udata = 0
        uint32_t kei_fflags = 0
        uint32_t kei_sfflags = 0
        int64_t kei_sdata = 0
        uint64_t [4] kei_ext = [ 0, 0, 0, 0 ]
    }
}
              kernel.release.vmapple`knote_drop+0x1ec
              kernel.release.vmapple`poll_nocancel+0x2d4
              kernel.release.vmapple`unix_syscall+0x304
              kernel.release.vmapple`sleh_synchronous+0x3e0
              kernel.release.vmapple`fleh_synchronous+0x28
              kernel.release.vmapple`fleh_dispatch64+0x19c

  2 356775                   sowakeup:entry pid=17684 sb=0xfffffe1d43bb8e78 so_flags=0x00008000 so_state=0x00000002 sb_flags=0x00000104 sb_waiters=1
              kernel.release.vmapple`uipc_send+0x8b8
              kernel.release.vmapple`soo_write+0xd8
              kernel.release.vmapple`fp_writev+0x90
              kernel.release.vmapple`writev_internal+0x360
```

So that *did* have `SB_KNOTE` set in `so_rcv.sb_flags` when it received a wakeup from `writev_internal` (*hmmmmm*, not a disconnect!), which then led to `knote_drop` being called immediately after inside `kqueue_scan` inside of `poll`.
Thereafter it didn't have `SB_KNOTE` set on the next wakeup.

Well that's extremely suspicious!

Some inspection of `kqueue_scan` revealed the [following code][kn-drop]:

[kn-drop]: https://github.com/apple-oss-distributions/xnu/blob/8d741a5de7ff4191bf97d57b9f54c2f6d4a15585/bsd/kern/kern_event.c#L4448-L4457

```c
	if (kev.flags & EV_ONESHOT) {
		if ((kn->kn_flags & EV_DISPATCH2) == EV_DISPATCH2 &&
		    (kn->kn_status & KN_DEFERDELETE) == 0) {
			/* defer dropping non-delete oneshot dispatch2 events */
			kn->kn_status |= KN_DEFERDELETE | KN_DISABLED;
		} else {
			drop = true;
		}
	} else if (kn->kn_flags & EV_DISPATCH) {
		/* disable all dispatch knotes */
		kn->kn_status |= KN_DISABLED;
	} else if ((kn->kn_flags & EV_CLEAR) == 0) {
		/* re-activate in case there are more events */
		knote_activate(kq, kn, FILTER_ACTIVE);
	}

	/*
	 * callback to handle each event as we find it.
	 * If we have to detach and drop the knote, do
	 * it while we have the kq unlocked.
	 */
	if (drop) {
		knote_drop(kq, kn, &knlc);
	} else {
		knote_unlock(kq, kn, &knlc, KNOTE_KQ_UNLOCK);
	}
```

I also see that the knote in question has an `EV_ONESHOT` flag based on looking at `kei_flags` from the dumped struct.
That explains why `knote_drop` was getting called.

This is certainly our culprit: `poll` is registering for one-shot event notifications that get deregistered when they fire, and *one of them got **spuriously** fired by `writev` on the client*, but since it didn't match the event filter of our `poll` call, it doesn't cause `poll` to return.

The fault here comes full circle to the POSIX violation: `poll(2)` is *simply broken* on macOS if you don't ask for all the things that would trigger an `EVFILT_READ` kqueue notification in `pollfd.events`, since `poll(2)` will get its internal event subscription knocked out if it receives an event it ignores.

`poll` also won't return if this happens, since if it ignores an event, it [doesn't increment `kec_process_noutputs`][poll_callback].
In particular, it just kind of says "oh some event happened, let's set whatever they have in `fds->events` in `fds->revents`", and if there's not `POLLIN` or anything like that set in `fds->events`, `fds->revents` will be 0 and thus not increment `kec_process_noutputs`.

```c
	if (kevp->flags & EV_EOF) {
		fds->revents |= POLLHUP;
	}
// ...
	switch (kevp->filter) {
	case EVFILT_READ:
// ...
		if (fds->revents & POLLHUP) {
			mask = (POLLIN | POLLRDNORM | POLLPRI | POLLRDBAND);
		} else {
			mask = (POLLIN | POLLRDNORM);
			if (kevp->flags & EV_OOBAND) {
				mask |= (POLLPRI | POLLRDBAND);
			}
		}
		fds->revents |= (fds->events & mask);
        break;
// ...
    }
// ...
	if (fds->revents != 0 && prev_revents == 0) {
		kectx->kec_process_noutputs++;
	}
```

which would be [required to make `kqueue_scan` exit][kqueue_scan-exit]:

```c
	if (kectx->kec_process_noutputs) {
		/* callers will transform this into no error */
		error = EWOULDBLOCK;
	}
```

[poll_callback]: https://github.com/apple-oss-distributions/xnu/blob/8d741a5de7ff4191bf97d57b9f54c2f6d4a15585/bsd/kern/sys_generic.c#L1901-L1903
[kqueue_scan-exit]: https://github.com/apple-oss-distributions/xnu/blob/8d741a5de7ff4191bf97d57b9f54c2f6d4a15585/bsd/kern/kern_event.c#L7870-L7873

Thus `poll(2)` gets stuck in `kqueue_scan` and doesn't return.

This only happens if there are two or more FDs in the `pollfds`, since if there's just one, it *will* terminate on account of the lack of remaining event subscriptions in `kqueue_scan`.

# What have we learned?

I definitely am getting positive reinforcement that kernels aren't that scary.
Being able to use DTrace and be absolutely confident I won't break the machine was really nice, in spite of Apple making it the only possible option.

It might have been faster to find the issue had I had the ability to use a real kernel debugger and just step through it, but there's something to be said for the approach of not introducing significant timing problems.

It's *really* valuable to basically always run debugging sessions inside `script(1)`: it means that you're not fiddling around with terminal scrollback and you can find interesting things in the logs of previous reproductions of the bug.

I definitely think I might try to use DTrace for userspace debugging use cases, for example, with the `pid` provider, which is basically `fbt` but for userspace functions.
It seems like DTrace could help with some performance debugging tasks I have.
That said, it is annoying that I have to use it in a VM.

It *did* kind of hurt that all of the bugs in the `MonitorFdHup` implementation that wasted countless hours of Nix implementers' time were ultimately rooted in the macOS `poll(2)` implementation being broken in approximately one single way, and that we could have gotten off of Mr. `poll`'s wild ride at any time by declaring it too unreliable and using `kqueue(2)` instead, as we finally did in Lix 2.93.0.

`MonitorFdHup` used to use `pthread_cancel` instead of a pipe to break out of the `poll(2)`, and I wonder if it was actually a workaround to *this exact kernel bug* I found, *several years ago*, since it would avoid having more than one file descriptor, and thus `poll` would return instead of losing internal event subscriptions.

Writing this post and understanding the kernel behaviour leads me to increasingly strongly believe this bug is why `pthread_cancel` was originally used, even though it caused a *different* bug, namely, spurious Nix daemon SIGABRT terminations due to the exception that `pthread_cancel` injects.

These inconsistent faults (especially when the behaviour of problem parts is not fully understood) can really lead to multiple years of people trying to patch something in a bit of a game of telephone and all the while our users have a bad experience.
It's worth root causing these things, especially if they have haunted the software for so many years.
Operators of our software (including us, as major operators of Lix) deserve to have high quality software without these bugs.

# Thanks

A few anonymous people have helped me and offered advice over the course of this debugging adventure.
You know who you are.
Thank you so much for helping me.

# Appendix: the DTrace script

I used this DTrace script to trace the affected kernel functions:

<details>

<summary>Entire DTrace script</summary>

```c
fbt:mach_kernel:soo_kqfilter:entry /curpsinfo->pr_fname == "nix"/ {
    self->go_kqf = 1;
    self->kn = (struct knote *)arg1;
    self->fp = (struct fileproc *)arg0;
	self->sock = (struct socket *)strip((void *)self->fp->fp_glob->fg_data, ptrauth_key_asda);
	printf("pid=%d so=%p so_type=%d so_flags=0x%08x sb_recv_flags=0x%08x", pid, self->sock, self->sock->so_type, self->sock->so_flags,
		self->sock->so_rcv.sb_flags);
	stack();
	ustack();
}

fbt:mach_kernel:soo_kqfilter:return /self->go_kqf/ {
    self->go_kqf = 0;
	printf("pid=%d so=%p so_type=%d so_flags=0x%08x sb_recv_flags=0x%08x", pid, self->sock, self->sock->so_type, self->sock->so_flags,
		self->sock->so_rcv.sb_flags);
    print(*self->fp);
}

fbt:mach_kernel:poll_nocancel:entry /curpsinfo->pr_fname == "nix"/ {
	printf("pid=%d", pid);
    self->go_poll = 1;
	ustack();
}
fbt:mach_kernel:poll_nocancel:return /curpsinfo->pr_fname == "nix"/ {
	printf("pid=%d", pid);
}

fbt:mach_kernel:kqueue_scan:entry /self->go_poll/ {
	printf("pid=%d", pid);
    self->go_poll = 0;
	ustack();
}
fbt:mach_kernel:kqueue_scan:return /curpsinfo->pr_fname == "nix"/ {
	printf("pid=%d", pid);
}

fbt:mach_kernel:filt_sordetach:entry /curpsinfo->pr_fname == "nix"/ {
    self->kn = (struct knote *)arg0;
	self->so = (struct socket *)strip((void *)self->kn->kn_fp->fp_glob->fg_data, ptrauth_key_asda);
	printf("pid=%d kn=%p so=%p rcv_sb_flags=0x%08x", pid, self->kn, self->so, self->so->so_rcv.sb_flags);
	print(*self->kn);
	stack();
	ustack();
}

fbt:mach_kernel:knote_drop:entry /curpsinfo->pr_fname == "nix"/ {
	printf("pid=%d kq=%p kn=%p", pid, arg0, arg1);
	stack();
}

fbt:mach_kernel:unp_disconnect:entry /curpsinfo->pr_fname == "nix"/ {
    printf("pid=%d name=%s\n", pid, curpsinfo->pr_fname);
    self->unpcb = (struct unpcb *)arg0;
    print(*self->unpcb);
    print(*self->unpcb->unp_conn);
    self->go = 1;
}

fbt:mach_kernel:unp_disconnect:entry /self->go && self->unpcb->unp_conn->unp_addr/ {
    print(*self->unpcb->unp_conn->unp_addr);
}

fbt:mach_kernel:unp_disconnect:return /self->go/ {
    self->go = 0;
}

fbt:mach_kernel:unp_disconnect:entry /curpsinfo->pr_fname == "nix"/ {
	this->unp = (struct uncb *)arg0;
    printf("pid=%d", pid);
    stack();
}
fbt:mach_kernel:unp_detach:entry /curpsinfo->pr_fname == "nix"/ {
    printf("pid=%d", pid);
    stack();
}
fbt:mach_kernel:knote:entry /curpsinfo->pr_fname == "nix"/ {
    printf("pid=%d hint=0x%08x", pid, arg1);
}
fbt:mach_kernel:sofreelastref:entry /curpsinfo->pr_fname == "nix"/ {
    self->sock = (struct socket *)arg0;
    printf("free last ref to socket %p pid=%d type=%d dealloc=%d", self->sock, pid, self->sock->so_type, arg1);
}
fbt:mach_kernel:sowakeup:entry /curpsinfo->pr_fname == "nix"/ {
    self->sb = (struct sockbuf *)arg1;
    self->so = (struct socket *)arg0;
    printf("pid=%d sb=0x%08p so_flags=0x%08x so_state=0x%08x sb_flags=0x%08x sb_waiters=%d", pid, self->sb, self->so->so_flags, self->so->so_state, self->sb->sb_flags, self->sb->sb_waiters);
    stack(4);
}

fbt:mach_kernel:soisdisconnected:entry /curpsinfo->pr_fname == "nix"/ {
	self->so = (struct socket *)arg0;
	printf("pid=%d sock=%p snd_waiters=%d snd_sb_flags=0x%08x rcv_waiters=%d rcv_sb_flags=0x%08x",
		pid,
		arg0,
		self->so->so_snd.sb_waiters,
		self->so->so_snd.sb_flags,
		self->so->so_rcv.sb_waiters,
		self->so->so_rcv.sb_flags
	);
}

fbt:mach_kernel:soclose_locked:entry /curpsinfo->pr_fname == "nix"/ {
    self->go2 = 1;
    self->sock = (struct socket*)arg0;
}
fbt:mach_kernel:sofreelastref:entry /self->go2/ {
    self->go2 = 0;
    printf("sock=%p state=0x%08x flags=0x%08x pid=%d retaincnt=%d usecount=%d", self->sock, self->sock->so_state, self->sock->so_flags, pid, self->sock->so_retaincnt, self->sock->so_usecount);
}
```

</details>
