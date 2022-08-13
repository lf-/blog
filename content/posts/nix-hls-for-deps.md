+++
date = "2022-07-21"
draft = false
path = "/blog/nix-hls-for-deps"
tags = ["haskell", "nix"]
title = "Setting up dev environments with Haskell Language Server and Nix"
+++

A problem I sometimes have is dealing with a bunch of independently maintained
but very interdependent libraries, for which I would like proper IDE
functionality cross-project. Another problem I sometimes have is that I want to
make a contribution to some library but setting up an IDE for it is a pain in
the neck.

# YOLO method (putting it all in a workspace with your app and not telling Nix)

Often it is easiest to partially bypass Nix while doing development on
dependencies. This means that Nix provides the compiler but the dependency
you're working on *and everything below it* is then owned by Cabal.

This is achieved by adding the dependencies into `packages:` inside
`cabal.project` or `cabal.project.local`. Then they are part of the workspace,
and cabal can do partial recompilation on them as desired.

For instance, if your application depends on persistent and esqueleto and you
want to hack on persistent, you would have to do the following:

* Clone persistent and esqueleto into subdirectories under the app (no need to
  make them submodules)
* Put something like the following into `cabal.project` or
  `cabal.project.local`:

```cabalproject
packages:
    esqueleto
    persistent/persistent
    persistent/persistent-*
```

Sometimes, there will be an error that says that some files are missing. This
is because Cabal decided to try to rebuild the Nix version of the package in
question, and could not find source code. The solution to this is to clone the
package with such an error and add it to `cabal.project` as before.

You can set up HLS by running `gen-hie` (from the `implicit-hie` package) and
then put the results into `hie.yaml`.

Sometimes HLS won't have loaded up the dependency yet, for some reason and
might have some weird import errors. This is solved by opening a file from that
dependency.

This is kind of a hack, but this method works really really well for large
codebases as it preserves the ability to do incremental builds on changes of
dependencies, while also mostly using dependencies from Nix caches.

# Standalone workspace

It's possible to create a workspace to work on two or more libraries. This
leverages Nix relatively nicely: pulls in dependencies as expected, and so on.

Let's do this to Persistent and Esqueleto, two database libraries. As I
later learned, this was rather annoying due to having a large number of
packages.

First, make a directory to do this in, and clone the dependencies into this
directory. It's important this *not* be a git repo, because Nix gets confused
with nested git repos, and it would be silly to have to set up submodules to do
a little hacking ([apparently they don't work at all anyway][submodules-oops]).

[submodules-oops]: https://github.com/NixOS/nix/pull/5284

```sh
$ mkdir deps && cd deps
$ gh repo clone yesodweb/persistent
$ gh repo clone bitemyapp/esqueleto
```

Then initialize the flake with just a `flake.nix` with `nix flake init`, with a
[flake template]:

```
$ nix flake init -t github:lf-/flake-templates#haskell.flakeNix
```

[flake template]: https://github.com/lf-/flake-templates/tree/main/haskell

Make a `cabal.project` so cabal considers it a multi package project properly:

```cabal
packages:
    esqueleto
    persistent/persistent
    persistent/persistent-*
```

Edit the `flake.nix` to add both of the packages in the workspace to the
overlay and to the `packages` of the `devShell`:

```nix
{
  # ...
  outputs = { self, nixpkgs, flake-utils }:
    let
      # ...
      out = system:
        let
          # ...
        in
          {
            # ...
            devShells.default =
              let
                haskellPackages = pkgs.haskell.packages.${ghcVer};
              in
                haskellPackages.shellFor {
                  packages = p: with pkgs.haskell.packages.${ghcVer}; [
                    persistent
                    esqueleto
                    persistent-qq
                    persistent-template
                    persistent-mysql
                    persistent-test
                    persistent-postgresql
                    persistent-sqlite
                  ];
                  withHoogle = true;
                  buildInputs = with haskellPackages; [
                    haskell-language-server
                    fourmolu
                    ghcid
                    cabal-install
                  ];
                };
          };
    in
      flake-utils.lib.eachDefaultSystem out // {
        # this stuff is *not* per-system
        overlays = {
          default = makeHaskellOverlay (
            prev: hfinal: hprev:
              let
                hlib = prev.haskell.lib;
                # this uses overrideSrc because of funniness with the deps of
                # persistent-sqlite
                makeLocal = n: hlib.overrideSrc hprev.${n} { src = ./persistent + "/${n}"; };
              in
                {
                  persistent = makeLocal "persistent";
                  persistent-test = makeLocal "persistent-test";
                  persistent-sqlite = makeLocal "persistent-sqlite";
                  persistent-postgresql = makeLocal "persistent-postgresql";
                  persistent-mysql = makeLocal "persistent-mysql";
                  persistent-qq = makeLocal "persistent-qq";
                  persistent-template = makeLocal "persistent-template";
                  esqueleto = hprev.callCabal2nix "esqueleto" ./esqueleto/esqueleto.cabal {};
                }
          );
        };
      };
}
```

