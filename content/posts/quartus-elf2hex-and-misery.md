+++
date = "2023-04-20"
draft = false
path = "/blog/quartus-elf2hex-and-misery"
tags = ["quartus", "fpga"]
title = "Quartus, elf2hex, Nios II, bugs, and misery"
+++

I have been working on a school project, which uses Intel FPGAs and the
proprietary Intel Quartus toolchain. One of the components in the design we're
building is a Nios II embedded processor, which is Intel's weird proprietary
soft-core. In newer versions of the highest-end SKU of Quartus, Intel has
finally made a RISC-V core that integrates similarly, but we don't have that.

There are also obviously third-party soft cores, but in the interest of not
doing a massive hardware project, we chose not to do that, and just used the
Nios with C/C++ (it's GCC 10, it could be so much worse).

<aside>
This post was written against Quartus Prime Lite 20.1.1, running on a Linux
host. Bugs may have been fixed since, but dear lord do I ever not want to tempt
Quartus with breaking my stuff while mid-project.
</aside>

The implementation of a soft core on an FPGA involves creating memory blocks in
the FPGA for the memory of the device, which the processor then executes out
of. You thus need to get your program into there, and that means dealing with
Quartus pretty damn hard.

## Memory initialization

Memories on the FPGA can have defined initialization values, which is one way
of getting a program in, however, it's kind of a pain: for Nios, you have to
use the `mem_init_generate` Makefile target (which is ... variable amounts of
documented [in the "Embedded Design Handbook"][edh] buried pretty deeply), then
add the resulting `.qip` file to your Quartus project. Once you've added that,
you might think you would now recompile the project hopefully for the last time.

But no! That's not all! You actually have to turn on "Use smart compilation" in
Assignments>Settings>Compilation Settings, which will make Quartus consider the
actual changes when deciding which compilation stages to run. For some reason
this is off by default and it will just rerun everything from the beginning if
any input is changed. This setting corresponds to `set_global_assignment -name
SMART_RECOMPILE ON` in the `.qsf` file.

When you need to update the program but not the Quartus design, assuming that
your timestamps aren't all jacked up to make Quartus think you need a full
recompile, you can then use [either Processing > Update Memory Initialization
File or `quartus_cdb YOUR_TOPLEVEL_ENTITY --update-mif`][ram-init-hack] then
rerun the "Assembler" step to reuse the FPGA bits and write a new `.sof` with
the new software.

You can also assemble from the command line with `quartus_asm
--read_settings_files=on --write_settings_files=off YOUR_TOPLEVEL_ENTITY -c
YOUR_TOPLEVEL_ENTITY`.

[ram-init-hack]: https://tomverbeure.github.io/2021/04/25/Intel-FPGA-RAM-Bitstream-Patching.html

[edh]: https://www.intel.com/content/www/us/en/docs/programmable/683689/current/introduction-28202.html

## JTAG

Another way of getting your program into a soft core is to use JTAG. Intel
implements an [internal JTAG network][intel-jtag], which is quite neat but also
proprietary. For the most part, the only people actually supporting it are
Intel, though, and it requires custom support in the host-side debugger to
actually use. Thus, if you want to be able to use a debugger on your soft core
(which you definitely do if you have limited time), it's very much worth
picking one that has that.

Something that people do because getting the vendor debug stuff working is
troublesome is that they actually just put the JTAG pins out on a GPIO, which
definitely works but I don't have a debugger that would work with that.

There has been some motion on non-Intel soft cores supporting Intel JTAG:
[VexRiscv supports Intel JTAG][vexriscv-jtag] however it's not really
documented, and involves setting up SpinalHDL and Scala, which seems like too
high a risk for a school project, but might be worth looking into in the
future.

[intel-jtag]: https://tomverbeure.github.io/2021/10/30/Intel-JTAG-Primitive.html
[vexriscv-jtag]: https://github.com/SpinalHDL/VexRiscv/pull/276

## Nios II JTAG tools as a Kaizo game

It's true that you can upload a program with JTAG to a Nios II, but there is
precisely one way that actually works to do so, and it sucks.

You have to do a fun dance to successfully upload a program:

1. `make`
2. `nios2-download --stop main.elf`
3. `nios2-gdb-server --stop --tcpport 9002`
4. `gdb -ex 'target extended-remote :9002' ./main.elf`
5. Type `cont` in gdb.

Aaaand why would that be? Surely you can just run `nios2-download --go
main.elf`? Nope, that seems to leave memory blank and not actually start
the thing sometimes. *Surely* you could do `nios2-download --stop main.elf` and
then `nios2-download --go`? Nope that also didn't work and again seemed to
corrupt memory. The only way to get it to start is with the debugger.

<aside>

I tried to reproduce this issue while writing this post and struggled a lot to
do so.

I think that it only happens if you have memory initialized to something
invalid and a processor thus in an invalid state, then trying to write the
program to it. This was happening in practice because I was working with an
empty memory initialization file during early development, which may have
enabled this to break like this?

I simulated this by running the following in gdb:

```
set *(char [128]*) 0x60000 = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"`,
set $pc = 0x60000
```

Then I ran `nios2-download --go main.elf`. Indeed it seemed to not
bring up the system, so that is my suspicion of why I was having issues
reproducing it.

</aside>

Ah, but that's not all! Unfortunately, in my version of Quartus, the developers
of nios2-gdb-server (closed source) done did a mistake. Quoth `man 7 ip`:

> A TCP local socket address that has been bound is unavailable for some
> time after closing, unless the SO_REUSEADDR flag has been set. Care
> should be taken when using this flag as it makes TCP less reliable.

Well, that sure is an interesting quotation, because `nios2-gdb-server` states
"address in use" if you have just stopped it last less than 30 seconds ago on
the same port. Looks like someone forgot to `setsockopt(sock, SO_REUSEADDR)`.
So you have to play port musical-chairs when doing quick iterations. Fun!

## Nios II Eclipse

No.

(I have tried *surprisingly* hard, especially given that it is Vendor Eclipse,
but it does not work on my machine (segfault; hard to get the right Eclipse
release; templates don't show up; etc etc), and it is Vendor Eclipse. More
vendor software in my critical path is not my idea of fun, I have too much
already)

## A surprising non-bug appears!

```
Warning (113015): Width of data items in "soc_system_nios_memory.hex" is greater than the memory width. Wrapping data items to subsequent addresses. Found 4096 warnings, reporting 10
```

This message is what you get when you attempt to load a hex file generated by
Intel's own Nios toolchain using the `make mem_init_generate` target.

Now, why would that be? The [Intel HEX file][hex] that Intel's toolchain
generates looks like the following (I added some spaces to distinguish the
fields):

[hex]: https://en.wikipedia.org/wiki/Intel_HEX

```hex
:02 0000 02 0000 FC
:20 0000 00 00400074084062140800683A0000000000000000000000000000000000000000 C4
:20 0008 00 DEFFED04DFC00015D8400215D8800315D8C00415D9000515D9400615D9800715 6A
:20 0010 00 D9C00815000B307ADA000915DA400A15DA800B15DAC00C15DB000D15DB400E15 C4
:20 0018 00 DB800F15DBC01015D9401115EBFFFF04DBC012150009313A2880004C10000326 FA
:20 0020 00 2000022600100FC000000706DF401215E8BFFF17E93FFF04001016401000021E C8
```

What *is* this thing? Well, as may be visible by looking briefly at it, it
contains more than 8 bytes of hex per line, so something is fishy, since HEX
files are typically byte addressed, yet addresses here are only going up by 8!
It turns out this is a *word addressed* Intel HEX file with 32 bit words, and
they stuffed eight of em on a line. Wat.

More excitingly, `srec_cat` and similar tools don't understand that this strange
thing exists: it seems a parallel invention of the same cursed idea [has
occurred at TI and baffled some forum posters there as well][ti-lol].

Alright, so then why is it complaining about this? I guess, it is because it is
overwriting words 1 through 7 with line 2, but that's actually not a problem
since each location only receives one value in practice.

All of this said, this warning is actually fine. I had thought that this was
broken, but I must have stepped on a different rake and thought it was this:
I've generated programming files with both versions and confirmed that both
loaded correct code.

Someone [reported this on the Intel forum 9 years ago][intel-lol]. I found that
you can create hex files that don't irritate Quartus by doing something like
`make elf2hex_extra_args=--record=4 mem_init/soc_system_nios_memory.hex`, which
generates 4-byte records, but much more of them.

[ti-lol]: https://e2e.ti.com/support/microcontrollers/c2000-microcontrollers-group/c2000/f/c2000-microcontrollers-forum/268539/f28069-hex2000-memwidth-and-hex-parser
[intel-lol]: https://community.intel.com/t5/Intel-Quartus-Prime-Software/warning-with-on-chip-memory-data-items-width/m-p/57088

## Sticking it on a device

Of course, you can use the Quartus programmer to load the file via JTAG but
this isn't suitable for devices that need to be put out and then just work
thereafter: it's tethered to a computer.

I intend to write more about this later, since there is much more to say, but
briefly, software on the hard processor on the FPGA such as U-Boot and also
Linux (with the right device tree) can program the FPGA fabric. This is quite
useful since it lets you deploy the gateware together with the software.

Alternatively, this can be sequenced the other way: the FPGA fabric loads a raw
bitstream image off of SPI flash, then the hard processor, if used, boots off
the FPGA fabric. This is a much stranger mode, and is outside the scope of this
post.

To do this, you need to generate a `.rbf` (raw binary file) file from the `.sof`
programming file. Quartus has a (somewhat confusing) "Convert programming files" button in the File
menu, but it can be done at the command line with `quartus_cpf -c
output_files/youroutputfile.sof youroutputfile.rbf`.

Then in U-Boot, for example, you would use something like `ext4load mmc 0:2
${loadaddr} /boot/yourfile.rbf` then `fpga load 0 ${loadaddr} ${filesize}`.

It is actually possible to generate a `.rbf` file with Quartus automatically,
but it doesn't actually work on my machine. Whatever it was generating did not
work, whereas the one from `quartus_cpf` did. On different versions of Quartus
than mine (different editions??), there is a setting in the
Assignments>Settings>Assembler which enables this, but I had to uhhhh run
`strings` on random Intel binaries until I found the setting:
`set_global_assignment -name GENERATE_RBF_FILE ON`. If your Quartus doesn't
have the GUI toggle it may well be for a reason.

## Conclusion

Most of the difficulty in the hardware parts of this project were all of the
ways to step on a rake due to a number of Intel bugs, which seem to reproduce
in unclear conditions.

This combines really infuriatingly with fragile recompilation
checking in Quartus and 6 minute compiles. Worse, 8 minutes if you also have to
regenerate Platform Designer files! Don't add your `.qsys` file to your Quartus
project if you don't like eating this every compile. That, and the Makefile for
the Nios II board support package will check the modification time of the
`.sopcinfo` file against something else and make you regenerate the BSP,
possibly for no reason, as bonus broken recompilation checking.

I don't think that this is a case of Intel being uniquely bad (although having
their JTAG stuff being closed source makes it so so much worse since I can't
fix it myself) as much as this is how embedded tools tend to be like.

