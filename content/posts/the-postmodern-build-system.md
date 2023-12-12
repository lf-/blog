+++
date = "2023-12-11"
draft = false
path = "/blog/the-postmodern-build-system"
tags = ["nix"]
title = "The postmodern build system"
+++

This is a post about an idea. I don't think it exists, and I am unsure if I
will be the one to build it. However, something like it should be made to
exist.

# What we want

* Trustworthy incremental builds: move the incrementalism to a distrusting
  layer such that the existence of incremental-build bugs requires
  hash collisions.

  Such a goal implies sandboxing the jobs and making them into pure functions,
  which are rerun when the inputs change at all.

  This is inherently wasteful of computation because it ignores semantic
  equivalence of results in favour of only binary equivalence, and we want to
  reduce the wasted computation. However, for production use cases, computation
  is cheaper than the possibility of incremental bugs.
* Maximize reuse of computation across builds. Changing one source file should
  rebuild as little as absolutely necessary.
* Distributed builds: We live in a world where software can be compiled much
  faster by using multiple machines. Fortunately, turning the build into pure
  computations almost inherently allows distributing it.

# Review

## Build systems à la carte

This post uses language from ["Build systems à la carte"][bsalc]:

* Monadic: a build that needs to run builds to know the full targets. It's so
  called because of the definition of the central operation on monads:

  `bind :: Monad m => m a -> (a -> m b) -> m b`

  This means that, given a not-yet-executed action returning `a` and a function
  taking the resolved result of that action, you get a new action whose shape
  depends an arbitrarily large amount on the result of `m a`. This is a dynamic
  build plan since the full knowledge of the build plan requires executing `m
  a`.
* Applicative: a build for which the plan is statically known. Generally this
  implies a strictly two-phase build where the targets are evaluated, a build
  plan made, and then the build executed. This is so named because of the
  central operation on applicative types:

  `apply :: Applicative f => f (a -> b) -> f a -> f b`

  This means, given a predefined pure function inside a build, the function can
  be executed to perform the build. But, the shape of the build plan is known
  ahead of time, since the function cannot execute other builds.

[bsalc]: https://www.microsoft.com/en-us/research/uploads/prod/2018/03/build-systems.pdf

## Nix

As much of a Nix shill as I am, Nix is not the postmodern build system. It has
some design flaws that are very hard to rectify. Let's write about the things
it does well, that are useful to adopt as concepts elsewhere.

Nix is a build system based on the idea of a "derivation". A derivation is
simply a specification of an execution of `execve`. Its output is then stored
in the Nix store (`/nix/store/*`) based on a name determined by hashing inputs
or outputs. Memoization is achieved by skipping builds for which the output
path already exists. The path is either:

- Named based on the hash of the contents of the derivation: input-addressed

  This is the case for building software, typically.
- Named based on the hash of the output: fixed-output

  This is the case for downloading things, and in practice has a relaxed
  sandbox allowing network access. However, the output is then hashed and
  verified against a hardcoded value.
- Named based on the output hash of the derivation, which is not fixed:
  content-addressed.

  See [`ca-derivations`][ca-drv].

{% codesample(desc="The derivation for GNU hello") %}
```json
{
  "/nix/store/nvl9ic0pj1fpyln3zaqrf4cclbqdfn1j-hello-2.12.1.drv": {
    "args": [
      "-e",
      "/nix/store/v6x3cs394jgqfbi0a42pam708flxaphh-default-builder.sh"
    ],
    "builder": "/nix/store/q1c2flcykgr4wwg5a6h450hxbk4ch589-bash-5.2-p15/bin/bash",
    "env": {
      "__structuredAttrs": "",
      "buildInputs": "",
      "builder": "/nix/store/q1c2flcykgr4wwg5a6h450hxbk4ch589-bash-5.2-p15/bin/bash",
      "cmakeFlags": "",
      "configureFlags": "",
      "depsBuildBuild": "",
      "depsBuildBuildPropagated": "",
      "depsBuildTarget": "",
      "depsBuildTargetPropagated": "",
      "depsHostHost": "",
      "depsHostHostPropagated": "",
      "depsTargetTarget": "",
      "depsTargetTargetPropagated": "",
      "doCheck": "1",
      "doInstallCheck": "",
      "mesonFlags": "",
      "name": "hello-2.12.1",
      "nativeBuildInputs": "",
      "out": "/nix/store/sbldylj3clbkc0aqvjjzfa6slp4zdvlj-hello-2.12.1",
      "outputs": "out",
      "patches": "",
      "pname": "hello",
      "propagatedBuildInputs": "",
      "propagatedNativeBuildInputs": "",
      "src": "/nix/store/pa10z4ngm0g83kx9mssrqzz30s84vq7k-hello-2.12.1.tar.gz",
      "stdenv": "/nix/store/wr08yanv2bjrphhi5aai12hf2qz5kvic-stdenv-linux",
      "strictDeps": "",
      "system": "x86_64-linux",
      "version": "2.12.1"
    },
    "inputDrvs": {
      "/nix/store/09wshq4g5mc2xjx24wmxlw018ly5mxgl-bash-5.2-p15.drv": {
        "dynamicOutputs": {},
        "outputs": [
          "out"
        ]
      },
      "/nix/store/cx5j3jqvvz8b5i9dsrn0z9cxhfd8r73p-stdenv-linux.drv": {
        "dynamicOutputs": {},
        "outputs": [
          "out"
        ]
      },
      "/nix/store/qxxv8jm6z12vl6dvgnn3yjfqfgc68jhc-hello-2.12.1.tar.gz.drv": {
        "dynamicOutputs": {},
        "outputs": [
          "out"
        ]
      }
    },
    "inputSrcs": [
      "/nix/store/v6x3cs394jgqfbi0a42pam708flxaphh-default-builder.sh"
    ],
    "name": "hello-2.12.1",
    "outputs": {
      "out": {
        "path": "/nix/store/sbldylj3clbkc0aqvjjzfa6slp4zdvlj-hello-2.12.1"
      }
    },
    "system": "x86_64-linux"
  }
}
```
{% end %}

### `execve` memoization and the purification of `execve`

Central to the implementation of Nix is the idea of making execve pure. This is
a brilliant idea that allows it to be used with existing software, and probably
would be necessary at some level in a postmodern build system.

The way that Nix purifies `execve` is through the idea of "unknown input xor
unknown output". A derivation is either input-addressed, with a fully specified
environment that the `execve` is run in (read: no network) or output-addressed,
where the output has a known hash (with network allowed).

With [`ca-derivations`][ca-drv] ([RFC][ca-drv-rfc]), Nix additionally
deduplicates input-addressed derivations with identical outputs, such that
changes in how something is built without changing its output avoid rebuilds.
This solves a large problem in practice since NixOS has a huge build cluster to
cope with having to rebuild the entire known universe when one byte of glibc
changes, even if it will not influence downstream things. There are current
projects to deduplicate the public binary cache, which is hundreds of terabytes
in size, by putting it on top of a content-addressed store, independently of
Nix itself doing content-addressing.

[ca-drv]: https://www.tweag.io/blog/2021-12-02-nix-cas-4/
[ca-drv-rfc]: https://github.com/nixos/rfcs/blob/master/rfcs/0062-content-addressed-paths.md

This idea of memoized pure `execve` is brilliant because it purifies impure
build systems by ensuring that they are run in a consistent environment, while
also providing some manner of incrementalism. Nix is a source-based build
system but in practice, most things can be fetched from the binary cache,
making it merely a question of time whether a binary or source build is used.

A postmodern build system will need something like memoized `execve` to be able
to work with the tools of today while gaining adoption; allowing for
coarse-grained incremental builds.

### Recursive Nix, import-from-derivation, dynamic derivations

Nix, the build daemon/execve memoizer, is not a problem for monadic builds and
the problem with this lies entirely in the Nix language and its C++
implementation.

Nix is a monadic build system, but in a lot of contexts such as in nixpkgs, due
to NixOS Hydra using [restrict-eval] (which I don't think is documented
anywhere, but IFD is banned), it is restricted to only applicative actions in
practice, for the most part.

There are a few ideas to improve this situation, which are all isomorphic at
some level:
* [Recursive Nix][recursive-nix]: Nix builds have access to the daemon socket
  and can execute other Nix evaluations and Nix builds.
* [Import from derivation][import-from-derivation]: Nix evaluation can demand a
  build before continuing further evaluation. Unfortunately, the Nix evaluator
  [cannot resume remaining other evaluation while waiting for a
  build][ifd-bad], so in practice, IFD tends to seriously blow up evaluation
  times by repeated blocking and loss of parallelism.
* [Dynamic derivations][dyndrv]: The build plans of derivations can be
  derivations themselves, which are then actually built to continue the build.
  This crucially allows the Nix evaluator to not block evaluation for monadic
  dependencies even though the final build plan isn't fully resolved.

  However, this is ultimately a workaround for a flaw in the Nix evaluator and
  alternative implementations like [tvix] or alternative surface languages like
  [Zilch] are unaffected by this limitation.

[restrict-eval]: https://nixos.org/manual/nix/stable/command-ref/conf-file.html#conf-restrict-eval
[recursive-nix]: https://github.com/NixOS/nix/issues/13
[import-from-derivation]: https://nixos.org/manual/nix/unstable/language/import-from-derivation
[ifd-bad]: https://jade.fyi/blog/nix-evaluation-blocking/
[dyndrv]: https://github.com/NixOS/nix/issues/6316
[tvix]: https://tvix.dev/
[Zilch]: https://media.ccc.de/v/nixcon-2023-36425-reinventing-the-wheel-with-zilch

### Inner build systems, the killjoys

Nix can *run* monadic build systems inside of a derivation, but since it is not
monadic in current usage, builds of very large software wind up being executed
in one *giant* derivation/build target, meaning that nothing is reused from
previous builds.

This wastes a lot of compute building identical targets inside the derivation
every time the build is run, since the build system is memoizing at too coarse
of granularity.

Puck's [Zilch] intends to fix this by replacing the surface language of Nix
with a Scheme with native evaluation continuation, and integrating
with/replacing the inner build systems such as Ninja, Make, Go, and so on such
that inner targets are turned into derivations, thus immediately obtaining
incremental builds and cross-machine parallelism using the Nix daemon.

### Limits of `execve` memoization

Even if we fixed the Nix surface to use monadic builds to make inner build
systems pure and efficient, at some level, *our problem build systems become
the compilers*. In many compilers that are not C/C++/Java, the build units are
much larger (for example the Rust compilation unit is an entire crate!), so the
compilers themselves become build systems with incremental build support, and
since we are a trustworthy-incremental build system, we cannot reuse previous
build products and cannot use the compilers' incrementalism.

That is, the compilers force us into too coarse an incrementalism granularity,
which we cannot do anything about.

For example, in Haskell, there are two ways of running a build: running `ghc
--make` to build an entire project as one process, or running `ghc -c` (like
`gcc -c` in C) to generate `.o` files. The latter eats `O(modules)` startup
overhead in total, which is problematic.

The (Glorious Glasgow) Haskell compiler can reuse previous build products and
provide incremental compilation that considers semantic equivalence, but that
can't be used for production builds in a trustworthy-incremental world since
you would have to declare explicit dependencies on the previous build products
and accept the possibility of incremental compilation bugs. Thus, `ghc --make`
is at odds with trustworthy-incremental build systems: since you cannot provide
a previous build product, you need to rebuild the entire project every time.

<aside>

In fact, `ghc --make` is exactly what `nixpkgs` Haskell uses! This would be
much more of a problem if it were actually feasible to do monadic builds in
Nix. In order to cut compile times, Gabriella Gonzales, Harry Garrood, I, and
others worked on figuring out how to pass in the previous incremental build
products.

* [Final version][gabriella-post], fetching the first Git revision of the day
  and using a clean build of it as a source of incremental build products. This
  has a few negatives such as rebuilding the second change of the day every
  time, but it notably has only one layer of untrustworthy incremental build,
  which likely reduces the ability of incremental bugs to seriously propagate.
* [Prototype version][incr-proto], which simply takes "some incremental
  products", which might be acquired by a Hydra last-job reference or similar,
  and produces incremental products as a second Nix-level output.
* [ghc-nix], which uses recursive Nix to turn Nix into an incremental layer for
  Haskell using `ghc -c`. This is most notably just plain slow, although I
  suspect it could be optimized at the Nix-usage level. Also, a practical
  deployment of this would additionally require [`ca-derivations`][ca-drv] to
  avoid rebuilding identical objects. We considered using [dynamic
  derivations][dyndrv] as a possible alternative to full recursive Nix but they
  were not code-complete at the time.

[incr-proto]: https://github.com/hdgarrood/haskell-incremental-nix-example
[gabriella-post]: https://www.haskellforall.com/2022/12/nixpkgs-support-for-incremental-haskell.html
[ghc-nix]: https://github.com/matthewbauer/ghc-nix

</aside>

This tension between incrementalism and execution overhead is something that
needs to be addressed in a postmodern build system by integrating into inner
build systems.

## [The Birth and Death of JavaScript][tbdojs]

A [stunningly prescient talk][tbdojs] from *2014* predicting that all of
computing will be eaten by JavaScript: operating systems become simple
JavaScript runtimes, but not because anyone writes JavaScript, and JavaScript
starts eating lower and lower level pieces. It predicts a future where
JavaScript is the lingua franca compiler target that everything targets,
eliminating "native code" as a going concern.

Of course, this didn't exactly happen, but it also didn't exactly *not* happen.
WebAssembly is the JavaScript compiler target that is gathering nearly
universal support among compiled languages, and it allows for much better
sandboxing of what would have been native code in the past.

[tbdojs]: https://www.destroyallsoftware.com/talks/the-birth-and-death-of-javascript


## [Houyhnhnms]: horse computers?

There is a blog that inspired a lot of this thinking about build systems:
[Houyhnhnm computing][Houyhnhnms], or, as I will shorten it, the horseblog. For
those unfamiliar, the horseblog series is an excellent read and I highly
recommend it, as an alternative vision of computing.

In short, horseblog computers have:
- Persistence by default, with the data store [represented][hnm-3] by algebraic data
  types with functions to migrate between versions, automatic
  backup/availability everywhere, and automatic versioning of all kinds of data.
- Treatment as *computing* systems, rather than *computer* systems. The system
  itself is much more batteries-included and well-thought-out.
- High abstraction level, and thus, the ability to [transform programs][hnm-4]
  to run in different contexts with different properties in terms of persistence,
  performance, availability, etc.
- Automatic, trivial sandboxing; running multiple versions of software
  concurrently is trivial.
- [Hermetic build systems][hnm-9] with determinism, reproducibility, input-addressing.
  They handle every size of program build, from building an OS to building a
  program. They deal gracefully with the [golden rule of software
  distributions][golden-rule]: having only one version at a time implies a
  globally coherent distribution.

  A build system is a meta-level construct usable for all kinds of computation
  on the *computing platform*, not just compiling software.

  Wait a minute, we went meta, oops! :)


[Houyhnhnms]: https://ngnghm.github.io/index.html
[hnm-3]: https://ngnghm.github.io/blog/2015/08/09/chapter-3-the-houyhnhnm-version-of-salvation/
[hnm-4]: https://ngnghm.github.io/blog/2015/08/24/chapter-4-turtling-down-the-tower-of-babel/
[hnm-9]: https://ngnghm.github.io/blog/2016/04/26/chapter-9-build-systems/
[golden-rule]: https://www.haskellforall.com/2022/05/the-golden-rule-of-software.html

## [Unison]

Unison is a computing platform that is remarkably horseblog-brained. I don't
know if there is any intentional connection, since given enough thought, these
are fairly unsurprising conclusions. Unison is a programming platform
containing:

- An editor
- A language that is pretty Haskell-like, which is pure by default, with
  integrated distributed computing support
- A version control system
- Content-addressed code handling: syntax trees are hashed, and compiled only
  once, correctly.
- Integrated persistence layer for any values including functions, with fully
  typed storage.

My take on Unison is that it is an extremely cool experiment, but it sadly
requires a complete replacement of computing infrastructure at a level that
doesn't seem likely. It won't solve our build system problems with other
languages today.

[Unison]: https://www.unison-lang.org/

## [rustc queries], [salsa]

Let's consider the Rust compiler as an example of a program that contains a build
system that would need integration with a postmodern build system to improve
incrementalism.

Note that I am not sure if this information is up to date on exactly what rustc
is doing, and it is provided for illustration.

rustc contains a query system, in which computations such as "compile crate"
are [composed of smaller steps][rustc queries] such as "parse sources",
"convert function f to intermediate representation", and "build LLVM code for
this unit". These steps are persisted to disk to provide incremental
compilation.

<!-- FIXME: this is shit wording -->

In order to run a [computation whose inputs may have changed][rustc-explain],
the subcomputations are computed recursively. Either:

- The computation has all green inputs, so it's marked green.
- The computation has different inputs than last time, so it's marked grey,
  evaluated, and then marked green if it's the same result, and red if it's a
  different result.

However, this is all done internally in the compiler. That renders it
untrustworthy and a trustworthy incremental build system will ignore all of it
and rebuild the whole thing if there is a single byte of change.

[rustc-explain]: https://github.com/nikomatsakis/rustc-on-demand-incremental-design-doc/blob/master/0000-rustc-on-demand-and-incremental.md
[rustc queries]: https://rustc-dev-guide.rust-lang.org/query.html
[salsa]: https://rustc-dev-guide.rust-lang.org/salsa.html

In a postmodern build system with trustworthy incremental builds, such a
smaller build system inside a compiler would have to be integrated into a
larger one to get incremental builds safely. We can imagine this being achieved
with a generic memoization infrastructure integrated into programming
languages, which makes computations purely functional and allows for their
execution strategies to be changed, for example, by delegating to an external
build system.

# Concrete ideas

There are multiple levels on which one can implement a postmodern build system.

To reiterate, our constraints are:
* Don't completely rewrite inner build systems. If something can be jammed into the
  seams in the program to inject memoization, that is viable and worthwhile.

  This eliminates Unison.
* Provide generic memoization at a less-than-1-process level.
* Ensure sufficient determinism to make incremental builds trustworthy.
* Make computations naturally distributed, utilizing modern parallel computing
  systems.

## Make an existing architecture and OS deterministic

This is an extremely unhinged approach that is likely fraught with evil.
However, it is not impossible. In fact, [Ripple] by edef and others is an
experiment to implement this exact thing. There is also plenty of prior art of
doing vaguely similar things:

[Ripple]: https://nlnet.nl/project/Ripple/

[rr] has made a large set of programs on Linux deterministic on x86_64 and
ARM64. There is also prior art in fuzzing, for example [Orange Slice] by
[Brendan Falk], which aims to create a fully deterministic hypervisor for x86.
On Linux, [CRIU] can be used to send processes to other systems among other
things, and might serve as a primitive to move parts of program executions into
other processes in a deterministic way.

In some senses, the problem of deterministic execution of functions in native
applications is isomorphic to the problem of snapshot fuzzing, in which some
large system has a snapshot taken, input is injected via a harness, and then
the program is run to some completion point, with instrumented memory accesses
or other tooling. Once the run completes, the system is rapidly restored to its
previous state, for example, by leveraging page tables to restore exactly the
memory that was touched to its original state.

[rr]: https://rr-project.org/
[Orange Slice]: https://github.com/gamozolabs/orange_slice
[Brendan Falk]: https://gamozolabs.github.io/about/
[CRIU]: https://criu.org/Main_Page

If it were sufficiently well developed, this approach could conceivably be used
to convert existing programs to use distributed computation with minimal
changes *inside* the programs.

However, a lot of the program state in a native process is shaped in a way that
may be deterministic but is path-dependent, for example, allocator state, and
other things of the sort, leading to pointers changing with each run with
slightly different inputs. It seems rather unlikely that, without ensuring a
known starting point, a program could usefully be memoized in such a way that
it matches past executions.

## WASM everything

WebAssembly is likely a more viable approach today but would possibly require
more invasive changes to programs to use the build system.

Concretely, it would be possible to make an execution engine that takes the
tuple of (Code, Inputs) and purely executes it while allowing for monadic
dependencies. This would look something like this in pseudo-Haskell:

```haskell
execute :: MonadBuild m => (Code, InputBlob) -> m Output
```

In fact, to some extent, [Cloud Haskell] did approximately this, however, it
didn't necessarily implement it with an eye to being a build system, and thus
doesn't do memoization or other things that would be desirable. Though, one
could probably use [Shake] to implement that.

[Shake]: https://ndmitchell.com/downloads/paper-shake_before_building-10_sep_2012.pdf
[Cloud Haskell]: https://www.microsoft.com/en-us/research/wp-content/uploads/2016/07/remote.pdf

Porting an existing compiler to this design would be a matter of abstracting it
over the actual execution mechanism, doing a *lot* of build engineering to add
the necessary entry points to make each query its own WASM executable, to
make sure that all the necessary state actually goes into the query, and then
finally to implement a back-end for the execution mechanism that attaches to
the postmodern build system.

## Nix builds but make them monadic

What if the executor for Nix builds or similar systems memoized compiler
executions by transparently translating compiler invocations to Recursive Nix
or similar monadic builds? This could be achieved many ways, but is essentially
equivalent to using `ccache` or similar tools, only with better sandboxing.

Similarly, tools like Bazel could be relatively easily converted to use
recursive Nix or similar trustworthy execve memoization tools in place of their
existing sandboxes to avoid the problem of trustworthy build tools not
composing, since the outer tool has to be the trusted computing base, and
putting another build system inside it requires that it either get circumvented
(turning sandbox off, etc) or integrated with, in order to preserve incremental
builds.

This "solution", however, only solves the issue up to one `execve` call: it
can't improve the state of affairs within a process, since Nix only has the
granularity of one `execve`.

# Conclusion

We waste immense amounts of compute and time on rebuilding the same build
products, and hell, build systems, over and over again pointlessly. This is
wasteful of the resources of the earth as well as our time on it, in multiple
respects, and we *can* do better. We have the ideas, we even have the
technology. It just has to get shipped.

Many of the ideas in this post came from edef, [who you should
sponsor][edef-sponsor] if you want to support her giving people these ideas or
developing them herself.

[edef-sponsor]: https://github.com/sponsors/edef1c
