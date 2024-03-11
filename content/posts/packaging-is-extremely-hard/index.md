+++
date = "2024-01-27"
draft = true
path = "/blog/packaging-is-extremely-hard"
tags = ["build-systems", "arch-linux", "linux", "nix"]
title = "Packaging is extremely hard, or, why building AUR packages in CI is a nightmare"
+++

Packaging on a traditional distribution is challenging to say the least, and I
haven't seen any coherent descriptions of *why* hermetic build systems like Nix
eliminate an entire category of needing to think about certain things. Recently
a friend mentioned she was considering setting up a CI service for some AUR
packages by a trivial cron job, whereas my reaction to the idea of CI for Arch
packages is "that would take a month of work to do correctly".

Let's explore the inherent complexity in writing a CI service for basically any
binary distro; picking on Arch Linux is only because it is what I have
experience with, though they tend to be especially fast and loose with inherent
complexity. One could argue that Arch in particular is the Go of distros, since
it ignores a lot of hard things in order to ship a working distro, similarly to
[how Go famously solves complexity by ignoring it][golang]. This is not about
factionalism; it is about the choices of where distro maintainers have spent
their energy, and ignoring complexity is something that has its place.

Arch is known for having a large user maintained repository of non-reviewed
community-written packaging for most anything under the sun called the AUR.
This is a blessing and a curse, because Arch is extremely a binary distro.
Pretty much this entire post would apply to anyone maintaining a binary
repository for another distribution, except perhaps the part of building
packages maintained by other people in CI.

[golang]: https://fasterthanli.me/articles/i-want-off-mr-golangs-wild-ride

[rebuild-conds]: https://wiki.archlinux.org/title/DeveloperWiki:How_to_be_a_packager#The_workflow
[rebuild-detector]: https://github.com/maximbaz/rebuild-detector

## "Rebuild conditions are indeterminate", or, why C++ people are always talking about ABI

If you are a downstream consumer of an official binary package, such as being
an AUR packager, there is not really any obvious notice that you should rebuild
your package due to dependency updates, besides, perhaps, [rebuild-detector]
and upgrading your system regularly.

The way that release management is done at Arch Linux is that maintainers
updating libraries go and [ping all their colleagues][soname-bump] when their
upstream changed their software so it is no longer binary-compatible
("ABI-compatible"), represented by a "soname bump", e.g. changing the file name
`libc.so.5` -> `libc.so.6`. This is not terribly unusual among distros.

However, it's perfectly possible that packages break their ABI without updating
their soname, since most changes to C header files besides adding things will
break ABI in theory, for instance, changing `#define` constants or other such
things. So, if upstream is being impolite, they can cause bugs at any time, and
blatant changes can be caught by things like [abi-checker], though they don't
necessarily form part of the official process for Arch.

[abi-checker]: https://lvc.github.io/abi-compliance-checker/

[soname-bump]: https://wiki.archlinux.org/title/DeveloperWiki:How_to_be_a_packager#Run_sogrep_on_identified_soname_change

When packages are rebuilt without being updated, this is done by incrementing
`pkgrel` in the PKGBUILD, which is achieved automatically in the official repos
with `pkgctl build --rebuild` ([man page][pkgctl-build]) of the affected
packages. For example, for a version `0.20.10-1`, incrementing `pkgrel` would
produce a version `0.20.10-2`, which is uploaded to staging as well as pushed
to the package's own Git repo with `pkgctl release`.

After all the builds are made, `pkgctl db move` is invoked to move all the
packages over.

<aside>

One might wonder why there is all this `pkgrel` business to begin with, and it
is simply that the package manager will only see an update if the version
changed, and in most systems, only if the version changed *upwards*, by
default.

</aside>

[pkgctl-build]: https://man.archlinux.org/man/pkgctl-build.1.en

### Atomicity? Is that like a criticality incident?

{% image(name="./antifa-demon-core.png", colocated=true) %}
an antifaschistische aktion sticker with a demon core in the middle,
"ausgerutscht, trotzdem da" on top and "kernphysiker antifa" on the bottom
{% end %}

<aside>

Demon core shitpost [made by Agatha](https://fv.technogothic.net/@AgathaSorceress/111810771067247145).

</aside>

If the official repos operate by coordination between all the packagers, with a
staging area to atomically release rebuilds, it follows that AUR packagers can
expect that official repos can and will change at any time without notification
(unless one goes and looks at the development bug tracker).

<aside>

**Uncertain** fact: the Arch repos seem to not have any versioning on the *set
of packages together*. Packages are moved to the primary repos, and then they
are there, but this seems to be just done by poking a file on disk; there is no
atomic versioning of the set as a whole, aside from hoping the [Arch Linux
Archive][arch-arm] has a useful snapshot on the relevant day.

</aside>

[arch-arm]: https://wiki.archlinux.org/title/Arch_Linux_Archive

This is a relatively reasonable process for a distro that doesn't fully
automate everything and even one that does, but it is kind of a problem if you
aren't an official maintainer working in the official repos, since you aren't
in the notification list.

Note also that the information that the AUR itself has on packages is not
sufficient to send emails about this either; this isn't the fault of the
Arch developers.

However, the upshot of this is that if one is using an AUR package maintained
by someone else, there is no guarantee anyone has tried building it against the
latest versions of the official repos, and it is in fact also impossible to
know what versions it was successfully built against. A local build of an AUR
package can get arbitrarily out of sync with the official repos and it is not
easily possible to reconstruct the state of all the repos that went into
building it.

Stuff randomly breaking due to repositories using the time of day as a software
version pinning mechanism is not just an AUR problem: it is much, much worse on
third-party binary repositories. For instance, even though [archzfs] is by far
one of the best executed third party repositories, in large part on account of
them running a CI service, it still can be out of time with the versions of the
kernel.

[archzfs]: https://github.com/archzfs/archzfs

However, the instance where third party repositories get *really* out of sync
with things is for things like Manjaro which have repositories delayed by two
weeks relative to Arch for "stability". This doesn't work out very well.

## The source-build-source cycle

For any package, a CI system that fully automates the packaging workflow needs
to be able to increment `pkgrel` on any dependency updates and trigger a
rebuild automatically. This is stored in the package source files: the CI
system has to be able to push to the sources automatically.

This also means that a CI system building someone else's AUR packages needs to
*fork any packages it builds*, since it must be able to update `pkgrel` based
on its own detection of upstream changes, without worrying about the AUR
maintainer doing it.

### Building someone else's stuff? Better reconcile it with automated local changes automatically

However, the even worse corrolary of the above is if the other maintainer
*does* update `pkgrel`, since then you have to reconcile your own maintained
`pkgrel` and ensure that it strictly increases even with the maintainer's
changes.

Another cause of needing to rebuild AUR sourced packages is the AUR package
itself changing, perhaps because upstream updated it and the AUR packager
updated their packaging. In that case, one has to discard local changes and
hope that versions strictly increased so pacman will install the new one.

## Weightless! In the package manager! Loopy dependency graphs

Debian ([documentedly so][debian-loopy]) and most other binary distros don't
have any tooling preventing packages forming circular build dependency graphs.
The most trivial one that exists in most any binary distribution is the C++
compiler, which is itself likely a build dependency of the C++ compiler since
both clang and gcc are written in C++.

How does one get the first compiler? In most distros, the answer is
"someone built it manually from somewhere and shoved it in /usr/local and then
built the first compiler package using some crimes". However, that path is, for
the most part, not documented or clearly reproducible. It is the typical state
of affairs to have the *distro repository itself* be a ball of inscrutable
mutable state.

In NixOS it's [a tarball of compilers that's built with Nix and is occasionally
updated][nixos-bootstrap-tools], and will in the future [be rooted in a 256
byte binary][nixos-minimal-bootstrap] after which everything is built from
source, which is what Guix also does. There's a bunch more information about
the efforts to bootstrap from nearly nothing at [bootstrappable.org], as well
as [on the Guix blog][fsb].

[bootstrappable.org]: https://bootstrappable.org/

[fsb]: https://guix.gnu.org/en/blog/2023/the-full-source-bootstrap-building-from-source-all-the-way-down/
[nixos-bootstrap-tools]: https://github.com/nixos/nixpkgs/blob/d0efa70d8114756ca5aeb875b7f3cf6d61543d62/pkgs/stdenv/linux/make-bootstrap-tools.nix#L237-L256
[nixos-minimal-bootstrap]: https://github.com/nixos/nixpkgs/blob/3dcd819caa03c848a9a06964857e12e4b789239e/pkgs/os-specific/linux/minimal-bootstrap/default.nix

[debian-loopy]: https://wiki.debian.org/CircularBuildDependencies

## Package tests? p--package integration t-tests??

So you want to write an integration test for your package on Arch Linux. That's
too bad, because there's not a testing framework, because there are not tests.
Packages can run the software's testsuite, but there is no officially supported
integration testing solution.

# Software engineering fixes this

I have spilled a thousand words on how traditional binary distros (that [are
not Fedora][fedora-ci]) spend a significant amount of labour doing rebuilds
largely by hand, with scripts on their local machines, coordinating amongst
maintainers. Most packages are built on developer machines, though [never on
Fedora][fedora-ci2] and only [sometimes on Debian][debian-ci], and thus cannot
necessarily be trusted to not be contaminated by the squishy mutable stuff that
happens on dev machines. Even though they are typically built in chroots, the
environment is not controlled.

[debian-ci]: https://ci.debian.net/

I have addressed how packages require manually poking `pkgrel` every time a
rebuild is necessary, and how the need for rebuilds affects downstream
builders. This is, incidentally, [largely still true on
Fedora][fedora-updates].

The (pessimistic but sound) way to manage rebuilds is to just recompile every
downstream when a single bit of any dependency changes. This is the approach
used by Nix and it trades a significant but not unaffordably large (for a big
distro) amount of computer time in a build cluster for not having to think
about any of this. ABI breaks cannot affect the distribution because everything
was built against the exact same libraries, together.

A Nix-like hermetic build system doesn't have a concept of `pkgrel`, because
packages are just what is in the single monorepo source tree on a given commit.
There is nothing wrong with the other approach of multiple repositories and
repository metadata that doesn't expose a single history, but it would be
useful to be able to cleanly ensure that a group of machines have exactly the
same packages on them as of some epoch, say.

Facebook has made a tool for RPM distributions that builds OS images with
Buck2, called [Antlir]. This takes snapshots of repositories and builds OS
images with a hermetic build system, such that they receive the exact same
result every time.

[Antlir]: https://facebookincubator.github.io/antlir/docs/

ABI breaks can *also* not break downstream consumers of `nixpkgs`, because Nix
builds out-of-tree stuff exactly the same using the same version set as
anything else: unlike every binary distribution, the distribution packages are
not special, and building out-of-tree stuff will never randomly break due to
ABI changes.

NixOS has a robust and widely used (1040 of them) [integration
test][nixos-integration-tests] system, like Fedora, testing most parts of the
system and [gating repository updates][nixos-gating] like Fedora Bodhi.

[nixos-gating]: https://status.nixos.org/
[nixos-integration-tests]: https://nix.dev/tutorials/nixos/integration-testing-using-virtual-machines.html
[fedora-updates]: https://docs.fedoraproject.org/en-US/fesco/Updates_Policy/
[fedora-ci2]: https://discussion.fedoraproject.org/t/report-from-the-reproducible-builds-hackfest-during-flock-2023/87469
[fedora-ci]: https://docs.fedoraproject.org/en-US/ci/
