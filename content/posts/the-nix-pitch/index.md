+++
date = "2023-02-05"
draft = true
path = "/blog/the-nix-pitch"
tags = ["nix"]
title = "The Nix pitch"
+++

I have probably caught a reputation of being a completely unrepentant Nix
shill. This blog post is pure Nix shilling, but intends to explain why it is so
transformational that people shill it so much.

This post is partially inspired by a line of thinking raised by [Houyhnhnm
Computing], ("hyou-nam") a blog series about an alternate universe of computing
framed as what would happen if the sentient horses from Gulliver's Travels saw
human computers. If you want more ideas of absurdities of how our computers
work and could be so much better, I highly recommend reading this site.

[Houyhnhnm Computing]: https://ngnghm.github.io/

There are a few properties that make the Nix ecosystem extremely interesting:

* Reproducibility (I promise you care about this!)
* Cross-language build system integration
* Incremental builds are trustworthy due to sandboxing
* Drift-free configuration management

[A friend said][mgattozzi-nix] that "unfortunately all my problems are now nix
problems if I don't understand it". This is essentially true: Nix is a machine
for converting otherwise-unsolved packaging and deployment problems into Nix
problems.

[mgattozzi-nix]: https://twitter.com/mgattozzi/status/1617604038517817344

The Nix ecosystem consists of the following components (which do not
necessarily need to be used at the same time):

* Nix, a sandboxed build system with binary caching.

  Nix knows how to build "derivations", build descriptions that amount to shell
  scripts. If the result of a derivation exists on a binary cache, it will be
  fetched instead of built locally.
* Nix language, a functional domain specific language for writing things to be
  built by Nix.

  If we consider the Nix language to be "Haskell", and derivations are "Bash",
  Nix is a compiler from Haskell to Bash.
* nixpkgs, the package collection used by NixOS (also usable without NixOS, and
  on macOS). The most up-to-date and largest distro repository on the planet.

  Allows composition of multiple language ecosystems with extensive programming
  language support.

  Has some of the best Haskell packaging available anywhere, and the only
  distro packaging of Haskell worth using for development.
* NixOS, a configuration management system masquerading as a Linux
  distribution. It uses a domain specific language embedded in the Nix language
  to define system images that are then built with Nix.

# Case studies

Let's go through some case studies of frustrating problems you may have had
with computers that don't happen in the Nix universe.

## Case study: docker image builds

Traditionally, Docker images are built by running some shell scripts inside a
containerized system, with full network access. These are *impossible* to
reproduce: the very instant you run `apt update && apt upgrade`, your image is
no longer reproducible. Let's tell a story.

You're working on your software one day, and unbeknownst to you, `libfoo` has a
minor upgrade in your distribution of choice. You rebuild your images and
production starts experiencing random segmentation faults. So you revert it and
go investigate why the new image has been broken. This has happened a few times
before, and you never know why it happened. It seems to happen at random when
you upgrade the base image, so you stick with the same base image from a year
ago before the last upgrade.

Today, you have received a feature request: generate screenshots of the website
to embed in Discord previews. Sweet, just add headless Chromium to the Dockerfile,
and .... oops, it's been deleted from the mirror because the version is too
old, and updating the package database with `apt update` would require fixing
`libfoo` as well as `libbar` (since that also broke in the meantime). Damn it!

Also, your image is 700MB, because it includes several toolchains, an ssh
client, git, and other things necessary to build the software. You could copy
the built product out, but doing so would require building an integration test
for the whole thing to ensure that nothing of importance was removed.

---

What went wrong? Dockerfiles don't specify their dependencies fully: they fetch
arbitrary content off the internet which may change without warning, and are
thus impossible to reproduce. There is no way to tell if software actually
requires some path to exist at runtime. It is impractical to use multiple
versions of the package set concurrently while working through
incompatibilities in other parts of the software: an upgrade is all or nothing.

What if you could declaratively specify system packages in the build
configuration, not pull in build dependencies for runtime, and have everything
come from a lockfile so it doesn't change unexpectedly? What if you could pull
only Chromium from the latest distro repositories while working on migrating
the rest?

Is this a broader failure of Linux distributions due to choosing global
coherence with respect to [the golden rule of software
distributions][golden-rule]? Can we have nice things?

[golden-rule]: https://www.haskellforall.com/2022/05/the-golden-rule-of-software.html

## Case study: configuration drift with Ansible

Ansible is a popular configuration management system that brings systems into
an expected state by ssh'ing into them and running Python scripts. I have used
it seven years ago to build a lab environment, and I hope they have improved
it, but my beefs with it are at the design level. Story time!

A year ago, you added a log sender with filebeat to ship logs to an
Elasticsearch cluster to aggregate all the logs. Recently, you changed the
application to send all logs to the systemd journal to introduce structured
logging. You changed the service to use journalbeat now and deleted the old
filebeat service configuration but for some reason, you're getting duplicate
log entries. What?

You build a new machine and it does not exhibit the same behaviour.

You look at one of the machines and realize it is concurrently running filebeat
and journalbeat. Whoops. You forgot to set the state of the old filebeat
service to `stopped`, and instead deleted the rule. Because Ansible doesn't
know about things it does not manage, the system *contains configuration that
diverges from what is checked in* to the git repository with the configurations.

---

What went wrong? Ansible doesn't own the system, it merely manages its own area
of the system. "You should have used [HashiCorp Packer]" rings through your
head. Building new system images and deleting the old machines is a great
solution to this issue, but it experiences exactly the same problem as Docker
during the image build process. If this is acceptable, it's honestly a great
solution over mutable configuration-management systems.

[HashiCorp Packer]: https://www.packer.io/

Imagine if you could change the configuration and know that none of the old one
was still around. Imagine being able to revert the entire system to an older
version, even on bare metal, without needing such a big hammer as snapshots,
which are also easy to forget to use for pure configuration changes.

## Case study: zfs via dkms

On most distributions, if you want to use a kernel module that's not available
in the mainline kernel, you have to use `dkms`, which is essentially some scripts
for invoking `make` to build the kernel modules in question. This is then
generally hooked into the package manager so that the modules are rebuilt every
time the Linux kernel is updated. `dkms` needs to be separate from the system
package manager since the system package manager does not know how to build
patched packages, source based packages, and similar things. Story time!

Several months ago, a new Linux kernel update broke the compilation of
zfs-on-linux. This is fine, it happens sometimes. I use zfs on the root
filesystem of my desktop machine, and I currently run Arch Linux on it. Arch
like most distros uses `dkms` to build these out of tree kernel modules.

I ran `pacman -Syu` and waited a few minutes. I then thoughtlessly closed the
terminal and restarted my computer, since there was no error visible in the
bottom of the logs. Whoops, it can't mount the root filesystem. That seems
rather important!

I then had to get out an Arch ISO to `chroot` into the system, install an older
Linux kernel and rerun the `dkms` build.

---

What went wrong? The system package manager only knows how to handle binary
packages, which means that anything source based is second class, and is
handled via hacks such as a hook to build out-of-tree modules at the end of the
installation process. If this fails, it can't revert the upgrade it just
finished. By design, most binary distros' package managers can have partial
upgrade failures, and when the driver for the root filesystem is in such an
upgrade, render your system unbootable.

Since the distro is not "you", they may have diverging priorities or concerns:
perhaps they don't feel comfortable shipping the zfs module as a binary, so you
have to build it from source on your computer. You can't do anything about
these decisions: do binary distributions actively enable software freedom or
ownership over your computing experience?

Imagine if system upgrades were atomic and would harmlessly fail if some
source-based dependencies could not build. Imagine if you could seamlessly
patch arbitrary packages without needing to change distributions or manually
keep track of when you have to do so. Imagine if there weren't a distinction
between distro packages and packages you have patched or written yourself.

Imagine if you could check in compiler patches to your work repository and
everyone would get the new binaries when they pull it next, without building
anything on their machines.

# The Nix pitch

Leveraging the Nix ecosystem, you can solve:

* Consistent development environments for everyone working on your project,
  with arbitrary dependencies in any language: you can ship your Rust SQL
  migration tool to your TypeScript developers. The distro war is over,
  everyone gets the exact same versions of the development tools with minimal
  effort. People can run whatever distro they want including macOS, and distro
  issues are basically gone.

  This also means that for personal projects, upgrading the system compiler
  does not break the build. Upgrades are done on your terms, by updating a
  lockfile in the project itself. You can have as many versions of a program as
  you'd like on your system, and they don't interfere with each other.

  It's possible to pull some tools from a newer version of nixpkgs than is used
  for the rest of the system, and this has no negative effects besides disk
  use.
* Fast, reproducible, and small image builds for Docker, Amazon, and anything
  else with the nixpkgs infrastructure or Determinate Systems [ephemera]. You
  know it reproduces because everything going into it is locked to a version.
* System configuration is no longer something to be avoided: when you work on
  your NixOS system configuration, you get the results of your work on all your
  machines and you get it forever, since you check it into Git.
* Patching software is easy, and you can ship arbitrary patches to the package
  set for projects anywhere you use Nix.

  There is no distinction besides binary caching between packages in the
  official repositories and what you create yourself. You can run your own
  binary cache for your project and build your patched dependencies in CI. I
  didn't care about software freedom until I actually *had* it.
* You can simply rollback to previous NixOS system images if an upgrade goes
  sideways. The entire system is one derivation with dependencies on everything
  it needs, and switching configurations is a matter of running a script that
  more or less switches a symlink and fixes up any systemd services. System
  upgrades cause extremely short downtime.

  Workload configuration/version changes behave exactly the same as OS updates.
* You don't have to think about the disparate configuration formats various
  programs use on NixOS. You just write your nginx config in Nix and it's no
  big deal.
* Software is composable in Nix: you can build a Haskell program that depends
  on a Rust library without tearing your hair out, since Cabal can just look in
  pkg-config and not have to know how to build any of it.

  Machine learning Python libraries require funny system packages? Nix just
  makes the Python libraries depend on the system packages.
* If you've used Arch, you may like the Arch User Repository. This is
  unnecessary under Nix: nixpkgs is liberal in what they accept as packages,
  and is both the largest and most up to date distro repository out there.

  Since Nix is a source based build system, you can just package what you need
  and put it in your configuration, to upstream later or never.

  You can get proprietary software: you can literally install the huge Intel
  Quartus toolchain for FPGA development from nixpkgs.

  Need patched software? Patch it, it's a few lines of Nix code to create a
  modified package based on one defined in nixpkgs, which will naturally be
  rebuilt if it changes upstream.

  The critical insight in why nixpkgs is so large is that maintainers aren't
  special. I maintain packaging in nixpkgs for packages which I also develop.
  Another reason for their success is that packages can depend on older e.g.
  llvm: global coherence is not required, multiple versions of libraries can
  and do exist.

[ephemera]: https://twitter.com/grhmc/status/1575518762358513665

## It's not all rosy

Nix has a lot of ways it needs to grow, especially in governance.

* Documentation is poor. Often the best choice is to read the nixpkgs source
  code, an activity [for which I have a guide][finding-functions-in-nixpkgs].

  There has been much work to make this better, but it is somewhat fragmented
  effort, hampered by both Flakes and the new CLI being in limbo for a long
  time.
* Tooling isn't the greatest.

  The UX design of the `nix` CLI is not very good, with unfortunate design decisions
  as the command to update everything being:

  > `nix flake update`

  However, to update one input:

  > `nix flake lock --update-input nixpkgs`

  This is [filed upstream](https://github.com/NixOS/nix/issues/5110) and is
  thankfully showing slow movement in a good direction.

  The older `nix-build`/`nix-shell`/`nix-instantiate`/`nix-store` CLI design is
  more troublesome since it crystallized over many years rather than being
  designed upfront.

  There are some language servers for Nix language, namely `rnix-lsp` and
  `nil`, and they both are OK, but their job is made much harder by Nix being a
  dynamic language and some of the patterns used commonly in Nix code being
  implemented in libraries, rendering their analysis challenging at best.

  For example, package definitions in nixpkgs are written as functions taking
  their dependencies as arguments. Static analysis of this is nearly hopeless
  without seeing the call site: you don't know anything about these values.

  The NixOS domain specific language is evaluated entirely in the Nix language,
  which slows it down and makes diagnostics challenging.
* Currently there are significant governance issues.

  There are conflicts of interest with the major corporate sponsors of Nix,
  Determinate Systems, employing many people in the Nix community. For example,
  the sudden introduction of [Zero to Nix][ztn] alienating [some of the
  official docs team][ztn-docs].

  This conflict of interest is especially relevant with respect to Flakes, the
  "experimental" built-in lockfile/project-structure system, which was
  developed as consulting (by people now working at Determinate Systems) for
  Target *first*, then brought [to RFC][flake-rfc] in experimental form, which
  was closed. The great flakification was done amidst the `nix` CLI redesign
  (also experimental) which has now been strongly tied to flakes with
  non-flakes as an afterthought, in spite of the composability issues with
  flakes such as inability to have dependencies between flakes in the same Git
  repository, thus incompatibility with monorepos.

  Currently the state of flakes is that a lot of people use it, in spite of
  experimental status. The people who don't want flakes as the only way of
  doing things are understandably very frustrated, some of them even going so
  far as to [rewrite Nix][tvix].

  The maintenance of the C++ Nix implementation is not very healthy and has a
  large PR backlog while at the same time the BDFL, Eelco Dolstra, commits
  directly to master. This situation is disappointing.

[ztn]: https://zero-to-nix.com/
[ztn-docs]: https://discourse.nixos.org/t/parting-from-the-documentation-team/24900
[finding-functions-in-nixpkgs]: https://jade.fyi/blog/finding-functions-in-nixpkgs/
[flake-rfc]: https://github.com/NixOS/rfcs/pull/49
[tvix]: https://tvl.fyi/blog/rewriting-nix

## How did they do it?

Every large company has rebuilt something Nix-like at some level, since at some
point everyone needs to have the same development environment which is the same
as production. Nix provides that tooling in a much more accessible form.

Here's some things they did to achieve it (see also [Eelco Dolstra's PhD thesis
for extensive details][eelco-thesis]):

[eelco-thesis]: https://edolstra.github.io/pubs/phd-thesis.pdf

### Every store path is a unique version and dependency closure

One of the *key* insights of the Nix implementation is that every path in the
Nix store (typically at `/nix/store`) has a hash in its name of either its
build plan or its content.

Nix derivations are either fixed-output, input-addressed, or
content-addressed. Fixed-output derivations can access the network, but their
output must match the expected hash. Input-addressed derivations are the
bread and butter of Nix today: the hash in the name of the output depends on
the content of the build plan. [Content-addressed
derivations][ca-derivations] are an experimental feature, potentially
promising to save a lot of compute time doing pointless rebuilds by allowing
multiple build plans to generate the same output path if the output is
identical (for example, consider the case of a shell comment change in a
build script).

All references to items in the Nix store (for example, in shebang,
derivation dependencies lists, shared object paths, etc) are by full path,
thus effectively creating a [Merkle tree] when they are themselves hashed:
the hashes of dependencies are included in the hash of the build plan.

The upshot of this is that any number of versions of a package can coexist,
allowing programs from older distribution versions, development versions, and
any other weird versions to run on the same system without trampling over
each others' libraries or requiring sandboxing.

This feature is necessary to the implementation of something like `nix-shell`
which brings packages into scope for the duration of a shell session, after
which they may be garbage collected later.

<aside>
One corollary of this insight is that it is impossible to provide Nix-like
behaviour of allowing multiple versions of a package to coexist on a single
system without either assigning hash-based names and making all references
use that globally unique name, or doing what nixpkgs'
<code>buildFHSUserEnv</code> and
Docker do and using Linux namespaces to run each application in its own
filesystem with the dependencies appearing at the expected locations.

Assume that a system was built using package version numbers to associate
dependencies: openssl 3.0 depends on glibc 2.36 by path, and so on. What
does one do if we rebuilt openssl 3.0 against some hypothetical
incompatible glibc 2.37? Does openssl get a new version number? The only
fully general solution is to ensure that changing any bit in a dependency
will change its dependents' versions.
</aside>

### Builds must be hermetic for trustworthy incremental builds

Nix builds are either sandboxed or forced to have an expected output, leaving
very little room for the typical incremental build issues everyone has had to
arise, since it is known exactly what went into the build. If it built today,
it's highly unlikely to have a different result tomorrow.

### Archive encoding leaves room for creativity

Nix chooses to hash archives *consistently*: when `.tar.gz` and other archive
files are unpacked, they are repacked into a archive format (NAR, "Nix
ARchive") that has exactly one encoding per directory structure, and that is
then hashed.

Recently, GitHub upgraded their Git version, changing the `tar` file encoder
and changing the hashes of all their source archives. These archives themselves
have never been guaranteed to be themselves bit-for-bit stable; just their
contents. However, they had been stable in practice for years. Build systems
that pin source archives from GitHub should hash contents instead of archives
because of this.

### Immutability/scratch-building system images make configuration drift impossible

NixOS uses the most reliable paradigm for configuration management: full
ownership over the system, effectively generating the system from scratch
every time, modulo reusing some of the bits that didn't change.

It keeps the configuration immutable once built. To change it, you rebuild the
configuration and then switch to it relatively atomically.

This contrasts with the way that other configuration management systems
(besides Packer and other image building tools) work, attempting to mutate
the system into the desired state, potentially allowing unmanaged pieces to
creep in and enable drift.

[ca-derivations]: https://www.tweag.io/blog/2021-12-02-nix-cas-4/
[Merkle tree]: https://en.wikipedia.org/wiki/Merkle_tree
