+++
date = "2020-07-16"
draft = false
path = "/blog/nix-and-haskell"
tags = ["nix", "haskell"]
title = "Using Nix to build multi-package, full stack Haskell apps"
+++

This post has been updated on June 16 following the finalization of the Nix
port.

As part of my job working on an [open source logic
textbook](https://carnap.io), I picked up a Haskell
codebase that was rather hard to build. This was problematic for new
contributors getting started, so I wanted to come up with a better process.
Further, because of legal requirements for public institutions in BC, I need to
be able to host this software in Canada, for which it would be useful to be
able to have CI and containerization (where it is directly useful to have an
easy to set up build environment).

The value proposition of Nix is that it ensures that regardless of who is
building the software or where it is being built, it is possible to ensure the
environment where this is done is exactly the same. It also makes it fairly
easy for users to set up that environment. Finally, it has a package *and
binaries* for GHCJS, which provides extraordinary time and effort savings by
avoiding the process of setting up dependencies for and compiling GHCJS.

A lot of the documentation around Nix is styled like programming documentation
rather than like packaging documentation, which makes it harder to figure out
where to start with packaging. For example, it is not really clear what exactly
the "correct" way to structure a multiple package Haskell project is: are you
supposed to use overlays, overrides or other methods? I chose to use overlays
based on the nixpkgs documentation's suggestions that they are the most
advanced (and thus modern?) way of putting stuff into nixpkgs.

The most significant tip I can give for doing Nix development and especially
reading other Nix package source code is that the best way of understanding
library calls is to read the nixpkgs source. This is for a couple of reasons:
for one, the user facing documentation seems to be less complete than the
documentation comments on functions, and often it is useful to read the library
function source alongside the documentation.

Usually I keep a tab in my neovim open to the nixpkgs source and use either
[nix-doc](https://github.com/lf-/nix-doc) or
[ripgrep](https://github.com/BurntSushi/ripgrep) to search for the function I
am interested in.

-----

This post summarizes the design decisions that went into implementing Nix for
this existing full stack app. If you'd like to read the source, it is
[available on GitHub](https://github.com/lf-/Carnap/tree/nix).

I have a top-level `default.nix` that imports nixpkgs with overlays for each
conceptual part of the application (this could all be done in one but it is
useful to separate them for maintenance purposes). A simplified version is
below:

```nix
{ compiler ? "ghc865",
  ghcjs ? "ghcjs"
}:
  let nixpkgs = import (builtins.fetchTarball {
        name = "nixpkgs-20.03-2020-06-28";
        url = "https://github.com/NixOS/nixpkgs/archive/f8248ab6d9e69ea9c07950d73d48807ec595e923.zip";
        sha256 = "009i9j6mbq6i481088jllblgdnci105b2q4mscprdawg3knlyahk";
      }) {
        config = {
          # Use this if you use 'broken' packages that are fixed in an overlay
          allowBroken = true;
        };
        overlays = [
          (import ./client.nix { inherit ghcjs; })
          (import ./server.nix { inherit ghcjs compiler; })
        ];
      };
  in {
    client = nixpkgs.haskell.packages."${ghcjs}".Client;
    server = nixpkgs.haskell.packages."${compiler}".Server;
  }
```


In each Haskell package, use `cabal2nix .` to generate nix files for the
package. These nix files can then be picked up with
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
            Common1 = oldpkgs.callPackage ./Common1/Common1.nix { };
            # ...
          };
        };
      };
    };
  }
```

## Shells

You could normally use
[`nixpkgs.haskell.packages.${ghcVer}.shellFor`](https://github.com/NixOS/nixpkgs/blob/c565d7c/pkgs/development/haskell-modules/make-package-set.nix#L288)
to construct a shell. However, this is not ideal for multiple package projects
since it will invariably make Nix build some of your projects because they are
"dependencies".

There does not appear to be any built in resolution for this. However,
[reflex-platform](https://github.com/reflex-frp/reflex-platform), has
integrated a module called
[`workOnMulti`](https://github.com/reflex-frp/reflex-platform/blob/20ed151/nix-utils/work-on-multi/default.nix).
I thus took the opportunity to extricate it from its dependencies on the rest
of reflex-platform to be able to use it independently. This extracted version
is [available here](https://github.com/lf-/Carnap/blob/cde2671/nix/work-on-multi.nix).

It can be used thus:

```nix
let # import nixpkgs with overlays...
  workOnMulti = import ./nix/work-on-multi.nix {
    inherit nixpkgs;
    # put whatever tools you want in the shell environments here
    generalDevTools = _: {
      inherit (nixpkgs) cabal2nix;
      inherit (nixpkgs.haskell.packages."${ghcVer}")
        Cabal
        cabal-install
        ghcid
        hasktags;
    };
  };
  in {
    ghcShell = workOnMulti {
      envPackages = [
        "Common1"
        "Common2"
        "Server"
      ];
      env = with nixpkgs.haskell.packages."${ghcVer}"; {
        # enable hoogle in the environment
        ghc = ghc.override {
          override = self: super: {
            withPackages = super.ghc.withHoogle;
          };
        };
        inherit Common1 Common2 Server mkDerivation;
      };
    };
  }
```

Then, you can use `nix-shell` with this attribute: `nix-shell -A ghcShell`.

Build with Cabal as usual (`cabal new-build all`), assuming you've built the
GHCJS parts already (see below).

## GHCJS

GHCJS breaks many unit tests such that they freeze the Nix build process. You
can override `mkDerivation` to disable most packages' unit tests. For some,
this does not work because nixpkgs puts test runs in a conditional already,
which causes the `mkDerivation` override to be ignored.
[`haskell.lib.dontCheck`](https://github.com/NixOS/nixpkgs/blob/32c8e79/pkgs/development/haskell-modules/lib.nix#L106-L109)
can be used to deal with these cases.

```nix
# inside the config.packageOverrides.haskell.packages.${compiler}.override call
mkDerivation = args: super.mkDerivation (args // {
  doCheck = false;
  enableLibraryProfiling = false;
});
```

To integrate the GHCJS-built browser side code with the rest of the project, a
[method inspired by
reflex-platform](https://github.com/reflex-frp/reflex-platform/blob/6ce4607/docs/project-development.rst)
is used. Namely, `nix-build -o client-out -A client` is used to build the
client and put a symbolic link in a known place, then manually created symbolic links are
placed in the static folder pointing back into this client output link.

For package builds, a [`preConfigure` script](https://github.com/lf-/Carnap/blob/cde2671/server.nix#L30-L36)
is used with
[`haskell.lib.overrideCabal`](https://github.com/NixOS/nixpkgs/blob/32c8e79/pkgs/development/haskell-modules/lib.nix#L11-L41)
to replace these links with paths in the Nix store for the browser JavaScript.
A dependency on the built JavaScript is also added so it gets pulled in.

## Custom dependencies

Larger projects have a higher likelihood of having dependencies on Hackage
packages that are not in nixpkgs, or absolutely need to be a specific version.
It's easy to integrate these into the nix project using `cabal2nix`:

```
$ cabal2nix cabal://your-package-0.1.0.0 | tee nix/your-package.nix
```

These can then be integrated into the project by using
[`lib.callPackage`](https://github.com/NixOS/nixpkgs/blob/b63f684/lib/customisation.nix#L96-L121).

While it is also possible to use
[`callCabal2nix`](https://github.com/NixOS/nixpkgs/blob/f5b6ea1/pkgs/development/haskell-modules/make-package-set.nix#L200-L216),
I choose not to for reasons of initial build performance and reproducibility:
`cabal2nix` is not fast, and inadvertent updates could happen when updates are
made on the Hackage side, whereas checking in `cabal2nix` output ensures that
exactly the same package is used.

## Final thoughts

This project was very stimulating and challenging, and I learned a lot about
both my own learning process for new complex technologies and the technologies
themselves. Throughout this process, for the first time, I treated learning a
new technology like class material and read the documentation from top to
bottom, taking notes on the useful parts. This made it easier to keep the
unfamiliar language behaviour in mind while simultaneously reading code.

I will use *this* strategy again because although it is slightly slower, it
seemed to result in fewer trips to Google to check things and generally better
comprehension.

