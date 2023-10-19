+++
date = "2023-10-19"
draft = false
path = "/blog/pulling-apart-dell-uefi"
tags = ["uefi"]
title = "Pulling apart Dell UEFI images and messing with ACPI"
+++

This is a quick post to write down the method that worked for me to acquire and
pull apart a Dell UEFI image to get the executables out, and how to poke at
ACPI.

The specific issue I was curious about and trying to find more information
about is the [`rtsx` card reader NVMe regression][rtsx-explanation] on the Dell
XPS 15 9560, which is the laptop I use.

[rtsx-explanation]: https://lore.kernel.org/regressions/c7bdd821686e496eb31e4298050dfb72@realtek.com/

The regression was caused by the card reader driver no longer setting a
register that forces the PCIe `CLKREQ#` pin to be always pulled low, which was,
in effect, making the kernel no longer ask the chipset for PCIe clock all the
time.

However, this is even more confusing, because this is essentially a
force-disabling bit for attempting to do PCIe ASPM, which was never enabled in
the first place on the machine!

For *some reason*, the *card reader* ceasing to ask the chipset for clock all
the time (which, given that ASPM is purportedly disabled in the ACPI tables,
should be a no-op!) caused the *NVMe SSD*, which has nothing to do with the
card reader, to lose its PCIe link after the card reader driver loads. Further,
this happened to every kind of SSD, so it must be some kind of platform bug.

If you have any ideas of why this is happening, send me an email at &lt;bug at jade
dot fyi&gt;, I am very curious.

# Extracting the firwmare

I acquired a copy of the firmware [from fwupd here][fwupd]. This is a
Microsoft cabinet file. I then used [BIOSUtilities] and p7zip to extract it:

[fwupd]: https://fwupd.org/lvfs/devices/com.dell.uefi34578c72.firmware

```
mkdir bios
mv ../4d77eabfe13e3d153dfe9f19b570de40cc90260ef7229b2ca070e06b5c840040-Dell_XPS_15_9560_Precision_5520_System_BIOS_Ver.1.24.0.cab bios
(cd bios; 7z x *.cab)
python Dell_PFS_Extract.py -i bios -o bios_ex
```

This then produces some files:

```
BIOSUtilities » ls bios_ex/firmware.bin_extracted/Firmware/1\ firmware\ --\ *
'bios_ex/firmware.bin_extracted/Firmware/1 firmware -- 1 System BIOS with BIOS Guard v1.24.0.bin'
'bios_ex/firmware.bin_extracted/Firmware/1 firmware -- 2 Embedded Controller v1.0.29.bin'
'bios_ex/firmware.bin_extracted/Firmware/1 firmware -- 3 Intel Management Engine (VPro) Update v11.8.86.3877.bin'
'bios_ex/firmware.bin_extracted/Firmware/1 firmware -- 4 Main System TI Port Controller 0 v7.0.0.31.bin'
'bios_ex/firmware.bin_extracted/Firmware/1 firmware -- 5 System Board Map v1.0.1.bin'
'bios_ex/firmware.bin_extracted/Firmware/1 firmware -- 6 PCR0 XML v0.0.0.1.xml'
'bios_ex/firmware.bin_extracted/Firmware/1 firmware -- 7 Model Information v1.0.0.0.txt'
```

[BIOSUtilities]: https://github.com/platomav/BIOSUtilities

From here, you can use UEFITool on these files:

```
UEFITool firmware.bin_extracted/Firmware/1\ firmware\ --\ 1\ System\ BIOS\ with\ BIOS\ Guard\ v1.24.0.bin
```

From here you can go hunting through the data in there or try `UEFIExtract`.

You can find a PE32 image called Setup somewhere in the UEFI image, and extract
it. With such an image, you can use [`ifrextractor`][ifrextractor] to pull out
the BIOS options. Acquire a copy like so:

[ifrextractor]: https://github.com/LongSoft/IFRExtractor-RS

`ifrextractor.nix`:

```nix
{ rustPlatform, fetchFromGitHub }:
rustPlatform.buildRustPackage {
  pname = "ifrextractor";
  version = "0.0.1";
  src = fetchFromGitHub {
    owner = "longsoft";
    repo = "ifrextractor-rs";
    rev = "f40b9be0da561ede62f3988072100550a73d5386";
    sha256 = "sha256-No0H91iMcOQlE0Hcc+w02w5CP3M+Ixct+92+XsreIik=";
  };
  cargoSha256 = "sha256-smVHEBhjUcy4ApyJzhV31sMTB87Cdq59fxkSJsS1/cw=";
}
```

```
nix-build -E 'with import <nixpkgs> {}; callPackage ./ifrextractor.nix'
```

Then extract the setup stuff with the following:

```
ifrextractor firmware.bin_extracted/Section_PE32_image_Setup_body.efi
```

Then read the extremely large file named like:
`Section_PE32_image_Setup_body.efi.0.0.en-US.ifr.txt`.

If you *did* want to tamper with hidden settings, you could potentially have
such bad ideas with similar methods to the following (please take a backup of
the NVRAM first to not brick your computer!):

* <https://ristovski.github.io/posts/inside-insydeh2o/#peeking-inside-the-bios-image>
* <https://hansdegoede.livejournal.com/25413.html>

If you want to stick the thing in Ghidra, there does [exist an extension,
efiSeek][efiSeek], but I couldn't really tell if it was providing any useful
analysis results.

[efiSeek]: https://github.com/DSecurity/efiSeek

# ACPI

In investigating the power management issue I was curious about, I wanted to
understand what was in the ACPI tables and what was going on. These tables are
probably somewhere in the UEFI image as well, but I am not sure where.

You can dump the ACPI tables from a running system using `acpidump` from `acpica-tools`:

```
mkdir acpi && cd acpi
sudo acpidump -b
iasl -d *.dat
```

If you want to get values of ACPI variables, you can use the [ACPI
debugger][acpidbg] from the Linux kernel distribution:

[acpidbg]: https://docs.kernel.org/firmware-guide/acpi/aml-debugger.html

First, enable the right Kconfig options:

```nix
{ lib, config, ... }: {
  boot.kernelPackages = pkgs.linuxPackages.extend (self: super: {
    kernel = super.kernel.override (old: {
      kernelPatches = old.kernelPatches ++ [
        {
          name = "acpi_nonsense";
          patch = null;
          extraStructuredConfig = with lib.kernel; {
            ACPI_DEBUGGER = yes;
            ACPI_DEBUGGER_USER = module;
            DEVMEM = yes;
            STRICT_DEVMEM = no;
            IO_STRICT_DEVMEM = option no;
          };
        }
      ];
    });
  });
}
```

Then:

```
cd some-linux-sources
make acpi
sudo ./power/acpi/acpidbg
```

Inside the debugger you can print out things:

```
- Evaluate UCSI
Evaluating \UCSI
Evaluation of \UCSI returned object 00000000a57a6a95, external buffer length 18
 [Integer] = 0000000000000000
```

You can also use `Dump` to get information about a variable, such as its
offset, if you need to peek/poke the memory.

---

If you want to tamper with the ACPI tables for investigating a potential fix,
there are a couple of ways to do it.

At runtime, you can [load an overlay][overlay]:

```
modprobe acpi_configfs
cd /sys/kernel/config/acpi/table/
mkdir my-ssdt ; cat ~youruser/somewhere/my-ssdt.aml > my-ssdt/aml

# unload with:
rmdir my-ssdt
```

[overlay]: https://www.kernel.org/doc/html/latest/admin-guide/acpi/ssdt-overlays.html

It's also possible to replace the ACPI tables [with the initrd][initrd-acpi]:
Create a cpio archive with `kernel/firmware/acpi/*.dat`, then prepend it to the
actual initrd.

[initrd-acpi]: https://docs.kernel.org/admin-guide/acpi/initrd_table_override.html

# Conclusion

This whole affair did not achieve much, but it was very interesting, and I have
more of an idea how firmware works on x86.

For further information:
- [ACPI Spec][https://uefi.org/sites/default/files/resources/ACPI_Spec_6_5_Aug29.pdf]

There may also exist schematics of the machine online, but I cannot confirm
this.

