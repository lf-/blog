+++
date = "2024-05-19"
draft = false
path = "/blog/pinning-packages-in-nix"
tags = ["nix"]
title = "Pinning packages in Nix"
+++

Although Nix supposedly makes pinning things easy, it really does not seem so
from a perspective of looking at other software using pinning: it is not
possible to simply write `package = "^5.0.1"` in some file somewhere and get
*one* package pinned at a specific version. Though this is frustrating, there
is a reason for this, and it primarily speaks to how nixpkgs is a Linux
distribution and how Nix is unlike a standard language package manager.

This post will go through the ways to pin a package to some older version and
why one would use each method.

# Simply add an older version of nixpkgs

> Software regressed? No patches in master to fix it? Try 30-40 different
  versions of nixpkgs. An easy weeknight bug fix. You will certainly not regret
  pinning 30-40 versions of nixpkgs.

Unlike most systems, it is fine to mix versions of nixpkgs, although it will
likely go wrong if, e.g. libraries are intermingled between versions (*in
particular*, it is inadvisable to replace some program with a version
from a different nixpkgs from within an overlay for this reason). But, if one
package is all that is necessary, one can in fact simply import another version
of nixpkgs.

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

You can find it with something like:

```
 » nix eval --raw -f '<nixpkgs>' hello.meta.position
/nix/store/0qd773b63yg8435w8hpm13zqz7iipcbs-source/pkgs/by-name/he/hello/package.nix:41
```

Or, equivalently, with `nix repl -f '<nixpkgs>'`, `:e hello` or to do the same
as above, `hello.meta.position`.

Then, vendor that file into your configurations repository.

Once it is vendored, it can be used either from an overlay:

```nix
final: prev: {
  hello = final.callPackage ./hello-vendored.nix { };
}
```

or directly in your use site:

```nix
{ pkgs, ... }: {
  environment.systemPackages = [
    (pkgs.callPackage ./vendored-hello.nix { })
  ];
}
```


<dl>
<dt>Difficulty</dt>
<dd>Slight effort</dd>
<dt>Rebuilds</dt>
<dd>
For the overlay use case, this will build the overridden package and anything
depending on it. For the direct at use site case, this will just rebuild the
package, and anything depending on it will get the version in upstream nixpkgs.
</dd>
</dl>

# Patch the package with overrides

nixpkgs offers several separate methods to "override" things that mean
different things. In short:

- [`somePackage.override`][override] replaces the dependencies of a package;
  more specifically the dependencies injected by `callPackage`. It accepts an
  attribute set but can also accept a lambda of one argument, providing the
  previous dependencies of the package.
- [`somePackage.overrideAttrs`][overrideAttrs] replaces the `stdenv.mkDerivation`
  arguments of a package. This lets you replace the `src` of a package, in
  principle.
- [`overrideCabal`][overrideCabal] replaces the `haskellPackages.mkDerivation`
  arguments for a Haskell package in a similar way that `overrideAttrs` does for
  `stdenv.mkDerivation`. This is internally implemented by methods equivalent
  to the evil crimes below.

[override]: https://nixos.org/manual/nixpkgs/stable/#sec-pkg-override
[overrideAttrs]: https://nixos.org/manual/nixpkgs/stable/#sec-pkg-overrideAttrs
[overrideCabal]: https://nixos.org/manual/nixpkgs/stable/#haskell-overriding-haskell-packages

Here are some examples:

Build an openttd with a different upstream source by putting this in
`openttd-jgrpp.nix`:

```nix
{ openttd, fetchFromGitHub }:
openttd.overrideAttrs (old: {
  src = fetchFromGitHub {
    owner = "jgrennison";
    repo = "openttd-patches";
    rev = "jgrpp-0.57.1";
    sha256 = "sha256-mQy+QdhEXoM9wIWvSkMgRVBXJO1ugXWS3lduccez1PQ=";
  };
})
```

then `pkgs.callPackage ./openttd-jgrpp.nix { }`.

For instance, the following (rather silly) command will build such a file:

```
 » nix build -L --impure --expr 'with import <nixpkgs> {}; callPackage ./openttd-jgrpp.nix {}'
```

## Limitations

Most notably, [overrideAttrs doesn't work][overrideAttrs-busted] on several
significant language ecosystems including Rust and Go, since one almost always
needs to override the arguments of `buildRustPackage` or `buildGoPackage` when
replacing something. For these, either one can do crimes to introduce an
`overrideRust` function (see below), or one can cry briefly and then vendor the
package. The latter is easier.

```nix
let
  pkgs = import <nixpkgs> { };
  # Give the package a fake buildRustPackage from callPackage that modifies the
  # arguments through a function.
  overrideRust = f: drv: drv.override (oldArgs:
    let rustPlatform = oldArgs.rustPlatform or pkgs.rustPlatform;
    in oldArgs // {
      rustPlatform = rustPlatform // {
        buildRustPackage = args: rustPlatform.buildRustPackage (f args);
      };
    });

  # Take some arguments to buildRustPackage and make new ones. In this case,
  # override the version and the hash
  evil = oldArgs: oldArgs // {
    src = oldArgs.src.override {
      rev = "v0.20.9";
      sha256 = "sha256-NxWqpMNwu5Ajffw1E2q9KS4TgkCH6M+ctFyi9Jp0tqQ=";
    };
    version = "master";
    # FIXME: if you are actually doing this put a real hash here
    cargoSha256 = pkgs.lib.fakeHash;
  };

in
{
  x = overrideRust evil pkgs.tree-sitter;
}
```

[overrideAttrs-busted]: https://github.com/NixOS/nixpkgs/issues/99100

Then: `nix build -L -f evil.nix x`

<dl>
<dt>Difficulty</dt>
<dd>Highly variable, sometimes trivial, sometimes nearly impossible, depending
on architectural flaws of nixpkgs.</dd>
<dt>Rebuilds</dt>
<dd>
For the overlay use case of actually using this overridden package, this will
build the overridden package and anything depending on it. For the direct at
use site case, this will just rebuild the package, and anything depending on it
will get the version in upstream nixpkgs.
</dd>
</dl>

# Patch a NixOS module

If one wants to replace a NixOS module, say, by getting it from a later version
of nixpkgs, see [Replacing Modules] in the NixOS manual.

[Replacing Modules]: https://nixos.org/manual/nixos/stable/#sec-replace-modules

# Patch the base system without a world rebuild

It's possible to replace an entire store path with another inside a NixOS
system without rebuilding the world (but wasting some space (by duplicating
things for the rewritten version) and being somewhat evil/potentially unsound
since it is just a text replacement of the hashes). This can be achieved with
the NixOS option
[`system.replaceRuntimeDependencies`][replaceRuntimeDependencies].

[replaceRuntimeDependencies]: https://nixos.org/manual/nixos/stable/options#opt-system.replaceRuntimeDependencies

# Why do we need all of this?

The primary reason that Nix doesn't allow trivially overriding packages with a
different version is that it is a generalized build system building software
that has non-uniform expectations of how to be built. One can in indeed see
that the "replace one version with some other in some file" idea is *almost*
reality in languages using `mkDerivation` directly, though one might have to
tweak other build properties sometimes. Architectural problems in nixpkgs
prevent this working for several ecosystems.

Another sort of issue is that nixpkgs tries to provide a mostly [globally
coherent] set of software versions, where, like most Linux distributions, there
is generally one blessed version of a library with some exceptions. This is, in
fact, mandatory to be able to have any cache hits as a hermetic build system:
if everyone was building slightly different versions of libraries, all
downstream packages will have different hashes and thus miss the cache.

So, in a way, a software distribution based on Nix cannot have separate locking
for every package and simultaneously have functional caches: the moment that
everything is not built together, caches will miss.

[globally coherent]: https://www.haskellforall.com/2022/05/the-golden-rule-of-software.html

