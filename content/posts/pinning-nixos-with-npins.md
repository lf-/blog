+++
date = "2024-05-20"
draft = false
path = "/blog/pinning-nixos-with-npins"
tags = ["nix"]
title = "Pinning NixOS with npins, or how to kill channels forever without flakes"
+++

> Start of Meetup: "hmm, Kane is using nixos channels, that's not good, it's going to gaslight you"<br/>
> 6 hours later: Utterly bamboozled by channels<br/>
> 6.5 hours later: I am no longer using channels

\- [@riking@social.wxcafe.net](https://social.wxcafe.net/@riking/112465844452065776)

Nix channels, which, just like Nix, is a name overloaded to mean several
things, are an excellent way to confuse and baffle yourself with a NixOS
configuration by making it depend on uncontrolled and confusing external
variables rather than being self-contained. You can see [an excellent
explanation of the overloaded meanings of "channels" at samueldr's
blog][samueldr-channels]. In this post I am using "channels" to refer to the
`nix-channel` command that many people to manage what `<nixpkgs>` points to,
and thus control system updates.

[samueldr-channels]: https://samuel.dionne-riel.com/blog/2024/05/07/its-not-flakes-vs-channels.html

It is a poorly guarded secret in NixOS that `nixos-rebuild` is simply a bad
shell script; you can [read the sources here][nixos-rebuild]. I would even go
so far as to argue that it's a bad shell script that is a primary contributor
to flakes gaining prominence, since its UX on flakes is so much better: flakes
don't have the `/etc/nixos` permissions problems *or* the pains around pinning
that exist in the default non-flakes `nixos-rebuild` experience. We rather owe
it to our users to produce a better build tool, though, because `nixos-rebuild`
is *awful*, and there are currently the beginnings of efforts in that direction
by people including samueldr; `colmena` is also an example of a better build
tool.

Both the permissions issue and the pinning are extremely solvable problems
though, which is the subject of this post. [Flakes have their
flaws][samueldr-flakes] and, more to the point, plenty of people just don't
want to learn them yet, and nobody has yet met people where they are at with
respect to making this simplification *without* doing it with flakes.

This is ok! Let's use something more understandable that does the pinning part
of flakes and not worry about the other parts.

[samueldr-flakes]: https://samuel.dionne-riel.com/blog/2023/09/06/flakes-is-an-experiment-that-did-too-much-at-once.html

This blog post teaches you how to move your NixOS configuration into a repo
wherever you want, and eliminate `nix-channel` altogether, instead pinning the
version of `<nixpkgs>` and NixOS in a file in your repo next to your config.

[nixos-rebuild]: https://github.com/nixos/nixpkgs/blob/b5c90bbeb36af876501e1f4654713d1e75e6f972/pkgs/os-specific/linux/nixos-rebuild/nixos-rebuild.sh

# Background: what NixOS builds actually do

First, let's say how NixOS builds actually work, skipping over all the remote
build stuff that `nixos-rebuild` also does.

For non-flakes, `<nixpkgs/nixos>` is evaluated; that is, [`nixos/default.nix`][nixos-defaultnix] in
`<nixpkgs>`. This resolves the `NIX_PATH` entry `<nixos-config>` as the first
user-provided NixOS module to evaluate, or alternatively
`/etc/nixos/configuration.nix` if that doesn't exist. For flake configurations,
substitute `yourflake#nixosConfigurations.NAME` in your head in place of
`<nixpkgs/nixos>`.

[nixos-defaultnix]: https://github.com/nixos/nixpkgs/blob/6510ec5acdd465a016e5671ffa99460ef70e6c25/nixos/default.nix

The default `NIX_PATH` is the following:

```
nix-path = $HOME/.nix-defexpr/channels nixpkgs=/nix/var/nix/profiles/per-user/root/channels/nixpkgs /nix/var/nix/profiles/per-user/root/channels
```

That is to say, unless it's been changed, `<nixpkgs>` will reference root's
channels, managed with `nix-channel`.

Next, the attribute `config.nix.package` of `<nixpkgs/nixos>` is evaluated then
built/downloaded (!!) unless it is a flake config (or `--no-build-nix` or
`--fast` is passed). Then the attribute `config.system.build.nixos-rebuild` is
likewise evaluated and the `nixos-rebuild` is re-executed into the one from the
future configuration instead of the one from the current configuration, unless
`--fast` is passed.

Once your configuration has been evaluated once or twice pointlessly, it is
evaluated a third time, for the attribute `config.system.build.toplevel`, and
that is built to yield the new system generation.

This derivation is what becomes `/run/current-system`: it contains a bunch of
symlinks to everything that forms that generation such as the kernel, initrd,
`etc` and `sw` (which is the NixOS equivalent of `/usr`).

Finally, `the-build-result/bin/switch-to-configuration` is invoked with an
argument `switch`, `dry-activate`, or similar.

---

From this information, one could pretty much write a NixOS build tool: it really is
just `nix build -f '<nixpkgs/nixos>' config.system.build.toplevel` (in old
syntax, `nix-build '<nixpkgs/nixos>' -A config.system.build.toplevel`), then
`result/bin/switch-to-configuration`. That's all it does.

# Background: what is npins anyway?

[`npins`][npins] is the spiritual successor to [niv], the venerable Nix pinning
tool many people used before switching to flakes. But what is a pinning tool
for Nix anyway? It's just a tool that finds the latest commit of something,
downloads it, then stores that commit ID and the hash of the code in it in a
machine-readable lock file that you can check in. When evaluating your Nix
expressions, they can use `builtins.fetchTarball` to obtain that exact same
code every time.

That is to say, a pinning tool lets you avoid having to copy paste Git commit
IDs around, and ultimately does something like this in the end, which hands you
a path in the Nix store with the code at that version.

```nix
builtins.fetchTarball {
  # https://github.com/lix-project/lix/tree/main
  url = "https://github.com/lix-project/lix/archive/992c63fc0b485e571714eabe28e956f10e865a89.tar.gz";
  sha256 = "sha256-L1tz9F8JJOrjT0U6tC41aynGcfME3wUubpp32upseJU=";
  name = "source";
};
```

Let's demystefy how pinning tools work by writing a trivial one in a couple of
lines of code.

First, let's find the latest commit of nixos-unstable with `git ls-remote`:

```
~ » git ls-remote https://github.com/nixos/nixpkgs nixos-unstable
4a6b83b05df1a8bd7d99095ec4b4d271f2956b64	refs/heads/nixos-unstable
~ » git ls-remote https://github.com/nixos/nixpkgs nixos-unstable | cut -f1
4a6b83b05df1a8bd7d99095ec4b4d271f2956b64
```

Then we can construct an archive URL for that commit ID, and fetch it into the
Nix store:

```
~ » nix-prefetch-url --name source --unpack https://github.com/nixos/nixpkgs/archive/4a6b83b05df1a8bd7d99095ec4b4d271f2956b64.tar.gz
0zmyrxyrq6l2qjiy4fshjvhza6gvjdq1fn82543wb2li21jmpnpq
```

And finally fetch it from a Nix expression:

```
~ » nix repl
Lix 2.90.0-lixpre20240517-0d2cc81
Type :? for help.
nix-repl> nixpkgs = builtins.fetchTarball { url = "https://github.com/nixos/nixpkgs/archive/4a6b83b05df1a8bd7d99095ec4b4d271f2956b64.tar.gz"; name = "source"; sha256 = "0zmyrxyrq6l2qjiy4fshjvhza6gvjdq1fn82543wb2li21jmpnpq"; }
nix-repl> nixpkgs
"/nix/store/0aavdx9m5ms1cj5pb1dx0brbrbigy8ij-source"
```

This is essentially exactly what npins does, minus the part of saving the
commit ID and hash into `npins/sources.json`.

We could write a simple shell script to do this, perhaps called
`./bad-npins.sh`:

```bash
#!/usr/bin/env bash

name=nixpkgs
repo=https://github.com/nixos/nixpkgs
branch=nixos-unstable

tarballUrl="$repo/archive/$(git ls-remote "$repo" nixos-unstable | cut -f1)"
sha256=$(nix-prefetch-url --name source --unpack "$tarballUrl")

# initialize sources.json if not present
[[ ! -f sources.json ]] && echo '{}' > sources.json

# use sponge from moreutils to deal with jq not having the buffering to safely
# do in-place updates
< sources.json jq --arg sha256 "$sha256" --arg url "$tarballUrl" --arg name "$name" \
    '.[$name] = {sha256: $sha256, url: $url}' \
    | sponge sources.json
```

and then from Nix we can load the sources:

```nix
let
  srcs = builtins.fromJSON (builtins.readFile ./sources.json);
  fetchOne = _name: { sha256, url, ... }: builtins.fetchTarball {
    name = "source";
    inherit sha256 url;
  };
in
builtins.mapAttrs fetchOne srcs
```

Result:

```
~ » nix eval -f sources.nix
{ nixpkgs = "/nix/store/0aavdx9m5ms1cj5pb1dx0brbrbigy8ij-source"; }
```

We now have a bad pinning tool! I wouldn't recommend using this shell script, since
it doesn't do things like check if redownloading the tarball is necessary, but
it is certainly cute and it does work.

`npins` is pretty much this at its core, but well-executed.

[npins]: https://github.com/andir/npins
[niv]: https://github.com/nmattia/niv

# Fixing the UX issues

We know that:

1. `<nixpkgs>` as seen by `nixos-rebuild` determines what version of nixpkgs
   is used to build the configuration.
2. Where the configuration is is simply determined by `<nixos-config>`
3. Both instances of duplicate configuration evaluation are gated on `--fast`
   not being passed.

So, we just have to invoke `nixos-rebuild` with the right options and
`NIX_PATH` such that we get a config from the current directory with a
`nixpkgs` version determined by `npins`.

Let's set up npins, then write a simple shell script.

```
$ npins init --bare
$ npins add --name nixpkgs channel nixos-unstable
```

You can also use `nixos-23.11` (or future versions once they come out) in place
of `nixos-unstable` here, if you want to use a stable nixpkgs.

Time for a simple shell script. Note that this shell script uses `nix eval`,
which we at *Lix* are very unlikely to ever break in the future, but it does
require `--extra-experimental-features nix-command` as an argument if you don't
have the experimental feature enabled, or
`nix.settings.experimental-features = "nix-command"` in a NixOS config. (The
experimental feature can be hacked around with
`nix-instantiate --json --eval npins/default.nix -A nixpkgs.outPath | jq -r .`,
which works around `nix-instantiate --eval` missing a `--raw` flag, but this is
kind of pointless since we are about to use flakes features in a second)

```bash
#!/usr/bin/env bash

cd $(dirname $0)

# assume that if there are no args, you want to switch to the configuration
cmd=${1:-switch}
shift

nixpkgs_pin=$(nix eval --raw -f npins/default.nix nixpkgs)
nix_path="nixpkgs=${nixpkgs_pin}:nixos-config=${PWD}/configuration.nix"

# without --fast, nixos-rebuild will compile nix and use the compiled nix to
# evaluate the config, wasting several seconds
sudo env NIX_PATH="${nix_path}" nixos-rebuild "$cmd" --fast "$@"
```

# Killing channels

Since building the config successfully, we can now kill channels to stop their
reign of terror, since we no longer need them to build the configuration at
all. Use `sudo nix-channel --list` and then `sudo nix-channel --remove
CHANNELNAME` on each one. While you're at it, you can also delete `/etc/nixos`
if you've moved your configuration to your home directory.

Now we have a NixOS configuration built without using channels, but once we are
running that system, `<nixpkgs>` will still refer to a channel (or nothing, if
the channels are deleted), since we didn't do anything to `NIX_PATH` on the
running system. Also, the `nixpkgs` flake reference will point to the latest
`nixos-unstable` at the time of running a command like `nix run nixpkgs#hello`.
Let's fix both of these things.

For context, *by default*, on NixOS 24.05 and later, due to [PR
254405](https://github.com/NixOS/nixpkgs/pull/254405), *flake*-based NixOS
configs get pinned `<nixpkgs>` and a pinned `nixpkgs` flake of the exact same
version as the running system, such that `nix-shell -p hello` and `nix run
nixpkgs#hello` give you the same `hello` every time: it will always be the same
one as if you put it in `systemPackages`. That setup works by setting
`NIX_PATH` to refer to the flake registry `/etc/nix/registry.json`, which then
is set to resolve `nixpkgs` to `/nix/store/xxx-source`, that is, the nixpkgs of
the current configuration.

We can bring the same niceness to non-flake configurations, with the exact same
code behind it, even!

Let's fix the `NIX_PATH`. Add this module worth of code into your config
somewhere, say, `pinning.nix`, then add it to `imports` of `configuration.nix`:

```nix
{ config, pkgs, ... }:
let sources = import ./npins;
in {
  # We need the flakes experimental feature to do the NIX_PATH thing cleanly
  # below. Given that this is literally the default config for flake-based
  # NixOS installations in the upcoming NixOS 24.05, future Nix/Lix releases
  # will not get away with breaking it.
  nix.settings = {
    experimental-features = "nix-command flakes";
  };

  # FIXME(24.05 or nixos-unstable): change following two rules to
  #
  # nixpkgs.flake.source = sources.nixpkgs;
  #
  # which does the exact same thing, using the same machinery as flake configs
  # do as of 24.05.
  nix.registry.nixpkgs.to = {
    type = "path";
    path = sources.nixpkgs;
  };
  nix.nixPath = ["nixpkgs=flake:nixpkgs"];
}
```

# New workflow

When you want to update NixOS, use `npins update`, then `./rebuild.sh`
(`./rebuild.sh dry-build` to check it evaluates, `./rebuild.sh boot` to switch
on next boot, etc). If it works, commit it to Git. The version of nixpkgs comes
from exactly one place now, and it is tracked along with the changes to your
configuration. Builds are faster now since we don't evaluate the configuration
multiple times.

Multiple machines can no longer get desynchronized with each other. Config
commits *will* build to the same result in the future, since they are
self-contained now.

# Conclusion and analysis

We really need to improve `nixos-rebuild` as the NixOS development community.
It embodies, at basically every juncture, obsolescent practices that confuse
users and waste time. Modern configurations should be using either
npins/equivalent or flakes, both of which should be equally valid and easy to
use choices in all our tooling.

Flags like `--no-rebuild-nix` come from an era where people were building
flake-based configs from a Nix that didn't even *have* flakes, so they needed
to be able to switch to an entirely different *Nix* to be able to evaluate
their config. We should never be rebuilding Nix by default before re-evaluating
the configuration in 2024. The Nix language is much, much more stable these
days, almost frozen like a delicious ice cream cone, and so the idea of
someone's config requiring a brand new Nix to merely evaluate is bordering on
absurd.

It doesn't help that this old flakes hack actually breaks cross compiling
NixOS configs, for which `--fast` is thus mandatory. The re-execution of
`nixos-rebuild` is more excusable since there is [still work to do on that like
capturing output to the journal](https://github.com/NixOS/nixpkgs/pull/287968),
but it is still kind of bothersome to eat so much evaluation time about it; I
wonder if a happier medium is that it would just build `pkgs.nixos-rebuild`
instead of evaluating all the modules, but that has its own drawback of ignoring
overlays in the NixOS config...

Another tool that [needs rewriting, documentedly
so](https://github.com/NixOS/nixpkgs/issues/293543) is `nixos-option`, which is
a bad pile of C++ that doesn't support flakes, and which could be altogether
replaced by a short bit of very normal Nix code and a shell script.

There's a lot of work still to do on making NixOS and Nix a more friendly
toolset, and we hope you can join us. I (Jade) have been working along with
several friends on <https://lix.systems>, a soon-to-be-released fork of CppNix
2.18 focused on friendliness, stability, and future evolution. People
in our community have been working on these UX problems outside Nix itself
as well. We would love for these tools to be better for everyone.
