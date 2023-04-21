+++
date = "2023-04-20"
draft = true
path = "/blog/i-built-a-meowzor"
tags = []
title = "I built a Meowzor robot for class"
+++

As part of the requirements for the third year design studio class for Computer
Engineering at UBC, I worked on a group project using a FPGA, electronics, and
other pieces. We had to pick a project idea and then build it in a 4 month term
as a group of 3 or 4 (we were 3). The group I was in built a robot called
Meowzor that points a laser in front of a cat, using an object detection model
to find where the cat is and commanding the laser robot accordingly.

You can see our presentation video here:

<iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/JyZmC07ff0Q" title="YouTube video player" frameborder="0" allow="clipboard-write; picture-in-picture; web-share" allowfullscreen></iframe>

This is the robot itself:

{% image(name="meowzor-board.jpg", colocated=true) %}
Piece of plywood with a DE1-SoC development board on it next to a breadboard
with stepper drivers and a 3d printed assembly with a rotation/pitch stage.
{% end %}

The piece I worked was all the robotics parts: the boundary is at the API layer
between the robot and the cat-detection service, accepting move-to commands
over HTTP. This meant that I wore a lot of hats, from Rust and embedded linux
to FPGA dev, electronics and mechanical engineering. It also meant that I had
to make decisions to avoid as much hard complexity as possible in order to ship
this much stuff on time.

This is the architecture diagram of the hardware components:

{% image(name="hw-arch-diagram.svg", colocated=true, process=false) %}
Architecture diagram of the hardware. First commands come in via protobuf HTTP
API, then they're processed by the meowzor-control daemon, which is attached to
a Nios II microcontroller with shared memory and a mailbox. The Nios has a PIO
connected to the stepper drivers.
{% end %}

We use stepper motors because they are precise, pretty fast, cheap, and easy to
integrate with.

The overall design is that `meowzor-control` receives position requests,
generates step schedules, then gives them to the Nios II firmware to execute.

## Hardware

In my program we use a DE1-SoC Intel Cyclone V FPGA development board for
pretty much everything, and everyone has one. This board has these relevant
features:

* Cortex-A9 dual core hard processor
* 1GB DDR3 memory
* More FPGA than you need
* Ethernet
* GPIOs attached to the FPGA fabric

My goal was to make the hardware and firmware as simple as possible because
they suck to work on, with the most basic FPGA system taking 6 minutes to
synthesize with Intel Quartus. The less time I am waiting for a compiler, the
more sane I will be. Firmware sucks slightly less to work on, but is also a
[wreck of a mess][quartus-bad] due to Intel tools, and the Nios II only can run
C/C++ due to the LLVM port being dead.

RISC-V would be viable if it weren't for the requirement to integrate nicely
with the Intel tools. It looks like there's [some movement on making this
work][riscv-demos], but I didn't want to take the risk on it. Intel itself has
[made a RISC-V Nios processor][nios-v], but I was under the (apparently false?)
impression that it was not available except in Quartus Pro licenses which we
don't have.

[riscv-demos]: https://github.com/ARIES-Embedded/riscv-on-max10
[nios-v]: https://www.intel.com/content/www/us/en/products/details/fpga/nios-processor/v.html

[quartus-bad]: https://jade.fyi/blog/quartus-elf2hex-and-misery/

Thus, what I did with the hardware is to try to shove everything nontrivial
up-stack as much as possible. I used a soft core, the Nios II, to generate step
signals, since it is easy to integrate with Quartus Platform Designer (Qsys) and
thereby spend less energy on hardware. Platform Designer deals with all the annoying pieces of
putting together a computer system such as address decoding and other kinds of
wiring things up.

{% image(name="qsys.png", colocated=true) %}
The main view of Platform Designer, listing components and showing connections
between them, as well as memory mappings. There are two general groups of
things: the hard processor and the soft core, which have distinct memory maps.
The hard processor is attached to the shared memory and a mailbox component,
and the soft core is attached to its own private memory, the shared memory, the
mailbox, a timer, and a programmable IO block.
{% end %}

In the end basically all of the hardware is just the reference design from the
DE1-SoC materials and various integration in Platform Designer, which is a win
because I mostly didn't have to debug it.

## Firmware

A mailbox in hardware is an inter-processor communication primitive: it takes a
memory address and a command from the sending processor and interrupts the receiving processor when
something new is received. The receiving processor can then take the address
out of the mailbox, copy the memory out, then empty it for the next item.
Optionally the sending processor may be interrupted to inform it of it being
empty.

In the case of the Intel IP, the mailbox has a capacity of one item, and the
interrupt to the receiving processor doesn't work, at least in my version of
Quartus, so I just polled it (I may have screwed it up but I had bigger fish to
fry than to spend more time debugging it; I have 100MHz to work with, so it
does not matter one bit).

Mailboxes require that the receiving processor be able to read some kind of
memory in common with the sending processor, since they only send one pointer.
In this case I implemented it as shared memory, since I didn't want to write a
Linux driver to deal with finding the physical pages I wanted to receive from
or something like that.

The firmware for the Nios II accepts structures like this in shared memory when
signaled by the mailbox:

```c
typedef struct {
    CmdKind kind;
    Direction directions[N_MOTORS];
    uint16_t _pad;
    uint32_t delays[N_DELAYS];
} Cmd;
```

The delays are sent interleaved, with the motor ID in the top bit of them. As
soon as the mailbox receives a `Cmd`, the main thread copies it into a
(ring-buffer-based) queue in private memory and empties the mailbox. A timer
ISR checks the queue and looks at the top item. If the item is done, it
dequeues it. If not, it gets the next step in it, sets the direction, emits a
step pulse, then sets the timer to the time of the next step.

## Software

### `meowzor-control`

### NixOS port

The port is [available here](https://github.com/lf-/de1-soc-nixos).

Well, this is sure burying a lede. I ported NixOS to the board and it was a
*really really good idea* and saved me a load of time. It took about a week of
work on and off. The motivation for the NixOS port was that the board vendor
had last released a port of Ubuntu 18.04 and I would literally rather port a
new OS than deal with old OS versions and lack of config management and
inability to fix the image.

Then, there was no question of which OS I wanted to port: I wanted something I
could rip everything out of easily and patch anything arbitrarily if needed.
Theoretically I could have used Yocto but I looked at it briefly and it looked
kinda like Nix But With Extra Ways To Have Incremental Build Mistakes, and more
importantly I didn't want to learn it.

I read through the [Cyclone V GSRD][gsrd] (Golden Software Reference Design),
which is an Intel port of Yocto to another board based on the Cyclone V, which
should be very close to what I needed.

[gsrd]: https://www.rocketboards.org/foswiki/Documentation/CycloneVSoCGSRD

#### Background: Cyclone V SoC boot process

The Cyclone V SoC can boot in several different ways depending on how the
`BSEL` pins are configured. This is broken out to an unpopulated DIP switch on
the bottom of the DE1-SoC board, and the configured state is to boot off of an
SD card.

When reset is deasserted, a boot ROM on the hard processor performs early
hardware initialization, bringing up the CPU, and chain loading from some
storage, in this case, a partition of a specific MBR type on the SD card.

See the [Cyclone V Hard Processor System Technical Reference Manual][hps-trm],
appendix A, for more details on the early boot process.

[hps-trm]: https://www.intel.com/content/www/us/en/docs/programmable/683126/21-2/hard-processor-system-technical-reference.html

This partition contains the U-Boot SPL (second phase loader), which brings up
the DDR3 main memory, serial port, and some other hardware, before chain
loading into U-Boot itself.

The FPGA fabric configuration port is accessed in various ways depending on
how the `MSEL` mode selection pins are set. On the DE1-SoC board, they are
exposed as a DIP switch set on the bottom of the board. Note that surprisingly,
`MSEL[3:0] = 4'b0000`, which you want, means *all the switches set to
ON*. This setting corresponds to FPPx16 with no encryption (fast parallel
programming), which is what works with U-Boot.

From U-Boot, the FPGA configuration image may be loaded into the
configuration port. This can also be done through Linux at runtime using the
[FPGA Region][fpga-region-dt] device tree entry.

[fpga-region-dt]: https://elixir.bootlin.com/linux/latest/source/Documentation/devicetree/bindings/fpga/fpga-region.txt

U-Boot will then chain load Linux, which NixOS supports well, so the boot
process is very standard from there.

To get U-Boot to do so automatically, you need a snippet like the one below in
your U-Boot Kconfig file. This will load a script if present, then enable the
FPGA bridge, and boot Linux through the standard `extlinux.conf` mechanism.

```
CONFIG_USE_BOOTCOMMAND=y
CONFIG_BOOTCOMMAND="if ext4load mmc 0:2 ${scriptaddr} /boot/u-boot.scr; then source ${scriptaddr}; fi; bridge enable; run distro_bootcmd"
```

#### The port

The first order of business was to get a kernel that worked. I looked at the
GSRD, found the config I was supposed to use, then manually built a new kernel
with the checkout of the kernel sources.

I then put that kernel into the minimal image from the board vendor and
confirmed it booted. Success! Next, to build it with Nix.

Building a kernel with a custom config looks something like this in Nix ([full
version][kernel.nix]):

[kernel.nix]: https://github.com/lf-/de1-soc-nixos/blob/main/kernel.nix

```nix
{ stdenv, buildLinux, linuxKernel, ... } @ args:
let base = buildLinux { ... };
in linuxKernel.manualConfig {
  inherit stdenv;
  inherit (base) src version;
  configfile = ./socfpga_kconfig;
  allowImportFromDerivation = true;
}
```

It complained at build time about some missing options required by systemd, so
I added those manually to the Kconfig in my checkout and copied it back.

Next, U-Boot. This was not a fun time but not because of Nix. I built U-Boot
per the instructions on the GSRD guide, but using `socfpga_de1_soc_defconfig`
instead of the one for the different board. I replaced the U-Boot in the same
vendor image, and it would start, flash the transmit LED briefly, and not emit
anything over the serial port. Concerning.

After googling it a lot I wound up finding a forum thread about getting U-Boot
to work on the DE1-SoC, in which someone posted [a device tree patch][forum] to
set the clock frequency of the UART. I applied this patch to my U-Boot
development tree and, suddenly, console!! Rejoicing ensued before immediately
sending the patch upstream so this never happens to anyone else.

[forum]: https://forum.rocketboards.org/t/cyclonev-programming-fpga-from-u-boot/2230/14

At this point I knew both my U-Boot and Linux kernel worked, so it was time to
build a NixOS SD card image. This was one of the reasons I was excited to use
NixOS for this project: if an SD card fails, I can just make a new image in 30
seconds; the system image is totally disposable.

NixOS already has a [SD card image builder][sdimage-upstream] sort of
supporting U-Boot, but it does such support by leaving a gap to put U-Boot in
at the start of the disk after the fact. That wasn't quite satisfying enough
for me because setting partition types and dd'ing things is effort and also I
want to flash the image directly out of Nix.

I hacked this image builder up to [generate the correct partition
table directly][sdimage-hacked] and also copy the U-Boot SPL image into place.

[sdimage-upstream]: https://github.com/nixos/nixpkgs/blob/0c67f190b188ba25fc087bfae33eedcc5235a762/nixos/modules/installer/sd-card/sd-image.nix

[sdimage-hacked]: https://github.com/lf-/de1-soc-nixos/blob/aa4ee306ab5a63e2e838d4ca7d219165c9695c31/sd-image.nix#L184-L192

At this point I was pretty confident that my NixOS system was going to just
work when I booted it, since every part of the early boot was tested, so I just
had a go and it worked. For ten seconds. Until it reset itself.

I was suspicious of power issues or some horrible crime being done to the
hardware, so I removed the pieces surrounding the problematic time at boot such
as resizing the root partition. This changed nothing and eventually I noticed
it seemed to be based on *time* that the system was up. I got out a stop watch
and it was a round number. Immediately I put two and two together and realized
that Linux must not be correctly configured to pet the watchdog.

A quick comparison of the device trees used by the GSRD with the quite old ones
used by the upstream DE1-SoC port in U-Boot yielded some slightly different
watchdog configurations, so I just had a go and made them the same, added the
patch to my U-Boot Nix build, and rebuilt the image:

```patch
---
 arch/arm/dts/socfpga_cyclone5_de1_soc.dts | 4 ----
 1 file changed, 4 deletions(-)

diff --git a/arch/arm/dts/socfpga_cyclone5_de1_soc.dts b/arch/arm/dts/socfpga_cyclone5_de1_soc.dts
index b71496bfb5..1cef1c2e8a 100644
--- a/arch/arm/dts/socfpga_cyclone5_de1_soc.dts
+++ b/arch/arm/dts/socfpga_cyclone5_de1_soc.dts
@@ -78,7 +78,3 @@
 	clock-frequency = <100000000>;
 	u-boot,dm-pre-reloc;
 };
-
-&watchdog0 {
-	status = "disabled";
-};
--
```

..... and it works:


{% image(name="it-boots.png", colocated=true) %}
Screenshot of a terminal showing the NixOS 23.05 prerelease NixOS booted to the
login prompt on an armv7l-linux. Some lines above show "socfpga-dwmac" related
ethernet messages.
{% end %}
