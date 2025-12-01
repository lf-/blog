+++
date = "2025-11-16"
draft = true
path = "/blog/fast-image-builders"
tags = ["nix"]
title = "You can build system images fast!"
+++

It's somewhat well known that `docker build` has terrible performance.
Builds of containers (like Docker) or of system images in general need not be slow.
In fact, building images is an activity which should in principle take at most 30 seconds, even for substantive images.
Nix achieves this, but it's not the only system with the properties necessary to do performant container/image builds.
The systems which are slow are slow due to fundamental design choices which:
- Limit their quality of layering, producing worse `docker pull` times and wasted bandwidth in production
- Make them produce non-reproducible artifacts

The traits shared by the fast container/image builders are:
- They can exploit concurrency by assembling composable pieces together
  - They understand the package manager inside
  - The package manager inside allows enough splitting for this to work
- They are generally integrated into another build system
- They have a cache of the composable pieces *outside* the container
- They don't run commands inside the container about to be shipped

This post treats putting the project into the container and builds of OS images as the same problem.
This is reflective of my biases as a distro maintainer: if one *does* build a project into a distro package using a build system, they become the same problem; if that makes it easier, do that!

# Related projects

- [bootc]: Boot a VM or hardware off of a layered container image.
  This is sick as hell. It means that we can have *just one* kind of image builder that supports overlayfs layers as a native feature.

  If someone were to do a layering approach similar to `nix2container`-built containers for another package manager, they could *turn other distros* into having nearly the same in-place servicing properties as NixOS.
- [nix2container]: Build container images out of Nix artifacts extremely fast.
- [antlir2]: Reproducible Docker images built with buck2.
  I've not looked too hard at this to know about its performance characteristics, but I would assume it's fast because it's not doing all the things which are slow.
- [Bazel rules_docker]: Docker images built with Bazel.
  I've also not looked too hard at this, but based on brief examination of the stated API, it seems to not solve the problem of installing system packages into a container at all.

[bootc]: https://bootc-dev.github.io/bootc/
[Bazel rules_docker]: https://github.com/bazelbuild/rules_docker

# What is `nix2container` doing to make a fast image builder?

The fastest Docker image builder I know of is [`nix2container`][nix2container], which does the following:
- Custom skopeo driver for loading groups of Nix store paths (read: groups of individual packages) into layers in a target registry or other location.
- Layers are composed of some number of Nix store paths and topologically sorted by dependency relations.
  - Relatedly, most images will have *dozens* of layers, which is almost unheard of in normal Docker images that don't have any amount of automatic layering.
  - Using many layers causes tarball blobs to be shared *between unrelated images* that happen to be using the same nixpkgs version.
- Merely assembling from pre-built artifacts in the Nix store from another build system: the artifacts already exist, so there are no forced dependency relations in the build or uncached downloads from the Internet.

[nix2container]: https://github.com/nlewo/nix2container

# Compositionality of package managers

TODO: this section should probably be killed

One of my character flaws is being very cranky about package managers.
This is partially because I've been spoiled by innovations in Nix:
- It's a build system, so there are no discontinuities between source-built packages and binary packages.
- It's a build system that can build both your application software and arbitrary sets of system packages you want to distribute with it.

  (see NOTE below)
- Packages are installed to locations that describe their entire build plan.

  This allows multiple versions or even different build configurations of the same version to exist in the dependency graph of one service.

  Such a property gives Nix the distinction of being the only(?) distro package manager that complies with [the golden rule of software distributions][golden-rule] by allowing multiple versions of packages and thus not requiring a globally coherent set of versions.
- Due to this isolation and the lack of post-install scripts, closures of packages *may be combined in arbitrary order, assuming they respect dependency ordering*.

[golden-rule]: https://www.haskellforall.com/2022/05/the-golden-rule-of-software.html?m=0

That last point means that Nix-shaped package managers theoretically allow for [multiple inheritance of container images], because they *do that* to the extreme in the system-wide Nix store!

[multiple inheritance of container images]: https://jyn.dev/build-system-tradeoffs#fr-11-1

The part of this that's relevant to performance is that *some subset* of packages in a traditional package manager, perhaps the closure of your build even, does fulfil this property of compositionality.
Thus, it can be split into layers by a container builder that is aware of the packaging system.

<aside>

NOTE: it's also possible to *not* build your application software with Nix and then distribute it with Nix anyway.
It requires some software I wish to publish soon to import the built artifacts from an external build system into the Nix store :)

</aside>

# Commutativity/associativity of the composition operation on packages

If a package manager doesn't care about the order of packages being installed (except for dependency relations), and if conflicts aren't allowed, it means that they can be installed *concurrently* and then glued together later using the various means of copying files for free.
Provided that a package manager is convinced to support this and it's integrated into an image builder, *any* package manager can do extremely fast container builds.

One unfortunate misfeature of most package managers makes this somewhat tricky as there are side effects to installing packages that don't necessarily compose properly when a package installation is run in many parts in parallel: [post-install scripts](#postinstall).
The side effects *could* be deferred until the end of the image build and then thrown into the very last layer, assuming that the package extraction can be done without running the scripts, but it's more ideal to just not do them.

# Techniques for fast builds

## Building the application before putting it into a container

This is practically a cheat code.
Most build systems are vastly better at concurrency and caching than `docker build` because they aren't building from scratch.
Use a normal build system to build the application, then put it in the container *after* building it.

This has a happy side effect of reusing the build cache infrastructure for the normal build and also avoids needing a complex build graph in the Docker build.

This works better with a hermetic build of the application though as it's easy to have undeclared dependencies otherwise.

## Copying files for free

There are multiple ways to copy files for approximately free.
To be able to use the various layering techniques as easily as possible, installing packages shouldn't have side effects like running post-install scripts.

The most free ones are not copying the files at all.

### Using overlayfs to split the filesystem into multiple

One can use overlayfs to assemble pre-existing paths together, which allows caching of file copies between runs.
An astute reader may notice that that is the same thing as "Docker layers"; that's right!

An even more creative reader might realize this could be done to a root filesystem for a VM as well, to deliver packages as a series of layers.
That is essentially [bootc] or Nix.

### Mounting the files into the image

Notably this requires the host system has the files, but *that's true in one's hot path in dev*.

One can implement development flows that run inside a container/VM by either copying the dependencies in from the host or by simply mounting them in.
There may be some temptation to copy them, perhaps because the container might mutate them undesirably, but that's expensive and pays a cost for parts that are copied without being used.

The temptation to copy into VMs is even higher, but it's not required for them either.
One can use [-virtfs in qemu] or similar to directly mount e.g. the Nix store from the host, avoiding needing to copy dependencies into a running image at all.
Such a trick allows for extremely fast rebuild/reboot cycles for developing a VM image; I [used it][microvm-nix-store] for my `flakey-ci` CTF challenge image.

On other distros, such a mounting-based solution might look like having a root filesystem or dev tools provided by a directory/container image on the host and then mounted into a VM.

[-virtfs in qemu]: https://www.qemu.org/docs/master/system/invocation.html
[microvm-nix-store]: https://github.com/ubcctf/maple-ctf-2023-public/blob/main/misc/flakey-ci/dist/micro.nix#L19-L24

### Straight up cheating

Who said the files have to be in the image to begin with?
With a FUSE filesystem they could be loaded on-demand from the network or another source.

### Concatenating CPIOs together

One thing which looks suspiciously like overlayfs is a Linux initrd: it's a CPIO archive!
CPIO is a funny and unusual archive format in that CPIOs may be concatenated together and the result is an archive which is a stack of all the constituent archives combined together.

This has been used to great effect by [nix-netboot-serve] to lazily stream Nix system images to hosts at line rate by concatenating together the desired set of store paths' CPIOs and sending it to the host.
Such CPIOs could conceivably be built on-demand into a local cache from a Nix cache such that nothing needs to be prepared ahead of time.

[nix-netboot-serve]: https://github.com/DeterminateSystems/nix-netboot-serve

Another way of doing this is to boot directly from a Nix substituter as was done by [Mutable's nixstrap][nixstrap].
One could imagine a combination of this idea and a FUSE filesystem to allow lazy-loading the entire system image out of a Nix substituter over the network.
This could possibly also be done with a Docker registry, but that's harder due to needing to identify the appropriate layer for a given file.

[nixstrap]: https://github.com/mutable/nixstrap

### reflinks, hardlinks, etc

These are the least free methods as they require a system call per file copied, but they're still faster than copying all the bytes.
If an image is composed of immutable files, one could use not-at-all-modern filesystem features like hard links (which mean that a file has multiple names; problematic if it's ever opened in write mode!) to copy files with O(1) performance in the size of file.

Otherwise, one could use modern filesystem features like reflinks, which rely on copy-on-write filesystems like ZFS, APFS, or btrfs to copy a file faster (compared to copying the bytes) while not occupying any additional space.

## Splitting the problem for concurrency

If the package manager allows for the dependency graph to be partitioned to multiple pieces, packages can be installed *concurrently* into separate layers which are later combined together.
Doing so means that the image is built as multiple build actions, one per layer, which can then be cached between runs and can run in parallel.

## Images aren't necessarily opaque disk images

Image-based deploys don't require that the image itself is a *single* disk image or other artifact; it could be a pile of layer tarballs (such as a [bootc] Docker image), Nix store paths, or something else.
They just require that the system to produce the image is simple/predictable (more like a pile of signed tarballs than like `dnf`/`apt`/etc), immutable, and atomically replaceable.

That is, image-based OSes may be upgraded via a delta upgrade mechanism, provided that the image is composed of chunks that may be reused in future image versions.
Being able to use a delta upgrade mechanism makes image rebuilds and pulls vastly faster as it eliminates an enormous amount of network transfer when e.g. just the application but not the base image is replaced.

# Barriers to fast builds

## Booting the target image

Booting the target image/container is not only slow but also fraught with peril.

For instance, it's trivial to accidentally leave `/etc/machine-id`, log files, `bash_history`, Firefox cookies (embedded vendors, man...) in the built image.
The easiest way to not have this problem is to just not boot the image customers will receive before it arrives on final devices.

Linux also takes a few seconds to boot, which causes considerable slow-downs in the build.
It's true that some partitioning and filesystem creation is impossible to do without the ability to boot a system, but this should be resolved with better userspace tools or by doing such servicing from a *different* Linux image acting on the disk, not by booting the final image.

## Fetching and installing packages needs to get out of the image builder

As far as I'm aware, a *primary reason* Docker images are slow to build and non-reproducible is that they run `apt update` and then `apt install`.
A secondary reason is that project builds aren't cached and download dependencies off the Internet on every run.

Merely running `apt update` instantly makes the image have a dependency on the calendar date as there's no specification of *which* apt index version is in use, so the image is not reproducible, and it is unsound to cache it as building it tomorrow has a different result.
Furthermore, `apt install` will re-fetch packages on every new build without caching in any way.

<aside>

I am aware that "it's unsound to cache it" are strong words to say about `docker build` and perhaps might even imply that the `docker build` cache itself is a bad idea that causes millions of devs to get gaslit by the computer every day.
That's correct.
Loads of people use that thing every day with <del>no problems</del>\^W\^Wa lot of denial of the problems.

</aside>

The way this should work is how [antlir2] or Nix implements package downloads: check in a lock file of the package manager index version to source control, which immediately acheves reproducibility.
Then, download the packages *outside the image* and install them in a target directory in the image with an option like pacman's `--root`.
This allows having caching for package downloads, which greatly improves build performance, independently of making installation faster (see ["Techniques for fast builds"](#techniques-for-fast-builds)).

[antlir2]: https://facebookincubator.github.io/antlir/

*The original sin* of `docker build` was running the build as a distro-agnostic shell script inside the image, which, if it's the only thing one has experienced, makes it feel like a better world isn't possible.

## Package manager databases

One side effect of installing a package is that the package manager database gets written into to track what was installed, which files it has, and similar such things.
Obviously one can't just stick together a pile of layers which have a package manager database in them without any way of combining those.
Fortunately, these may be combined by simply deleting the database, since one is not expecting to service a Docker image with a package manager rather than replace it!

## Hell is post-install scripts {#postinstall}

*Most* package managers except for Nix and [Solaris IPS] have a critical design flaw that makes a whole bunch of use cases in this post much harder: they have support for post-install scripts in packages.
Post-install scripts aren't necessary: when the Solaris devs were writing IPS, they surveyed all the common effects people wrote in their post-install scripts, made declarative replacements for them all, then removed the feature.

Killing post-install scripts in favour of (1) declarative configuration and (2) systemd services enforces a much clearer contract with packages: post-install effects are implemented in tested code, can specify their dependencies, and can run concurrently.

[bootc's documentation][bootc-postinstall] describes one reason why post-install is such a pain in the neck: mutable user-area modifications and system modifications are mixed together.

[bootc-postinstall]: https://bootc-dev.github.io/bootc/building/users-and-groups.html#system-users-and-groups-added-via-packages-etc

However, there's a couple much more pernicious reasons post-installs are a pain in the neck, which generally stem from simply not being able to know what effects these post-install scripts have, and a historically unclear/unenforced contract on how, when, and in what order they should be run.

They don't compose commutatively: package `nginx` and package `minecraft` don't have any reason to have any particular ordering relation between them, yet the package manager needs to run the post-install scripts in some order.
Does some other package depending on `nginx` need to be installed on a system on which the `nginx` post-install script has already run? Who knows!
If one makes the conservative choice, one has to at least partially serialize these in some order; perhaps dependency order; which means they can't be executed concurrently.

They *generally* don't work well for offline servicing, cross compilation, and fast image builds: a post-install script probably needs to run on the same machine architecture as the target host and may rely on an arbitrary amount of the system being up.
It may be the case that a post-install script is, for example, broken when doing servicing or an image build inside a chroot.
Ideally even chroots don't exist, though! They're much better than booting the image in a VM for performance, but they still interfere with cross-compilation and still can pollute the image with unknown contents like temporary files.

Another reason that post-install scripts have no place in an image-based OS is that the semantics of replacing a system image wholesale are totally unclear with them:
- Do the post-install scripts exist as a final integration step for the image build and thus only touch things in `/usr` (or other places on the immutable partition)?

  Then they shouldn't be run on anything but the image builder.

  But even if they *do* run on the image builder, are dependencies specified? Can they run concurrently?
  If not, they will slow down builds.
- Do the post-install scripts exist to mutate `/etc/passwd` to add a user or other similar things?
  Then they should probably run on target machines on first boot of a new version.
  In what order? Concurrently? Who knows!
  What if the user upgraded multiple versions ahead?

  You also have to track whether you've run them. Uhhhhhhh. Ruh roh.

This is all entirely discounting the fact that post-install scripts are shell scripts and you'd bet they have no error handling (and an unclear contract on what to do if they fail: roll back the upgrade? keep going cause the system will boot just fine? who knows!).
Most of them are the same small list of things:
- Starting a service.
  This should use package-manager specific semantics, as it's unclear whether the user actually *wishes* that the service be started right after installation.
  If it's Debian, [usually it will be started][debian-service-start].
- Creating some users. Use [systemd-sysusers].
- Creating some directories or files or symlinks on the user's disk. Use [systemd-tmpfiles].
- Doing some first time initialization for a service's mutable state. Use a systemd unit which is `WantedBy=` and `Before=` the actual service.
- Updating some system-wide cache like [ldconfig], [fontconfig], or `.application` files.

  In an image based distro, if these are only over immutable resources, this should happen in the build process of the image, likely after assembly; ick!
  If they are over mutable resources, this should be implemented by executing a systemd service, perhaps using [ConditionNeedsUpdate] to skip it if unnecessary, and if it's image-based, this has to happen on the next boot as the image is built offline.

[ldconfig]: https://man.freebsd.org/cgi/man.cgi?query=ldconfig&apropos=0&sektion=0&manpath=Debian+13.1.0&arch=default&format=html
[fontconfig]: https://man.freebsd.org/cgi/man.cgi?query=fc-cache&apropos=0&sektion=0&manpath=Debian+13.1.0&arch=default&format=html
[ConditionNeedsUpdate]: https://www.freedesktop.org/software/systemd/man/latest/systemd.unit.html#ConditionNeedsUpdate=

List of shame of particularly problematic post-install scripts:
- Building an initrd at the very end of the package manager transaction.

  This is because the initrd builder isn't able to run with the *new* system's packages before they're mutably installed over the system, even though that would be *great* as it would allow the initrd builder to fail before the update transaction is actually committed.
  That is in turn because of the distro [being on the sad side of the golden rule of software distributions][golden-rule] by not allowing multiple versions to be installed at once.

  Arch is perhaps "unique" in having only one kernel version on disk at once, so any crash between installing the kernel and building the initrd renders the system unbootable as the old initrd contains kernel modules for a different kernel version.

  Debian fixes this problem by keeping the old kernel around for a bit.
  NixOS fixes this by building the system image before switching to it.
- Building kernel modules *with dkms*.
  This one is particularly hilarious because on Arch, the dkms hook deletes the kernel modules before installing any packages.
  These kernel modules might contain the filesystem driver to, you know, be able to boot at all, so if the package installation or dkms build fails, you automatically get an unbootable system.

  NixOS fixes this by building the system image before switching to it.
- NixOS activation scripts.
  These aren't quite post-install scripts, but they're very similar: they are run on switching to a new system image, including very early at boot.

  The problem with these is that they have no clear contract: for example, they historically had a direct connection to the stdin of the `nixos-rebuild` process, so some users *might* have put password prompts into a tiny minority of these scripts.
  This interfered with the process of moving system activation to run in a systemd service as we might have had to either do some engineering to maintain the old behaviour or remove support for stdin in activation scripts.

  We were moving activation into systemd in the first place so that desktop environments exploding (happens sometimes if you mess up) wouldn't cause switching system versions to get interrupted halfway through and possibly break the system.


[debian-service-start]: https://unix.stackexchange.com/a/614330
[systemd-sysusers]: TODO
[systemd-tmpfiles]: TODO
[Solaris IPS]: TODO

<aside>

Incidentally, most [MDM] solutions or even the macOS [.pkg] format are basically just post-install scripts in a trench coat.
Why are we giving ourselves so much power and surface area to screw up and put the machine into an unknown state?

</aside>

[MDM]: TODO
[.pkg]
