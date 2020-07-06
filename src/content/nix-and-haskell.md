+++
date = "2020-07-05"
draft = false
path = "/blog/nix-and-haskell"
tags = ["nix", "haskell"]
title = "Using Nix to build Haskell"
featuredImage = ""
+++

As part of my job working on an open source textbook, I work on a Haskell
codebase that sucks to build. This makes it harder for new contributors to get
started, so I want to come up with a better build process. Further, I have to
deploy this software somewhere, and it appears that the simplest thing to do
that is using Nix's docker support, meaning I have to actually start building
this thing with Nix.

The win with using Nix is that we can pin the main repositories at a certain
version such that we are certain it builds, as well as know that our dependency
versions are the same between compilations. Also, some dependency packages are
cached, saving compilation time.

Nix is unlike a lot of software systems I've learned: the amount of knowledge
you need to stuff in your head at all times is rather unfortunate due to a lack
of IDE tooling, and you genuinely need to put in the time to learn it properly,
especially the language, in order to not fall flat on your face while doing
interesting things with it. There are few opportunities to copy and paste
configuration from elsewhere. It is not a Turing tarpit, but it is definitely
Turing complete, exponentially increasing the complexity of using it due to the
lack of limitations.

I think the biggest realization I made doing this is that the Nix packages is
better documented if you just read the source code, and to that end I will link
to function definitions with their doc comments when possible.

Here's a Cliff's notes on how all the pieces of the Haskell infrastructure I
used fit together:

You use `cabal2nix` to generate nix files for each Haskell package in the
project. These nix files can then be picked up with
[`lib.callPackage`](https://github.com/NixOS/nixpkgs/blob/b63f684/lib/customisation.nix#L96-L121)
in an overlay:

```nix
{ ghcjs ? "ghcjs", compiler ? "ghc865" }:
  self: super:
  let overrideCabal = super.haskell.lib.overrideCabal;
  in {
    haskell = super.haskell // {
      packages = super.haskell.packages // {
        "${compiler}" = super.haskell.packages."${compiler}".override {
          overrides = newpkgs: oldpkgs: {
            Pkg1 = oldpkgs.callPackage ./Pkg1/Pkg1.nix { };
          };
        };
      };
    };
  }
```

I have the bonus fun of working with GHCJS. Mostly, this means that unit tests
are all broken and freeze the Nix build process, though at least GHCJS actually
works on Nix, meaning I don't have to spend half a day trying to compile it
(unlike last time). You can override `mkDerivation` to disable most packages'
unit tests (some may be overridden in nixpkgs itself to only run tests on some
architectures and did not account for GHCJS themselves and you can use
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
return its respective overlay, and import nixpkgs with those overlays:

```nix
{ compiler ? "ghc865",
  ghcjs ? "ghcjs"
}:
  let nixpkgs = import (builtins.fetchTarball {
        name = "nixpkgs-20.03-2020-06-28";
        url = "https://github.com/NixOS/nixpkgs/archive/f8248ab6d9e69ea9c07950d73d48807ec595e923.zip";
        sha256 = "009i9j6mbq6i481088jllblgdnci105b2q4mscprdawg3knlyahk";
      }) {
        overlays = [
          (import ./client.nix { inherit ghcjs; })
          (import ./server.nix { inherit ghcjs compiler; })
        ];
      };
  in {
    client = nixpkgs.haskell.packages."${ghcjs}".Pkg1;
    server = nixpkgs.haskell.packages."${compiler}".Pkg2Server;
  }
```

