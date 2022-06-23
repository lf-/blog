+++
date = "2022-06-21"
draft = false
path = "/blog/nixos-disk-images-m1"
tags = ["nix", "nixos"]
title = "Adventures in building disk images of NixOS virtual machines for M1"
+++

I work in a thoroughly Nix-based environment, and sometimes I need to test
NixOS things, but I have a Mac at work. So, time to get a NixOS VM going on the
M1, I guess! This was a partially-planned adventure.

People I know have been saying good things about the (mostly) qemu wrapper
[UTM] ([also on GitHub here][utm-github]), so that was the tool of choice.

[UTM]: https://mac.getutm.app/
[utm-github]: https://github.com/utmapp/UTM

I kind of didn't realize there were [normal installer images that would
absolutely just work][images-lol] (since UTM implements UEFI by default), so I
tried a more fun option: just build the root filesystem offline and import it.

[images-lol]: https://nixos.wiki/wiki/NixOS_on_ARM/UEFI#Getting_the_installer_image_.28ISO.29

To do this, you will need a Linux machine with Nix and the capacity to execute
aarch64 binaries, either by emulation with binfmt-misc and qemu-user on Linux,
or natively because you have an aarch64-linux computer with Nix on it. I have
the latter because Oracle Cloud [apparently just gives away 24GB memory aarch64
instances for free][oracle-lol].

[oracle-lol]: https://www.oracle.com/ca-en/cloud/free/#always-free

NixOS has infrastructure for building disk images of systems, so it's more or
less a case of doing it, with the correct configuration.

The config for the bootloader is also [documented on the NixOS
wiki here][uefi-bootloader]. The listed config worked for me, which is:

[uefi-bootloader]: https://nixos.wiki/wiki/NixOS_on_ARM/UEFI#Bootloader_configuration

```nix
{ ... }: {
  boot.loader.grub = {
    efiSupport = true;
    efiInstallAsRemovable = true;
    device = "nodev";
  };
}
```

Notable things about the hardware UTM configures by default:

* Ethernet: enp0s5, with the host at 192.168.64.1/24 and the guest receiving an
  IP via DHCP (probably 192.168.64.2)
* Disk: root on vda2, boot on vda1

It's a QEMU VM so everything is virtio; NixOS provides a configuration to get
all the necessary modules, which you can import at
`(modulesPath + "/profiles/qemu-guest.nix")`.

Here's the configuration I used:

{{ codefile(path="./configuration.nix", code_lang="nix", colocated=true, hide=true) }}

Build with:

```
$ nix-build -I "nixpkgs=channel:nixos-22.05,nixos-config=$(pwd)/configuration.nix" \
    '<nixpkgs>/nixos' -A config.system.build.image
```

## Creating a VM

To do this, create a VM, selecting the "Other" type:

{% image(name="./1-os-dialog.png", colocated=true) %}
Screenshot of the UTM operating system selection dialog, in which macOS, Linux,
Windows, and Other are listed.
{% end %}

Then disable ISO boot, since we don't need an installer where we're going.

{% image(name="./2-disable-iso-boot.png", colocated=true) %}
Dialog in UTM: "disable ISO boot" checkbox checked
{% end %}

Finish setting up the VM, don't worry about the disk size since we will
immediately delete it. Select "Open VM Settings" on the summary page so you can
do that.

{% image(name="./3-open-vm-settings.png", colocated=true) %}
UTM VM creation summary dialog with "Open VM Settings" box checked
{% end %}

Then select the disk and delete it:

{% image(name="./4-delete-volume.png", colocated=true) %}
Screenshot of the VM settings showing the delete button of the disk selected in
the sidebar.
{% end %}

Finally, create a new disk, selecting import to get the newly built root
filesystem image from Nix:

{% image(name="./5-import-image.png", colocated=true) %}
Screenshot of the "create disk" dialog, with the import button visible.
{% end %}
