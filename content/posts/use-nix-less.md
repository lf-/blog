+++
date = "2025-07-05"
draft = false
path = "/blog/use-nix-less"
tags = ["nix"]
title = "You don't have to use Nix to manage your dotfiles"
+++

A pattern I've seen happen many times is where people (often new to Nix) overuse Nix in a manner that makes their lives harder, in order to make their systems ostensibly more reproducible and often get the bad side of the tradeoffs inherent in using it.
The type of way that this becomes frustrating is, for instance, by inserting Nix evaluations and builds in the iteration loop of changing plaintext files owned by a normal user that don't undergo any transformation by Nix.
Generally this is a symptom of a broader problem of having reached for too big of a hammer, but the tooling itself does not suggest scaling down or using it in a less monolithic way, so it feels like the big hammer is the only tool in the toolbox.

Here, by Nix, I am referring to Nix-the-technology combined with the Nix ecosystem that includes the Nix implementations (Lix, CppNix, Snix), nixpkgs, NixOS, nix-darwin, home-manager, system-manager, the deployment tools like Colmena, and more.

This post is about how NixOS and home-manager allow a spectrum of how much to do with Nix, and that there are happy balances of using *the minimum necessary* amount of Nix that can produce a nicer experience depending on what you're doing.

<aside>

I am writing this from the perspective of a *non-user* of home-manager, and I would love to learn about the ways in which I am wrong about it.
The intent of this post is not to say that you shouldn't use home-manager!
You can have the same type of unfun experience by doing it system-wide with NixOS or nix-darwin instead.
The various NixOS-module-based configuration management systems are a big hammer and there are some things they are excellent for: the alternatives, for instance, do not have any answer to how to run user-specific services.

</aside>

# The strengths of the Nix ecosystem

The various Nix tools are great if:
- You need a cross-language build system, you are not doing a work project at Google, Facebook, or Amazon, and something needs to be reproducibly built.

  Nix is one of the nicest distro build systems I've ever used for building packages.
  If you want to automate compiling some stuff, it's great for this.
  The language is less horrible and higher level than shell scripts, you can have intermediate targets very easily, and its structure produces relatively reproducible builds most of the time without trying.

  For example, <https://docs.jade.fyi> is built with Nix.
  This is a great use as I don't care that much about the iteration time and it is explicitly a job for a build system where I have intermediate artifacts and have to orchestrate a bunch of sandboxed builds of bad Makefiles in temporary directories.
- You want to *get some compiled software* from the Internet which is written in whatever language.

  nixpkgs is one of the largest package sets in the world, and much of it is of decent quality.

  This includes, for example, obtaining tools that wind up in `$PATH`.

  One of the killer applications of Nix is to provision consistent development environments for software projects.

  It is *very* easy to start a new project without monorepo-level infrastructure and build some stuff.
- You need an *image-based*, *monolithic* configuration management system to set up a base environment or services on a machine and the iteration time isn't a problem.

  All three of NixOS, nix-darwin, and home-manager are *monolithic* in design.
  They produce an artifact which is rooted in *one* store path, for example, the `config.system.build.toplevel` option on NixOS, which becomes `/run/current-system` and contains everything in the system configuration from config files to binaries.

  To change it, the entire configuration is evaluated from scratch and any parts of it that need rebuilding get rebuilt before switching the entire system to the new configuration.

  This means that partial reconfiguration or mutability is not their strong suit; they're structurally not conducive to making some options mutable at runtime without special support, for instance.
  This also means that their evaluation time scales with the complexity of the configuration in question.

  There's a few ways to get around this which I will discuss later, but there's no silver bullet.
- You want a uniform and reasonably nice configuration language and abstraction over individual tools' configuration formats.

  The NixOS module system allows having the One True Config Language, which is really nice as it allows comments in JSON, eliminates having to think about where the config file is, and more.

  This is something that you give up by managing a program's configuration as a file.

# The weaknesses of the Nix ecosystem

- Evaluation times are bad!!

  The NixOS module system used by NixOS, nix-darwin, home-manager and flake-parts implementing a type system and configuration merging in Nix language certainly doesn't make them much better, nor does the lack of good evaluation profiling tooling.

  In fairness, bazel has had promises of evaluation caching for approximately forever and has not delivered on it, autoconf sometimes takes longer to configure the program than to build it on modern systems, and docker builds are hardly fast either.

  Nix does not have meaningful evaluation caching.
  There's an "evaluation cache" for flakes only, but it is just a mapping from (flake store path, flake attr) -> output path.
  That is, if *anything* is changed in the entire flake's repository, the evaluation cache is invalidated.
  In practice, evaluation caching makes `nix run nixpkgs#hello` *for system nixpkgs* fast the second time and not much else.

  <aside>

  The best way to ensure your evaluation time is as long as possible is to deploy your user's home-manager configuration inside your NixOS configuration, or even worse, do that for multiple users.
  Don't do that if you don't like waiting.

  Also, the features of Colmena or other tools that allow referencing other NixOS systems' configurations are a great way to increase evaluation time.
  If you're tempted to do that, just write the source of truth for things that multiple configurations need to access into a `.nix` file that doesn't use NixOS at all and import it from each configuration.

  There's definitely another entire blog post in why Nix evaluations are slow and what to do about them.

  </aside>

  It is likely somewhat of a tautology that any sufficiently large build in any system with too many dependencies will produce long evaluation times.
  The solution to this is pretty much always "have you tried having a smaller dependency closure".

  That is to say, NixOS being monolithic and being used to build overcomplicated configurations is a *primary cause* of bad evaluation times.
- The docs are notoriously bad.

  This is a problem that people keep talking about and there's been work on them, but I think a lot of the problem is that the system does not lend itself to being inspected *and* very few people know the tools to inspect it.
  Either way it's not the subject of this post.

# Put away the sledgehammer

There's a few categories of things that often need to be set up on a system:
- Programs
- Configuration files
- Extensions to software that does not need anything compiled, for example, editor plugins, browser plugins, etc
- System configuration like users

NixOS or home-manager can set up all of these categories, but the more that you add to the monolithic configuration, the more they will become slow to evaluate and build the configurations.
It can be a very suboptimal trade-off to use NixOS for user application configuration as it ties the iteration loop and update schedule of e.g. editor plugins and editor configurations to the slowest parts of building the NixOS system or home-manager configuration.

This is probably *also* true for application deployments!
Using a monolithic configuration management system to do app deployments means, among other things, eating the evaluation time of the application itself in addition to the system configuration and often doing so multiple times (if by accident), even if the rest of the configuration doesn't change often.

NixOS has a reputation for being hard to use not-Nixy tools on; to some extent this is deserved since `nix-ld` is not set up by default so random binaries from the Internet don't work by default.
However, it's *absolutely* not the case that other configuration management strategies, particularly for dotfiles, are inapplicable.

It's also not the case that NixOS forbids mutable application deployments.
`nix-store --realise` and `nix-env --set` exist and can be used to separately build and deploy an app from the rest of the system, for instance.
You *can* do mutable application deployments in the non-Nix ways as well; it's just a Linux box.

If the Nix-based DSL of home-manager isn't helpful for some tools, it can be much nicer if user-specific configuration that could be in your home directory is just a pile of symlinks into a git repo in your home directory.

## home-manager and `lib.file.mkOutOfStoreSymlink`

Nominally, home-manager has a feature called `mkOutOfStoreSymlink` that is used by passing it a Nix language path literal and which will create a symlink to a file outside the Nix store, to allow for simply putting config files in a git repo.
This sounds ideal!

Unfortunately, due to [funny Nix language semantics][toString-path], this function fundamentally can't work as intended with flakes, since `toString ./.` is a string containing a Nix store path to the flake (without any string context to create a dependency on it, even!) rather than an absolute path when flakes are involved.
That means that *in practice*, `mkOutOfStoreSymlink` will point into the copy of the flake in the Nix store such that the file is only updated when the configuration is rebuilt.

[toString-path]: https://github.com/NixOS/nixpkgs/pull/278522/files#diff-29c71aa8261b14b1cad6e6fa28486fed7295050db4eeb32ba205672ba91d40e1R256-R275

That is to say, the intended escape hatch for home-manager to make a symlink into a git repo requires either:
1. Not using flakes or
2. Using a "creative" interpretation of flakes like [Lix flake-compat] with the `copySourceTreeToStore` option set to false such that `flake.nix` is evaluated without copying the source to the store as if it is not a flake and thus making `toString` work as in non-flakes.

[Lix flake-compat]: https://git.lix.systems/lix-project/flake-compat

Neither of these is particularly on the happy path for most people, so I suggest using a trivial second dotfiles manager in addition to home-manager (or scripting the creation of the symlinks during `home-manager switch` rather than trying to do it at evaluation/build time).

## The jade-branded dotfiles solution

The simplest solution for dotfiles, assuming that you're fine with omitting the nicety of having the configuration files translated to Nix language and just writing them in their native form, is to symlink a bunch of files into a Git repo.

There's a whole bunch of ways to do this that work totally fine, and implementing this is *very* easy in any language that has usable ways of interacting with the filesystem.

I don't use the following sample myself, but I use a practically equivalent and much more complicated Python script called [polkadots] which I don't think is worth it for anyone else to use and which contains bugs.
You can equally use a dotfiles manager like [`rcm(1)`][rcm] or any other one, but a lot of those impose opinions on structure of dotfiles repos that are fine but not necessary, as well as additional bootstrapping dependencies and complexity.

Consider the following 19-line bash script as an example (CC-0, have fun!):

```bash
#!/usr/bin/env bash

scriptdir=$(cd "$(dirname -- "$0")" ; pwd -P)

function symlink() {
    if [[ -e "$2" && ! -L "$2" ]] ; then 
        echo "$2 exists and is not a symlink. Ignoring it." >&2
        return 1
    fi

    # "ln -sf source link" follows symlinks by default on ancient BSD (thus on macOS)
    # the fix on ancient BSD is to add -h, which would be incompatible with GNU
    # which doesn't do any of this nonsense and doesn't accept -h either
    #
    # Thus we get to -f ourselves because shell scripting is jank.
    [[ -L "$2" ]] && rm "$2"

    ln -sv "${scriptdir}/$1" "$2"
}

mkdir -p ~/.config
symlink nvim ~/.config/nvim
symlink git ~/.config/git
```

This will create a symlink at `~/.config/nvim` which leads to `nvim` in the directory the script is in.
Thus, your Neovim configuration is now in git and you can simply edit it in either the dotfiles repo or its normal location and then `git commit` it.

It gets synced between machines basically for free when you run `git pull`.
There's zero evaluation time when making changes to configurations because they're just files and running the script on the rare occasion that a new program is added takes milliseconds.

This script applies no opinions about how your dotfiles repo is structured, and you can modify it to apply any desired opinions or write it in a different language if desired.

My set of opinions is that each tool should have a directory for it and that the place it's actually linked to make it work should be abstracted away because I want to pretend that every tool actually implements the XDG Base Directories spec.

[rcm]: https://github.com/thoughtbot/rcm
[polkadots]: https://github.com/lf-/polkadots

### But that's two commands!

It's simple to do the symlinking by running something else at configuration switch time, either with a NixOS/home-manager mechanism or with a wrapper shell script.
Either an activation script or a systemd service would do for direct integration; the former is probably the right choice on home-manager due to macOS.

A wrapper around `nixos-rebuild` works as well.
I keep one of these per machine so I just run `./machine-name.sh`.

```bash
#!/usr/bin/env bash

cmd=${1:-switch}
shift
# Run the dotfiles script to make the symlinks
./dotfiles.sh
nixos-rebuild "$cmd" --sudo --no-build-nix --flake '.#myHost'
```

<aside>

Fun fact! Did you know that you can do remote deploys with just nixos-rebuild?

Add `--target-host user@host` option to nixos-rebuild and then you're deploying to a remote machine.

With `--build-host user@host`, you can even deploy *from macOS on Apple silicon to x86_64 Linux machines* using nixos-rebuild.

</aside>

## But pinning!

For things like editor plugins or any other dependencies, it's rather helpful to have pinning.
Unfortunately and rather ironically, getting editor plugins from nixpkgs technically means they're pinned but in practice probably means they are whatever the latest version is and get updated with all the other packages on the system, which is distinctly not pinning if you are just considering the editor setup in isolation.

There are good plugin managers like [lazy.nvim] which do pinning in the editor itself.
For the trouble of setting up the editor configuration to manage its own plugins, you get *instant* edits to your editor configuration and never have to wait for home-manager/NixOS to rebuild again.

[lazy.nvim]: https://github.com/folke/lazy.nvim

Another pinning approach is `git-submodule` or just putting the entire history into your git repo with `git-subtree` or [`git-subrepo`].
Vendoring like this means that things are very much pinned and don't even need to each out to the internet on their own, but it's a bit more inconvenient to update.

[`git-subrepo`]: https://github.com/ingydotnet/git-subrepo

## But what of packages?

These are totally reasonable to put in NixOS or home-manager and there's nothing wrong with using those systems for them, since the list to install rarely changes so the iteration time is rarely a significant bother.

If you want something that's not NixOS or home-manager for these, consider [flakey-profile], which allows installing a list of packages from a file into the system and user profiles and contains approximately 10 lines of code total.

[flakey-profile]: https://github.com/lf-/flakey-profile

## But what of deploys?

I don't have a clear answer for deploys of software that changes frequently.
It's often nicest if they are managed out-of-band and mutably with respect to the system configuration, but the options for it are often less ergonomic than putting it in the system configuration.

A friend of mine has been working on making a mutable `nixos-container` setup that works nicely to deploy containers defined in flakes, but from my limited code review, `nixos-container` could likely use a from-scratch out-of-tree competitor that's less tangled with NixOS, or a `nixos-rebuild-ng` genre of project to rewrite it in Rust.

It's pretty nice to build Docker/OCI images with [nix2container] or [`dockerTools.streamLayeredImage`][streamLayeredImage], but then you have to deploy Docker containers for which I have no nice answer.
Kubernetes or k3s exists, but it puts the complexity of NixOS to shame.

[nix2container]: https://github.com/nlewo/nix2container
[streamLayeredImage]: https://nixos.org/manual/nixpkgs/stable/#ssec-pkgs-dockerTools-streamLayeredImage

# Conclusion

The Nix ecosystem has a lot of really powerful big hammers that can be used to do very impressive things and make configuration management easy and fun, but the monolithic nature of the tools involved can make them *too* big of hammers.
It's very tempting, especially for newcomers, to Nixify their entire setup, but this is a hazardous temptation that results in more fighting Nix than necessary, reduces flexibility, and increases iteration times, for dubious benefit other than perhaps running fewer commands.

For the cost of copy pasting 20 lines of relatively self-explanatory bash, it's possible to have extremely simple dotfiles that are not tied to Nix at all and which work fine on NixOS.

For a lot of purposes, the simplest and best configuration management is a miserable pile of symlinks rather than the infamous compiler from "Haskell" to Bash known as Nix.
Nix is good for a whole lot, but you often just don't need it!
