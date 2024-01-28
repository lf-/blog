+++
date = "2024-01-27"
draft = false
path = "/blog/build-systems-ca-tracing"
tags = ["build-systems", "nix"]
title = "Build systems: content addressed tracing"
+++

An idea I have lying around is something I am going to call "ca-tracing" for
the purposes of this post. The concept is to instrument builds and observe what
they actually did, and record that for future iterations such that excess
dependencies can be ignored if, *even if inputs changed*, the instructions are
the same and the files actually observed by the build are the same.

# Implementation

## Assumptions

This idea assumes a hermetic build system, since we need to know if anything
might have differed from build to build, so we need a complete accounting of
the inputs to the build. It is not necessarily the case that such a hermetic
build system would be Nix-like, however, it is easiest to describe on top of a
Nix-like; first one with build identity, then one that lacks build identity
like Nix.

This also assumes a content-addressed build system with early cut-off like Nix
with [ca-derivations]. In Nix's case, input-addressed builds are executed, then
renamed to a content-addressed path: if a build with different inputs is
executed once more with the same output, it is recorded as resolving to that
output, and further builds are cut off.

[ca-derivations]: https://www.tweag.io/blog/2021-12-02-nix-cas-4/

<aside>

Build identity is a term I invented referring to the idea that a build can know
about previous builds. Systems without build identity include those which
identify builds entirely with hashes, and the names are meaningless, such as
Nix. Build identity is an assumption that causes problems for multitenancy in
build systems, since there may be several versions of a package being built all
the time, based off of different versions from each other. I've [used the term
in a previous post][postmodern-build-sys].

[postmodern-build-sys]: https://jade.fyi/blog/the-postmodern-build-system/

There may be a recognized term for this property that I have not found, please
[email me](https://jade.fyi/about) or poke me on Mastodon if you know it.

</aside>

## Conceptual implementation

Conceptually, a build is a function:

> (*inputs*, *instructions*) -> *outputs*

We wish to narrow *inputs* to *inputs<sub>actual</sub>*, and save this
information alongside *outputs*. In a following build, we can then verify if
*instructions'* matches a previous build (*instructions*) and if so, extract
the values of the same dynamically observed *inputs'<sub>actual</sub>*, but
relative to *inputs'* and compare them to the values of
*inputs<sub>actual</sub>* from the previous build.

Since our build system is hermetic, if this hits cache, it can be assumed to have
identical results, modulo any nondeterminism (which we assume to be
unfortunate but unproblematic, and is there regardless of this technique).

## Making it concrete

A build ("derivation" in Nix) in a Nix-like system is a specification of:

* Inputs (files, other derivations)
* Environment variables
* Command to execute

The point of ca-tracing is to remove excess inputs, so let's contemplate how to
do that.

### File names

The inputs are files named based on `hash(contents)` in Nix, but we don't
know which contents we will actually access. This is a problem, since the file
paths of *inputs* need to remain constant across multiple executions of the
build (the paths for *inputs* must equal the paths for *inputs'*), since the
part of *inputs* that changed may be irrelevant to this build.

In a system that doesn't look like Nix, the input file paths might be the same
across two builds on account of not containing hashes, so this would not be a
problem.

We can solve the file names problem by replacing the hash parts in the input
filenames with random values per-run. These hashes should never appear, even in
part, in the output, if the builder is not doing things with them that would
render the build non-deterministic.

Unfortunately the file names may appear in the output through the ordering of
deterministic hash tables, for instance, which could be a problem; this exists
in practice in ELF hash tables for instance. Realistically we would need
file-type-specific rewriters to fixup execution output to a deterministic
result following multiple runs.

We would also have to rewrite those hashes within blocks of data read from
within the builder, but that's *possibly* just a few FUSE crimes away to be
able to do live, on-demand.

Following the build, the temporary hashes of the inputs can be substituted for
their concrete values pointing to the larger inputs †.

<aside>

† This creates a similar content-addressing equivalence problem as
[ca-derivations] themselves could introduce if they were differently designed,
where two paths might mean the same thing. The solution adopted by
ca-derivations is to hash the output with placeholders in place of its own hash
and then substitute the hash of the path within all files in it.

Specifically, consider a derivation Dep that depends on a derivation A.
Derivation A changes some file not looked at by Dep, producing derivation B,
and Dep has its rebuild skipped. Should the resulting path for Dep point to A
or B?

Perhaps the solution here is to use a content-addressed store or filesystem
with block cloning (zfs, btrfs, xfs) for which shoving duplicates in it is
~free, and actually *realize* the value of *inputs<sub>actual</sub>* to disk.

This would sadly not eliminate the need for randomizing and rewriting input
paths due to causality, since we simply do not know what paths are referenced
yet.

</aside>

### Tracing, filesystem

To trace a build, one would have to pull the filesystem activity. This is
possible with some BPF tracing constrained to some cgroup on Linux, so that is
not the hard part.

The data that would have to be known is:

* Observed directory listings with hashes
* Read file names matching *inputs*, with associated hashes
* Extremely annoyingly: `fstat(2)` results for all queried files in inputs
  (this is extremely annoying because everything calls `fstat` all the time
  pointlessly or to check for files being present, and it includes things like
  the length of a file, which could *in principle* cause unsoundness if not
  recorded).

This would then all be compared to the equivalent paths in *inputs'* and if the
hashes match, the previous build could be immediately used.

## Avoiding build identity; how would this work in Nix?

Nix is built on top of an on-disk key-value store (namely, the directory
`/nix/store`), which is a mapping:

> Hash -> Value

Thus, we just need to construct a hash in such a way that both Build and Build'
get the same hash value.

We could achieve this by modifying the derivation in a deterministic manner
such that two modified-derivations share a hash if they could plausibly have
ca-tracing applied. Specifically, rewrite the input hashes to something like
the following:

> hash("ca-tracing" + name + position-in-inputs) + "-" + name

When a build is invoked, modify the derivation, hash it, and check for the
presence of a record of a modified-derivation of the same hash, and then check
if the actually-used filesystem objects when applied to *inputs'* remain the
same.

# Use cases

This idea is almost certainly best suited for builds using the smallest
possible unit of work, both in terms of usefulness and likelihood of bugs in
the rewriting. To use the terminology from [Build Systems à la Carte][bsalc],
it is likely most useful for systems that are closer to constructive traces
than deep constructive traces.

[bsalc]: https://www.microsoft.com/en-us/research/uploads/prod/2018/03/build-systems.pdf

For example, if this is applied to individual compiler jobs in a C++ project,
it can eliminate rebuilds from imprecise build system dependency tracking,
whereas if the derivation/unit of work is larger, the rebuild might be
necessary anyway.

# Problems

* There could exist multiple instances of a modified-derivation with different
  filesystem activity, due to, say, a bunch of rebuilds against very
  differently patched inputs. This system would have to be able to either
  represent that or just discard old ones.
* Real programs abuse `fstat(2)` way too much and it's very likely that this
  whole thing might not actually get any cache hits in practice if `fstat`
  calls are considered. Without visibility into processes we cannot know if
  `fstat` calls' results are actually used for anything more than checking if a
  file exists.

  This might benefit from some limited dynamic tracing inside processes to
  determine whether the fstat result is actually read.
* The whole enterprise is predicated on generalized sound rewriting, which is
  likely very hard; see below.

## Naive rewriting is a bad idea

The implementation of ca-derivations itself, where it just rewrites hashes
appearing in random binaries with the moral equivalent of `sed`, is extremely
unsound with respect to compression, ordered structures (even NAR files would
fall victim to this), and any other kind of non-literal storage of store paths,
and this approach just adds yet more naive rewriting that is likely to explode
spectacularly at runtime.

Naively rewriting store paths is an extension of the original idea of Nix doing
runtime dependencies by naively scanning for reference paths. However,
crucially, the latter does not *modify* random binaries without any knowledge
of their contents, and the worst case scenario for that reference scanning is a
runtime error when someone downloads a binary package.

Realistically, this would have to be done with a "[diffoscope] of rewriters",
which can parse any format and rewrite references in it. We can check soundness of a
build under rewriting by simply running it more times. The rewriter need
not be a trusted component, since its impact is only as far as breaking your
binaries (reproducibly so), which Nix is great at already!

In an actual implementation, I would even go so far as saying the rewriter
*must not* be part of Nix since it is generally useful, and it is fundamentally
something that would have to move pretty fast and perhaps even have per-project
modifications such that it cannot possibly be in a Nix stability guarantee.

[diffoscope]: https://diffoscope.org/

# Related work

This is essentially the idea of edef's incomplete project [Ripple], an
arbitrary-program memoizer, among other work, but significantly scaled down to
be less general and possibly more feasible. Compared to her project, this idea
doesn't look into processes at all, and simply involves tracing filesystem
accesses to read-only resources in an already-hermetic build system.

Thanks to edef for significant feedback and discussion about this post. You can
[sponsor her on GitHub here][edef-gh] if you want to support her work on making
computers more sound such as the Nix content addressed cache project, tvix, and
also her giving these ideas to Arch Linux developers.

[edef-gh]: https://github.com/sponsors/edef1c

[Ripple]: https://nlnet.nl/project/Ripple/

