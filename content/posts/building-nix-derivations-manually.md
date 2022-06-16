+++
date = "2022-06-15"
draft = false
path = "/blog/building-nix-derivations-manually"
tags = ["nix"]
title = "Building Nix derivations manually in nix-shell"
+++

When writing, debugging, or otherwise working with Nix expressions, it is often
useful to run a build part of the way through, or to run it manually in a
shell. For instance, perhaps you want to test some development version of a
tool against a package and want to iterate quickly. Or, a build is broken and
you want to look at it more closely than `nix-build --keep-failed` makes
convenient.

Most packages are built with the generic builder, regardless of language. The
language specific builders are then written in terms of it. For instance,
Haskell packages are [built with this builder][haskell-builder], customizing it
by adding `setupCompilerEnvironmentPhase` and overriding many phases.

[haskell-builder]: https://github.com/nixos/nixpkgs/blob/master/pkgs/development/haskell-modules/generic-builder.nix

The way `nix-build` typically builds packages with the generic builder is
documented in the [`stdenv` chapter][stdenv-docs] of the nixpkgs documentation.
More or less, it runs [various "phases"][phases] in order in order to build the
package. This is roughly analogous to the `build()`, `check()`, etc functions
in an Arch Linux or Alpine Linux `PKGBUILD` file.

[stdenv-docs]: https://nixos.org/manual/nixpkgs/stable/#chap-stdenv
[phases]: https://nixos.org/manual/nixpkgs/stable/#sec-stdenv-phases

The generic builder is made of function definitions in the file
[`pkgs/stdenv/generic/setup.sh`][setup.sh] in the nixpkgs repository, and it is
usually `source`d by the actual build script,
[`pkgs/stdenv/generic/default-builder.sh`][default-builder.sh], which is
trivial:

```sh
source $stdenv/setup
genericBuild
```

[setup.sh]: https://github.com/nixos/nixpkgs/blob/master/pkgs/stdenv/generic/setup.sh
[default-builder.sh]: https://github.com/nixos/nixpkgs/blob/master/pkgs/stdenv/generic/default-builder.sh

`default-builder.sh` is not always used: `setup.sh` is more or less a shell
script library and can equally be used in a custom build script that defines
some functions then calls `genericBuild`.

*By default*, `genericBuild` will run the default phases, the most notable of
which are `unpackPhase`, `configurePhase`, `buildPhase`, `checkPhase` (tests),
and `installPhase`. There are also hooks that can run. These phases are either
the functions of that name, which perform the default C `./configure; make;
make install` thing, environment variables containing scripts overriding
them, or shell functions defined in the file that sources `setup.sh`.

Another feature supported by the generic builder is "hooks" which are basically
little shell functions, possibly defined by environment variables, which can be
run at various points in the build process if present.

More phases can also be added for more complicated things to build. In
practice, all of these extensibility features mean that the generic builder is
reused for most language ecosystems.

## Running a build manually

Because of the complication of possible custom phases, hooks, etc, it is not
really prudent to just run the phase functions directly because it essentially
means you are reimplementing `genericBuild` in your head.

When debugging, what you probably want to do is consult the full phases list
and run `genericBuild` with those phases. We can see that the default phases are
the following (from [setup.sh][setupsh-phases]):

[setupsh-phases]: https://github.com/nixos/nixpkgs/blob/1e2a288f0e84b7064020554cd89415932b458c1b/pkgs/stdenv/generic/setup.sh#L1335-L1340

```sh
if [ -z "${phases:-}" ]; then
    phases="${prePhases:-} unpackPhase patchPhase ${preConfigurePhases:-} \
        configurePhase ${preBuildPhases:-} buildPhase checkPhase \
        ${preInstallPhases:-} installPhase ${preFixupPhases:-} fixupPhase installCheckPhase \
        ${preDistPhases:-} distPhase ${postPhases:-}";
fi
```

So if you have already manually run `unpackPhase`, `patchPhase`, and all the
`prePhases` if any, a build command to make a build to look at would be
something like the following:

```sh
out=$(pwd)/out phases="${preConfigurePhases:-} configurePhase ${preBuildPhases:-} buildPhase" genericBuild
```

The `$out` variable has to be specified because it defaults to somewhere in the
nix store, which usually breaks builds since is not available for writing if
you are not the actual sandboxed nix builder. If there are other outputs such
as `doc`, these also need to be specified here.

The one part of `genericBuild` that I usually do run manually is `unpackPhase`,
which notably changes the directory into the source directory of the app. This
is useful to run manually because when debugging, it is often the case that a
build needs to be run several times through, and it's useful to let it fail in
the middle when you can restart it yourself just on the broken piece.

