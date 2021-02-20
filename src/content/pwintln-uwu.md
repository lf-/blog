+++
date = "2020-11-21"
draft = false
path = "/blog/pwintln-uwu"
tags = ["rust", "linux"]
title = "pwintln uwu and other fun with elves and dynamic linkers"
+++

I recently was [brutally
nerdsniped](https://twitter.com/The6P4C/status/1329725624412381185) into
developing a [strange Rust library that turns prints into
uwu-speak](https://crates.io/crates/pwintln). I briefly considered writing a
proc macro but that was far too memory safe. It's doing-bad-things-to-binaries
time! (followed shortly by uwu time~!!)

I am going to use Linux because it's the platform I'm most comfortable doing
terrible things to.

I thought of a few strategies including inserting a breakpoint on the
`write(2)` routine in libc, but I figured I'd have to get the symbol anyway, so
messing with dynamic linking is probably the best strategy.

The way that dynamically linked symbols are handled *on my machine* for my Rust
executables is primarily through the `.rela.dyn` section. What this table
actually stores is the offsets from the base of the process image for function
pointers that are called indirectly when actually calling the function:

```
(gdb) si
0x000055555558126e      9           unsafe { libc::write(1, s.as_ptr() as *const c_void, s.to_bytes().len()) };
   0x0000555555581267 <_ZN7pwintln4main17hef045d1a4d1daed3E+23>:        48 8d 35 ea 7d 0e 00    lea    rsi,[rip+0xe7dea]        # 0x5
55555669058
=> 0x000055555558126e <_ZN7pwintln4main17hef045d1a4d1daed3E+30>:        ba 14 00 00 00  mov    edx,0x14
   0x0000555555581273 <_ZN7pwintln4main17hef045d1a4d1daed3E+35>:        bf 01 00 00 00  mov    edi,0x1
   0x0000555555581278 <_ZN7pwintln4main17hef045d1a4d1daed3E+40>:        ff 15 72 5c 17 00       call   QWORD PTR [rip+0x175c72]
  # 0x5555556f6ef0
```

This form of the call instruction, for those who are unfamiliar, dereferences
the pointer `[rip + 0x175c72]` then calls the resulting address. So, if we want
to redirect execution, we can replace the address in memory at `0x5555556f6ef0`
with a pointer to our own function!

The way the dynamic linker knows where to put this pointer is by looking it up
in the relocations table, which you can see with `readelf -r`. In particular,
we find that `0x0x5555556f6ef0 = PROG_BASE + 0x1a2ef0`.

```
dev/pwintln » readelf -r target/release/pwintln
Relocation section '.rela.dyn' at offset 0x11a0 contains 7458 entries:
   Offset          Info           Type           Sym. Value    Sym. Name + Addend
 00000017e9c0  000000000008 R_X86_64_RELATIVE                    f94e0
 00000017e9c8  000000000008 R_X86_64_RELATIVE                    2d160
 00000017e9d0  000000000008 R_X86_64_RELATIVE                    2d110
                       < ... ... ... ... ... ... >
0000001a2ea8  004400000006 R_X86_64_GLOB_DAT 0000000000000000 pthread_mutexattr_init@GLIBC_2.2.5 + 0
0000001a2ec0  004500000006 R_X86_64_GLOB_DAT 0000000000000000 pthread_key_create@GLIBC_2.2.5 + 0
0000001a2ee8  004600000006 R_X86_64_GLOB_DAT 0000000000000000 pthread_mutex_destroy@GLIBC_2.2.5 + 0
0000001a2ef0  004700000006 R_X86_64_GLOB_DAT 0000000000000000 write@GLIBC_2.2.5 + 0
0000001a2f28  004900000006 R_X86_64_GLOB_DAT 0000000000000000 sigaltstack@GLIBC_2.2.5 + 0
0000001a2f40  004a00000006 R_X86_64_GLOB_DAT 0000000000000000 pthread_mutex_unlock@GLIBC_2.2.5 + 0
0000001a2f48  004b00000006 R_X86_64_GLOB_DAT 0000000000000000 memcpy@GLIBC_2.14 + 0
0000001a2f68  004c00000006 R_X86_64_GLOB_DAT 0000000000000000 open@GLIBC_2.2.5 + 0
0000001a2f88  004d00000006 R_X86_64_GLOB_DAT 0000000000000000 mmap@GLIBC_2.2.5 + 0
0000001a2f98  004e00000006 R_X86_64_GLOB_DAT 0000000000000000 _Unwind_SetIP@GCC_3.0 + 0

 Relocation section '.rela.plt' at offset 0x2ccd0 contains 4 entries:
   Offset          Info           Type           Sym. Value    Sym. Name + Addend
 0000001a11d8  001000000007 R_X86_64_JUMP_SLO 0000000000000000 __register_atfork@GLIBC_2.3.2 + 0
 0000001a11e0  001900000007 R_X86_64_JUMP_SLO 0000000000000000 __fxstat64@GLIBC_2.2.5 + 0
 0000001a11e8  002300000007 R_X86_64_JUMP_SLO 0000000000000000 __tls_get_addr@GLIBC_2.3 + 0
 0000001a11f0  004800000007 R_X86_64_JUMP_SLO 0000000000000000 _Unwind_Resume@GCC_3.0 + 0
```

Here, we show the process of poking at the symbol in a different way: first, we
get the program base with `info proc mappings` (the first line). Then, we look
at the memory at `PROG_BASE + 0x1a1ef0`, then interpret the quad-word we find
there as a pointer, dereferencing it and looking at the disassembly at its
target. We find libc code for `write(2)` here!

```
dev/pwintln » gdb target/release/pwintln
(gdb) info proc map
process 26676
Mapped address spaces:

          Start Addr           End Addr       Size     Offset objfile
      0x555555554000     0x555555581000    0x2d000        0x0 /home/jade/dev/pwintln/target/release/pwintln
      0x555555581000     0x555555668000    0xe7000    0x2d000 /home/jade/dev/pwintln/target/release/pwintln
      0x555555668000     0x5555556d1000    0x69000   0x114000 /home/jade/dev/pwintln/target/release/pwintln
         < ... ... ... >
(gdb) x/gx 0x555555554000 + 0x1a1ef0
0x5555556f5ef0: 0x00007ffff7ec4f50
(gdb) x/10i 0x00007ffff7ec4f50
   0x7ffff7ec4f50 <write>:      endbr64
   0x7ffff7ec4f54 <write+4>:    mov    eax,DWORD PTR fs:0x18
   0x7ffff7ec4f5c <write+12>:   test   eax,eax
   0x7ffff7ec4f5e <write+14>:   jne    0x7ffff7ec4f70 <write+32>
   0x7ffff7ec4f60 <write+16>:   mov    eax,0x1
   0x7ffff7ec4f65 <write+21>:   syscall
   0x7ffff7ec4f67 <write+23>:   cmp    rax,0xfffffffffffff000
   0x7ffff7ec4f6d <write+29>:   ja     0x7ffff7ec4fc0 <write+112>
   0x7ffff7ec4f6f <write+31>:   ret
   0x7ffff7ec4f70 <write+32>:   sub    rsp,0x28
```

So, we know what we want to hack and how we want to hack it, but how do we find
these pointers exactly? Well, we could [consult
StackOverflow](https://stackoverflow.com/a/27304692) but the answer is some
fairly ugly C.

Rust will mostly save us from much of the uglier pointer code, and the
[`goblin`](https://docs.rs/goblin) crate makes a lot of the ELF code much
more pleasant.

Linux provides us the libc function `getauxval(3)`, which will retrieve various
bits of information that the kernel's ELF loader thinks were good. The most
relevant one to figuring out where our program is loaded is
`getauxval(AT_PHDR)`, which gives us the address of our `Elf64_Phdr` structure,
which will in turn have its own virtual address offset from the base. We can
subtract that offset to get the base of where our executable was loaded.

Side note: if you want to read preprocessor-infested C code and headers as
their concrete representation, you can do something like this:

```
~ » cpp /usr/include/link.h | grep -B10 Elf64_Phdr
typedef struct
{
  Elf64_Word p_type;
  Elf64_Word p_flags;
  Elf64_Off p_offset;
  Elf64_Addr p_vaddr;
  Elf64_Addr p_paddr;
  Elf64_Xword p_filesz;
  Elf64_Xword p_memsz;
  Elf64_Xword p_align;
} Elf64_Phdr;
```

Once we have that header, we can calculate memory addresses to other structures
in the ELF. I use
[`dyn64::from_phdrs(base: usize, headers: &[ProgramHeader])`](https://docs.rs/goblin/0.2.3/goblin/elf/dynamic/dyn64/fn.from_phdrs.html)
which looks for a program header with `p_type == PT_DYNAMIC`, then uses that
address and length to make a slice of `Dyn` (`Elf64_Dyn` in C) structures.

This is a pile of tagged pointers to various bits related to dynamic linking:

```
dev/pwintln » readelf -d target/debug/pwintln

Dynamic section at offset 0x4bb6c8 contains 32 entries:
  Tag        Type                         Name/Value
 0x0000000000000001 (NEEDED)             Shared library: [libgcc_s.so.1]
 0x0000000000000001 (NEEDED)             Shared library: [libc.so.6]
 0x0000000000000001 (NEEDED)             Shared library: [ld-linux-x86-64.so.2]
 0x0000000000000001 (NEEDED)             Shared library: [libm.so.6]
 0x0000000000000001 (NEEDED)             Shared library: [libpthread.so.0]
 0x0000000000000001 (NEEDED)             Shared library: [libdl.so.2]
 0x000000000000000c (INIT)               0x68000
 0x000000000000000d (FINI)               0x3a9424
 0x0000000000000019 (INIT_ARRAY)         0x490f00
 0x000000000000001b (INIT_ARRAYSZ)       16 (bytes)
 0x000000000000001a (FINI_ARRAY)         0x490f10
 0x000000000000001c (FINI_ARRAYSZ)       8 (bytes)
 0x000000006ffffef5 (GNU_HASH)           0x340
 0x0000000000000005 (STRTAB)             0xad0
 0x0000000000000006 (SYMTAB)             0x368
 0x000000000000000a (STRSZ)              1331 (bytes)
 0x000000000000000b (SYMENT)             24 (bytes)
 0x0000000000000015 (DEBUG)              0x0
 0x0000000000000003 (PLTGOT)             0x4bc908
 0x0000000000000002 (PLTRELSZ)           96 (bytes)
 0x0000000000000014 (PLTREL)             RELA
```

For whatever reason, when they are actually loaded into memory, they are
resolved to actual pointers rather than the offsets we see here. In any case,
this is how you find the various bits you need next:

- dynamic symbol table
- string table
- Rela relocations table (`.rela.dyn`)

We can walk through the `Rela` table (storing tuples of `(offset, info,
addend)`), an array of `Elf64_Rela` in C, to find the symbol we're looking for.
To find things in it, such as our `write` we want to hack, we have to resolve
the names of the symbols, so let's get started on that.

The `info` field is a packed 64 bit integer with the index into the symbol
table in the upper 32 bits. The rest of the structure we can just ignore.

Once we index into the symbol table (which mysteriously doesn't seem to have
any terribly accessible way to get a length for?? This project was intended as
a joke so I used more unsafe ✨✨), we can get a symbol record.

These symbol records (`Elf64_Sym`) have `st_name` and a bunch of other fields
we don't really care about. But, since this is ELF, there's more indirection!
The `st_name` is an offset into the strings table, which is a big packed
blob of null-terminated C strings. So, we either use some C string functions or
let `goblin`'s `Strtab` abstraction deal with it for us, to get the actual
string.

Now that we have the string, we can reject all the symbols we aren't looking
for.

We have reached the home stretch of getting the pointer we were looking for,
the offset of which is in the `Rela` from earlier, which we can add to the
program base to get our pointer.

Whew.

------------------

## Replacing the function with our own

This part is much easier. We need to write an `extern "C"` function in Rust
that has the same signature as `write(2)` in `libc` (note that at this machine
level, there is no type system; so if we mess up, it might crash horribly or
do other UB. Fun!)

Once we have this function, we can replace it by putting a pointer to it at the
address we found earlier. This might require redoing the memory protection on
the page with `mprotect(2)` to allow reading and writing to it, because
"security" or some other similar good idea.

Store off the address to the real `write(2)` into some static (bonus points for
atomics), and replace the existing pointer.

We can then implement the wrapper using the function pointer we squirreled
away, to do whatever nefarious things we want.

uwu ✨

The crate I am writing this post on is [on
GitHub here](https://github.com/lf-/pwintln). Have fun in your future binary
spelunking adventures!
