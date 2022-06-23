{ config, modulesPath, pkgs, lib, ... }:
{
  imports = [ (modulesPath + "/profiles/qemu-guest.nix") ];

  networking.hostName = "thinnix";
  networking.useDHCP = false;
  networking.interfaces.enp0s5.useDHCP = true;

  users.users.root.initialPassword = "changeme";

  boot.kernelParams = ["console=ttyAMA0,115200n8" "console=tty0"];
  boot.consoleLogLevel = lib.mkDefault 7;

  boot.growPartition = true;
  # not sure if needed
  boot.initrd.kernelModules = [ "nvme" ];
  boot.loader.grub = {
    efiSupport = true;
    efiInstallAsRemovable = true;
    device = "nodev";
  };

  fileSystems."/" = { device = "/dev/vda2"; fsType = "ext4"; };
  fileSystems."/boot" = { device = "/dev/vda1"; fsType = "vfat"; };

  nixpkgs.localSystem.system = "aarch64-linux";

  system.build.image = import <nixpkgs/nixos/lib/make-disk-image.nix> {
    diskSize = 10000;
    format = "qcow2-compressed";
    installBootLoader = true;
    partitionTableType = "efi";
    inherit config lib pkgs;
  };

  # This value determines the NixOS release from which the default
  # settings for stateful data, like file locations and database versions
  # on your system were taken. It‘s perfectly fine and recommended to leave
  # this value at the release version of the first install of this system.
  # Before changing this value read the documentation for this option
  # (e.g. man configuration.nix or on https://nixos.org/nixos/options.html).
  system.stateVersion = "21.11"; # Did you read the comment?
}
