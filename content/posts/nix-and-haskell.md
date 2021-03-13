+++
date = "2020-07-16"
draft = false
path = "/blog/nix-and-haskell"
tags = ["nix", "haskell"]
title = "Using Nix to build multi-package, full stack Haskell apps"
+++

**UPDATE**: March 13 2021 - rewrote a fair amount of the post

As part of my job working on an [open source logic
textbook](https://carnap.io), I picked up a Haskell
codebase that was rather hard to build. This was problematic for new
contributors getting started, so I wanted to come up with a better process.
Further, I was interested in this simplification allowing continuous
integration, packaging, and other useful process improvements.

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

I recommend having a terminal with a `nix repl` and the
[nix-doc](https://github.com/lf-/nix-doc) plugin and an editor with a
checkout of the `nixpkgs` source code open while working on Nix stuff.

# Implementation

This post summarizes the design decisions that went into implementing Nix for
this existing full stack app. If you'd like to read the source, it is
[available on GitHub](https://github.com/Carnap/Carnap/).

## `default.nix`

I have a top-level `default.nix` that imports nixpkgs with overlays for each
conceptual part of the application (this could all be done in one but it is
useful to separate them for maintenance purposes). A simplified version is
below:

{% codesample(desc="`default.nix` outline") %}

```nix
{ compiler ? "ghc865",
  ghcjs ? "ghcjs"
}:
  let # I highly recommend using `niv` for managing git versions of things
      # It will generate this sources.nix file for you.
      sources = import ./nix/sources.nix;
      nixpkgs = sources.nixpkgs {
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

{% end %}

## Overlays and `server.nix`

A brief interlude on overlays: an overlay is a function taking two curried
arguments, `self` and `super`, which are extremely poorly named. They should
be called something like `final` and `current` respectively (but the
convention has been made already). `final` is the package set after all
the overlays have been applied, and `current` is the state after all the
states *before* this overlay have been applied.

Overlays return a new attribute set that will be used to update the parent
package set. However there is a significant footgun that the workaround for
results in annoying amounts of nesting on account of Nix's `//` attribute set
update operator doing shallow updates: if you are overriding subsets such as
the Haskell packages, you need to update each piece at each level. It will
hopefully be clearer in the example below.
There is a [workaround to avoid this nesting in our real Nix expressions](https://github.com/Carnap/Carnap/blob/aec8fab2619f54d2ad7b2c59b2d4d11d6eda09bc/nix/compose-haskell-overlays.nix)
but I've chosen to write it out in full here for the sake of simplicity.

I'll also demonstrate the several types of hacks you will probably have to do
on a sufficiently large codebase to get dependencies' Haskell packages to
build even when they are broken in `nixpkgs`.

In each Haskell package, use `callCabal2nix` to add your own packages:

{% codesample(desc="`server.nix` sample") %}

```nix
{ ghcjs ? "ghcjs", compiler ? "ghc865", sources }:
  self: super:
  let # import the library functions from super, not self
    inherit (super.haskell.lib)
      overrideCabal # lets you override various settings of a haskell
                    # package. doJailbreak, dontCheck, etc are just wrappers
                    # around individual properties of this
      callCabal2nix # calls cabal2nix with some source and makes a nix package
      doJailbreak   # disables cabal version bounds. it's a big hammer.
      dontCheck     # disables tests
      justStaticExecutables # disables a bunch of unnecessary output + build
                            # steps for binaries
      overrideSrc;
  in {
    haskell = super.haskell // {
      packages = super.haskell.packages // {
        "${compiler}" = super.haskell.packages."${compiler}".override {
          overrides = newpkgs: oldpkgs: {
            # your stuff
            Common1 = oldpkgs.callCabal2nix "Common1" ./Common1 { };

            # a note! if you don't use nix for your production builds, you can
            # basically not worry about most of the stuff for Server as it
            # *exclusively* applies to when you are doing something like
            # `nix-build -A server`. If you aren't using Nix for building your
            # app, you can just put `callCabal2nix "Server" ./Server {}` here.
            Server = justStaticExecutables (overrideCabal
              (oldpkgs.callCabal2nix "Server" ./Server { })
              (old: let client = oldpkgs."${ghcjs}".packages.Client; in {
                # copy the client into the package
                preConfigure = ''
                  cp ${client.out}/bin/Main.jsexe/main.js static/client/
                '';

                # disabling these saves a pile of build time as it doesn't
                # build the app twice
                enableLibraryProfiling = false;
                enableExecutableProfiling = false;

                isExecutable = true;
              })
            )
            # ...

            # HACK: you have to downgrade some dependency
            hoauth2 = oldpkgs.callHackage "hoauth2" "1.8.9" { };

            # HACK: you need a dependency newer than the `all-cabal-hashes`
            # used by your version of `nixpkgs`. Put in the version and name
            # here, and just zero out part of the hash. It will fail to build
            # and tell you the right hash.
            yesod-auth-oauth2 = oldpkgs.callHackageDirect {
                pkg = "yesod-auth-oauth2";
                ver = "0.6.1.3";
                sha256 = "1bikn9kfw6mrsais4z1nk07aa7i7hyrcs411kbbfgc7n74k6sd5b";
              } { };

            # HACK: some dependency has broken tests
            tz = dontCheck oldpkgs.tz;

            # HACK: some dependency has excessively tight version bounds (this
            # is like `allow-newer` in `stack.yaml` but it applies to only one
            # package)
            yesod-persistent = doJailbreak oldpkgs.yesod-persistent;

            # HACK: you have to replace the source of a dependency entirely
            # (this also demonstrates how to use a subdirectory from a source,
            # in this case "/persistent" under the yesod persistent repository)
            persistent = overrideSrc oldpkgs.persistent { src = (sources.persistent + "/persistent"); };
          };
        };
      };
    };
  }
```

{% end %}

## Shells and development tools

You can construct shells with arbitrary developer tools from `nixpkgs`. I
cannot overstate how awesome this feature is: a lot of Haskell developer
tools are supremely frustrating to build oneself, you know everyone has the
same version, and Nix means everyone can get them.

Nix will build/retrieve the tools listed in `buildInputs` and put them in
your shell's PATH, and it will *retrieve the dependencies* for the packages
returned by the function passed as `packages` and make those available, but
it will not build the packages given. This lets you use cabal to manage
builds while programming, and have all your dependencies provided so cabal
*only* builds your software.

Put the following in a `default.nix` (here's the [production version for reference](https://github.com/Carnap/Carnap/blob/aec8fab2619f54d2ad7b2c59b2d4d11d6eda09bc/default.nix)):

{% codesample(desc="`default.nix` sample, continued") %}

```nix
let
  # merge this section so that nixpkgs import is at the same level of the let
  # block
  devtools = { isGhcjs }: with nixpkgs.haskell.packages."${compiler}"; ([
      Cabal
      cabal-install
      ghcid
      hasktags
      yesod-bin
      # hls is disabled for ghcjs shells because it probably will not work on
      # pure-ghcjs components.
  ] ++ (lib.optional (!isGhcjs) haskell-language-server)
  ) ++ (with nixpkgs; [
      cabal2nix
      niv
    ]);
in {
  # merge this section into the attribute set with `client` and `server`.
  ghcShell = nixpkgs.haskell.packages."${compiler}".shellFor {
    packages = p: [ p.Common1 p.Server1 ];
    withHoogle = true;
    buildInputs = devtools { isGhcjs = false; };
  };

  ghcjsShell = nixpkgs-stable.haskell.packages."${ghcjs}".shellFor {
    packages = p: [ p.Common1 p.Client1 ];
    withHoogle = true;
    buildInputs = devtools { isGhcjs = true; };
  };
}
```

{% end %}

Then, you can use `nix-shell` with this attribute: `nix-shell -A ghcShell`.

Build with Cabal as usual (`cabal new-build all`), assuming you've built the
GHCJS parts already (see below).

## GHCJS

Create an overlay the same way as with the server side components, but using
`nixpkgs.haskell.packages."${ghcjs}"` instead of `${compiler}`, and including
the client and common packages.

On GHCJS specifically, there is a hack that is very useful to apply:

GHCJS breaks many unit tests such that they freeze the Nix build process. You
can override `mkDerivation` to disable most packages' unit tests. For some,
this does not work because nixpkgs puts test runs in a conditional already,
which causes the `mkDerivation` override to be ignored.
[`haskell.lib.dontCheck`](https://github.com/NixOS/nixpkgs/blob/32c8e79/pkgs/development/haskell-modules/lib.nix#L106-L109)
can be used to deal with these cases.

```nix
# inside the overlay for the client (at the same level as the package
# definitions)
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

For package builds, a [`preConfigure` script](https://github.com/Carnap/Carnap/blob/cde2671/server.nix#L30-L36)
is used with
[`haskell.lib.overrideCabal`](https://github.com/NixOS/nixpkgs/blob/32c8e79/pkgs/development/haskell-modules/lib.nix#L11-L41)
to replace these links with paths in the Nix store for the browser JavaScript.
A dependency on the built JavaScript is also added so it gets pulled in.

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

