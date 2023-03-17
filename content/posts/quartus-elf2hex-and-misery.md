+++
date = "2023-03-14"
draft = true
path = "/blog/quartus-elf2hex-and-misery"
tags = ["quartus", "fpga"]
title = "Quartus, elf2hex, bugs, and misery"
+++

I have been working on a school project, which uses Intel FPGAs and the
proprietary Intel Quartus toolchain. One of the components in the design we're
building is a Nios II embedded processor, which is Intel's weird proprietary
soft-core. In newer versions of the highest-end SKU of Quartus, Intel has
finally made a RISC-V core that integrates similarly, but we don't have that.

There are also obviously third-party soft cores, but in the interest of not
doing a massive hardware project, we chose not to do that, and just used the
Nios with C (it's GCC 10, it could be so much worse).

The implementation of a soft core on an FPGA involves creating memory blocks in
the FPGA for the memory of the device, which the processor then executes out
of. You thus need to get your program into there.

## Memory initialization

Memories on the FPGA can have defined initialization values, which is one way
of getting a program in, however, it's kind of a pain: for Nios, you have to
use the `mem_init_generate` Makefile target (which is ... variable amounts of
documented [in the "Embedded Design Handbook"][edh] buried pretty deeply), then
add the resulting `.qip` file to your Quartus project. Once you've added that,
recompile the project hopefully for the last time.

When you need to update the program but not the Quartus design, assuming that
your timestamps aren't all jacked up to make Quartus think you need a full
recompile, you can then use [either Processing > Update Memory Initialization
File or `quartus_cdb YOUR_TOPLEVEL_ENTITY --update-mif`][ram-init-hack] then
rerun the "Assembler" step to reuse the FPGA bits and write a new `.sof` with
the new software.

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

## Problems, 9 year old bugs in Quartus, and misery

https://community.intel.com/t5/Intel-Quartus-Prime-Software/warning-with-on-chip-memory-data-items-width/m-p/57088

