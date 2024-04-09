+++
date = "2024-04-02"
draft = true
path = "/blog/pinning-packages-in-nix"
tags = ["nix"]
title = "Pinning packages in Nix"
+++

Although Nix supposedly makes pinning things easy, it really does not seem so:
it is not possible to simply write `package = "^5.0.1"` in some file somewhere
and get *one* package pinned at a specific version. Though this is frustrating,
there is a reason for this, and it primarily speaks to how nixpkgs is a Linux
distribution and is unlike a standard language package manager.

This post will go through the ways to pin a package to some older version and
why one would use each method.

## FIXME
mention that these methods can generally be overlayed. mention that overlaying
*across different nixpkgs* is probably a bad idea

# Simply add an older version of nixpkgs

> Software regressed? No patches in master to fix it? Try 30-40 different
  versions of nixpkgs. An easy weeknight bug fix. You will certainly not regret
  pinning 30-40 versions of nixpkgs.

Unlike most systems, it is fine to mix versions of nixpkgs, although it will
likely go wrong if, e.g. libraries are intermingled between versions. But, if
one package is all that is necessary, one can in fact simply import another
version of nixpkgs.

This works because binaries from multiple versions of nixpkgs can coexist
on a computer and simply work. However, it can go wrong if they are loading
libraries at runtime, especially if the glibc version changes, especially if
`LD_LIBRARY_PATH` is involved. That failure mode is, however, rather loud and
obvious if it happens.

For example:

```nix
let
  pkgs1Src = builtins.fetchTarball {
    # https://github.com/nixos/nixpkgs/tree/nixos-23.11
    url = "https://github.com/nixos/nixpkgs/archive/219951b495fc2eac67b1456824cc1ec1fd2ee659.tar.gz";
    sha256 = "sha256-u1dfs0ASQIEr1icTVrsKwg2xToIpn7ZXxW3RHfHxshg=";
    name = "source";
  };

  pkgs2Src = fetchTarball {
    # https://github.com/nixos/nixpkgs/tree/nixos-unstable
    url = "https://github.com/nixos/nixpkgs/archive/d8fe5e6c92d0d190646fb9f1056741a229980089.tar.gz";
    sha256 = "sha256-iMUFArF0WCatKK6RzfUJknjem0H9m4KgorO/p3Dopkk=";
    name = "source";
  };

  pkgs1 = import pkgs1Src { };
  pkgs2 = import pkgs2Src { };

in
{
  env = pkgs1.buildEnv {
    name = "env";
    paths = [ pkgs1.vim pkgs2.hello ];
  };

  vim1 = pkgs1.vim;
  vim2 = pkgs2.vim;
}
```

Here we have an environment which is being built out of packages from two
different versions of nixpkgs, so that `result/bin/hello` is from `pkgs2` and
`result/bin/vim` is from `pkgs1`. This can equivalently be done for
`environment.systemPackages` or similar such things: to get another version of
nixpkgs into a NixOS configuration, one can:

- For flakes, one can inject the dependency [in some manner suggested by
  "Flakes aren't real"][flakes-arent-real]. Or, one can do the
  `builtins.fetchTarball` thing above.
- For non-flakes, one can do the `builtins.fetchTarball` thing shown above, or
  add another input in [`npins`][npins]/Niv/etc, or add a second channel
  (though we suggest migrating NixOS configs using channels to npins or
  flakes so that the nixpkgs version is tracked in git).

[flakes-arent-real]: https://jade.fyi/blog/flakes-arent-real/
[npins]: https://github.com/andir/npins

```
 » nix-build -A env /tmp/meow.nix
/nix/store/zilav8lqqgfgrk54wg88mdwq582hqdp9-env

~ » ./result/bin/hello --version | head -n1
hello (GNU Hello) 2.12.1

 » ./result/bin/vim --version | head -n3
VIM - Vi IMproved 9.0 (2022 Jun 28, compiled Jan 01 1980 00:00:00)
Included patches: 1-2116
Compiled by nixbld

 » nix eval -f /tmp/meow.nix vim1.version
"9.0.2116"

 » nix eval -f /tmp/meow.nix vim2.version
"9.1.0148"
```

<dl>
<dt>Difficulty</dt>
<dd>Very easy</dd>
<dt>Rebuilds</dt>
<dd>
None, but will bring in another copy of nixpkgs and any dependencies (and
transitive dependencies).
</dd>
</dl>

# Vendor the package

Another way to pin one package is to vendor the package definition of the
relevant version. The easiest way to do this is to find the version of nixpkgs
with the desired package version and then copy the `package.nix` or
`default.nix` or such into your own project, and then call it with
`callPackage`.

<dl>
<dt>Difficulty</dt>
<dd>Slight effort</dd>
<dt>Rebuilds</dt>
<dd>
None, but will bring in another copy of nixpkgs and any dependencies (and
transitive dependencies).
</dd>
</dl>

# Patch the package with overrides

maybe explain what .override does

## Limitations

go and rust bustedness
link to the architecture issue

# Patch a NixOS module

disable modules thing

# Patch the base system without a world rebuild

xz etc

