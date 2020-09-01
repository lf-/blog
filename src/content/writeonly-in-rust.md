+++
date = "2020-09-01"
draft = false
path = "/blog/writeonly-in-rust"
tags = ["ctf", "rust", "osdev"]
title = "Writing shellcode in Rust"
+++

In my [Google CTF entry for `writeonly` this year](https://lfcode.ca/blog/gctf-2020-writeonly),
I wrote my first stage shellcode in C, which was somewhat novel in and of
itself, as it seemed like few people were willing to brave linker scripts to be
able to write shellcode in C. My hubris does not stop at C, however, and the
crab language seemed well suited for a port.

[Source code here](https://github.com/lf-/ctf/tree/main/writeonly.rs)

As with the previous C implementation, what we are doing here, with this
particular CTF challenge is fundamentally the same thing as operating system
kernels generally do, where they are loaded into memory with `memcpy`, then
jumped to without any real setup.

The first step was figuring out how to generate an executable with nothing in
it. I consulted [an OS dev guide](https://os.phil-opp.com/freestanding-rust-binary/)
for how to do this, and we do essentially the same thing here, but adding our
own section attribute to make sure the linker places the function correctly.

`src/main.rs`:

```rust
#![no_std]
#![no_main]

#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! {
    loop {}
}

#[no_mangle]
#[link_section = ".text.prologue"]
pub extern "C" fn _start() -> ! {
    loop {}
}
```

-----

The next step was to set up Cargo. A trivial `Cargo.toml` is written, with
`panic = "abort"` set to avoid any unwinding machinery. `opt-level = "z"`
initially ballooned my code size, but after turning on LTO
[on advice of a Rust size optimization guide](https://github.com/johnthagen/min-sized-rust),
I got a massive win in code size, for the first time getting under 255 bytes.

`Cargo.toml`:

```toml
[package]
name = "shellcode"
edition = "2018"
version = "0.0.0"

[profile.dev]
panic = "abort"

[profile.release]
panic = "abort"
# these two cut code size by 2/3
opt-level = "z"
lto = true
```


[`.cargo/config.toml`](https://doc.rust-lang.org/cargo/reference/config.html):

```toml
[build]
rustflags = ["-C", "link-arg=-nostdlib", "-C", "link-arg=-static", "-C", "link-arg=-Wl,-Tshellcode.ld,--build-id=none"]
```

Internally, on Linux, Rust uses `gcc` as a linker, so I took the meaningful gcc
linking-stage flags and ported them directly over, and they just worked.

-----

Back to programming, I needed system calls. After very briefly considering
using a libc to deal with this stuff and throwing out the idea out of code size
concerns, I just grabbed the same assembly routines from the C implementation.
Rust has a [really nice inline asm syntax](https://github.com/rust-lang/rfcs/blob/master/text/2873-inline-asm.md)
which makes asm declarations clearer, and also has far better error messages
than Clang or GCC provide with their respective assemblers, so this required a
slight bit of porting.

```rust
unsafe fn syscall2(scnum: u64, arg1: u64, arg2: u64) -> u64 {
    let ret: u64;
    asm!(
        "syscall",
        in("rax") scnum,
        in("rdi") arg1,
        in("rsi") arg2,
        out("rcx") _,
        out("r11") _,
        lateout("rax") ret,
        options(nostack),
    );
    ret
}
```

Compare to the C equivalent:

```c
static inline long syscall2(long n, long a1, long a2)
{
    unsigned long ret;
    __asm__ __volatile__ ("syscall" : "=a"(ret) : "a"(n), "D"(a1), "S"(a2) : "rcx", "r11", "memory");
    return ret;
}
```

which uses hard-to-see colons as delimeters for the input, output, and clobber
lists and shortened single character versions of the registers that are
sometimes capitals if there are two with the same letter, e.g. `rdx` and `rdi`.
Also, if you're using Clang, there is no way to use Intel syntax for inline
assembly.

-----

The final step was to port the shellcode itself, which needs steal the child
PID from its caller's stack, make a path to `/proc/1234/mem`, where 1234 is the
child PID, then call `open(2)`, `lseek(2)`, then `write(2)`. I got most of the
way through a direct port, struggling a little bit with string manipulation in
fixed stack buffers, until someone on the Rust Discord pointed out that extra
slashes in paths are discarded, allowing a special `itoa` function to be
written that simply overwrites the path in place.

Specifically, it's possible to just do this:

```rust
    let mut buf: [u8; 21] = *b"/proc////////////mem\0";
    //                     start writing here ^
    my_itoa(pid, &mut buf[6..16]);
```

and not worry about any extra slashes, which will be ignored. This also allows
the `itoa` implementation to avoid having to reverse the string simply by
writing from the end to the start. This also cut the code size in half,
avoiding having to construct a string dynamically.

The rest of the shellcode was essentially the same as the C implementation,
which I also ported to using this trick, out of interest in code size
comparison.

-----

## Results

Rust: 168 bytes of code

C: 157 bytes of code

I have not further dug into why there is an extra 11 bytes of code size for
Rust. I believe that this result demonstrates that Rust can indeed be used for
writing simple shellcode payloads with the same fitness for purpose as C,
however at the size and level of complexity tested, nothing can be concluded
about the relative developer productivity benefits of the two languages for
this application.

One annoying disadvantage of Rust is that I can't just `#include
<sys/syscall.h>` or other headers and get the various constants used in system
calls. It was not difficult to write a short C program to get these numbers,
but it wouldn't have been necessary in a C payload.
