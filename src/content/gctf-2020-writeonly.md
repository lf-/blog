+++
date = "2020-08-23"
draft = false
path = "/blog/gctf-2020-writeonly"
tags = []
title = "Google CTF 2020: writeonly"
+++

I participated in the 2020 Google CTF on the UBC CTF team [Maple
Bacon](https://ubcctf.github.io/). Without their help, I would have probably
given up out of frustration. Special thanks to Robert and Filip who put up with
my many questions and swearing at the computer.

[All the files for my solution are available on my
GitHub](https://github.com/lf-/ctf/tree/main/writeonly).


I chose to do this challenge as nobody else on my team was working on it and it
looked fairly approachable, after getting frustrated with the assembly of the
reversing challenge `beginner`. Unfortunately, the assumption that I wouldn't
have to do assembly in this one was completely false, but I tricked myself for
long enough to have a proper go at it anyway.

The challenge gives as a description:

> This sandbox executes any shellcode you send. But thanks to seccomp, you
> won't be able to read /home/user/flag.

What this means in practice is that there is a seccomp filter with an
allow-list of system calls, that does not include `read`, however, as suggested
by the challenge name, `write` and `open` *are* supported. This can be abused.

## Shellcode in C and scaffolding

The challenge loads whatever you send it into a flat read-write-execute page.

I wanted to write my shellcode in C because, as mentioned, I didn't want to
write assembly! So, I endeavored to figure out how to make that happen. This
took more time than the challenge itself, but yak shaving is my specialty. I
looked around on the internet for options and found
[SheLLVM](https://github.com/SheLLVM/SheLLVM) which I couldn't figure out how
to use, [ShellcodeCompiler](https://github.com/NytroRST/ShellcodeCompiler)
which doesn't support variables, and [Binary Ninja
`scc`](https://scc.binary.ninja/index.html) which I don't have a license for.

As such, I tried to find prior art on Just Using a Normal Compiler. I found [a
good blog post](https://modexp.wordpress.com/2019/04/24/glibc-shellcode/#compile)
with lots of details, but it was clearly trying to hack around properties of
how executables are linked (and also I couldn't reproduce their string usage
myself successfully, even with `-O0`).

The specific usage of this shellcode has a lot in common with microcontrollers
and other embedded platforms in that the executable is loaded into memory and
executed immediately. Eventually this led to messing about with linker scripts
and staring at both `binutils` documentation and various linker scripts for
bare-metal platforms.

I ended up writing the following linker script to ensure that all the functions
were laid out as expected, annotating my `_start` function with
`__attribute__((section(".text.prologue")))` to make sure it gets put on top.
It also stuffs the `.rodata` section into `.text` to simplify the binary layout
(unsure if this is actually necessary).

```
ENTRY(_start);

SECTIONS
{
    . = ALIGN(16);
    .text :
    {
        *(.text.prologue)
        *(.text)
        *(.rodata)
    }
    .data :
    {
        *(.data)
    }

    /DISCARD/ :
    {
        *(.interp)
        *(.comment)
    }
}
```

Once the ELF is built (having this intermediate form is critical for debugging
so I can find addresses of things and have symbols while reading the output
assembly), it is `objcopy`'d with `-O binary` to emit the final shellcode
binary that can be loaded directly into memory and executed.

## The path to privilege escalation

Auditing the code for the challenge, I found that it forks a second process
prior to dropping privileges, which runs a function, `check_flag`, in an
infinite loop checking the validity of the flag. This seemed pretty suspicious
since there is no reason to overwrite the flag (it would cause losing the
flag).

```c
pid_t pid = check(fork(), "fork");
if (!pid) {
  while (1) {
    check_flag();
  }
  return 0;
}

// ⬇ this is suspicious!!
printf("[DEBUG] child pid: %d\n", pid);
void_fn sc = read_shellcode();
setup_seccomp();
sc();
```

My path to the solution was first poking around procfs to see what could be
abused. I struggled with `/proc/$pid/stack`, which appears to often be
inaccessible. I also initially failed to figure out how `/proc/$pid/mem`
worked, and assumed that it did not based on seeing an IO error.

As it turns out, this `mem` virtual file is basically just the entire memory
mappings of the process as a file, and you can `lseek` to any point in it and
use `write` to poke it. This sounded like it could enable execution to be taken
over given `write(2)` on it, so it was what I went with.

## Failed ROP attempt

Initially, I assumed falsely that it followed the mappings' access permissions,
which I found out later from someone on my team that this was not true. So, I
started out trying to write a Return Oriented Programming (ROP) chain to take
control of execution.

I used `ropper` to find gadgets to set up the registers to `syscall`
`execve("/bin/cat", "/home/user/flag", NULL)`. I then overwrote the stack to
try to get execution to go to my `execve(2)` after the return from
`nanosleep(2)`, assuming it would be fairly reliable since the process is
spending most of its time in this syscall. This got close to working but after
taking a break to sleep, I was informed that `/proc/$pid/mem` actually can
change read-only memory regions and changed my approach to simply overwrite the
process `.text` section with some shellcode.

## The exploit

High level overview:
- `fd = open("/proc/$childPid/mem", O_RDWR)`
- `lseek(fd, injectPos, SEEK_SET)`
- `write(fd, evilCode, sizeof (evilCode))`

Now that I have the pieces together, and can execute C in-process, it's time to
write an exploit. One of the first things I have to contend with is
constructing a path to `/proc/$pid/mem`. Well, I can't `getpid()` due to the
syscall filter, and it wouldn't even help to find the child PID. This was the
first challenge. I read the disassembly of the `main` function to try to find
the PID since it would have been returned from fork and it is logged by the
suspicious `printf`. As it turned out, it was indeed on the stack, so I wrote
some evil inline assembly to get the value pointed to by `rbp - 0x4`.

The next step was to construct the path. I was unsure of the availability of C
string and `itoa`-like functions in the environment, given that there is no
standard library present, so I just wrote some. Later, I found out that
`memcpy` was in fact available, so it's distinctly possible some of this was a
waste of time.

Syscalls were performed with more inline assembly, this time lifted directly
from the musl sources. Part of my motivation in not using a libc, besides
binary size, is that libc requires a bunch more sections to be present in my
binary, and I did not want to have to research how to deal with those.

I chose to inject my stage 2 shellcode right at the point where the loop of
`check_flag` would jump back to the beginning as it is a position where it
likely will work most of the time.

Stage 2 shellcode was generated with pwntools `shellcraft`. It was fairly
trivial.

Then, the exciting moment:

```
ctf/writeonly » make send
python send.py shellcode.bin
[+] Opening connection to writeonly.2020.ctfcompetition.com on port 1337: Done

[*] Switching to interactive mode
[DEBUG] child pid: 2
shellcode length? reading 576 bytes of shellcode. CTF{why_read_when_you_can_write}
$
```

## Learnings

Many. The one thing I did really right was making it easy to try again. Writing
a Makefile for the various things I needed to run was immensely valuable so I
didn't have to remember commands.

Late in the process I had a lot of trouble debugging a problem where the
exploit chain would work on local processes but not remotely. It turned out to
be that I was injecting in a location where it would sometimes corrupt
execution state of the checking process depending on where it was, and was
fixed by moving where I was injecting. However, I initially thought it was
ASLR, so fought with `gdb` a bunch about that.

Filip suggested that I use `socat TCP-LISTEN:8000,bind=localhost,reuseaddr,fork
EXEC:./chal` to essentially emulate the challenge server locally, and debug the
remote process. If the process is not started with `gdb` it is more likely to
be reproducible. This helped a lot in eliminating that as a variable.
