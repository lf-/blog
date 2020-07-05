+++
date = "2020-07-05"
draft = false
path = "/blog/nix-and-haskell"
tags = ["nix", "haskell"]
title = "Using Nix to build Haskell"
featuredImage = ""
+++

As part of my job, I work on an open source Haskell codebase that sucks to
build. This makes it harder for new contributors to get started, so I want to
simplify it. Further, I have to deploy this software somewhere, and it appears
that the simplest thing to do that is Nix's docker support, meaning I have to
actually start building this thing with Nix.

I think the biggest realization that there was to make is that the Nix packages
is better documented if you just read the source code, and to that end I will
link to function definitions with their doc comments when possible.

Here's a Cliff's notes on how all the pieces of the Haskell infrastructure fit
together:

You use `cabal2nix` to generate nix files for each Haskell package in the
project. These nix files can then be picked up with
[`lib.callPackage`](https://github.com/NixOS/nixpkgs/blob/b63f684/lib/customisation.nix#L96-L121)
in your package overrides or overlay for the given compiler version:

```nix
with pkgs = import <nixpkgs> {
  config = {
    packageOverrides = pkgs: rec {
      haskell = pkgs.haskell // {
        packages = pkgs.haskell.packages // {
          "${ghc}" = pkgs.haskell.packages."${ghc}".override {
            overrides = self: super: rec {
              Pkg1 = super.callPackage ./Pkg1/Pkg1.nix { };
            };
          };
        };
      };
    };
  };
}; Pkg1
```

I have the bonus fun of working with GHCJS. Mostly, this means that unit tests
are all broken and freeze the Nix build process, though at least GHCJS actually
works on Nix!! You can override `mkDerivation` to disable most of them (some
may be overridden in nixpkgs itself to only run tests on some architectures and
did not account for GHCJS themselves and you can use
[`haskell.lib.dontCheck`](https://github.com/NixOS/nixpkgs/blob/32c8e79/pkgs/development/haskell-modules/lib.nix#L106-L109)
on those):

```nix
# inside the config.packageOverrides.haskell.packages.${compiler}.overrides function set
mkDerivation = args: super.mkDerivation (args // {
  doCheck = false;
  enableLibraryProfiling = false;
});
```

If you want to split the overlays into multiple files, you can make each file
return its respective overlay, and import nixpkgs with those overlays.
