+++
date = "2022-10-30"
draft = false
path = "/blog/nixcon2022-retrospective"
tags = ["nix", "haskell", "nixcon"]
title = "NixCon 2022 retrospective"
+++

Well, that sure was a thing. It was more than a thing: it was a really good
thing.

NixCon 2022 was my first in-person conference, and therefore also my first time
speaking at an in-person conference. I understand better why people want these.
It's really nice to be around The People For The Thing and meet new people
(whether they are wearing cat ears or otherwise).

I met a whole *bunch* of people and made some very good friends.

## Speaking - nix-closure-graph

I delivered a talk "Debugging Closure Size Graphically". This was a fun
experience; it's a lot easier to deliver jokes in front of an audience. I'm
excited to see what people do with the tools I built, and I'm glad they are
open source now.

You can get more about it on the [talk page](/nixcon2022).

## The hacking room

I spent most of the conference either in breakout rooms and later, the
hackathon room. We got the following done:

### Incremental builds for Haskell

This was done after an extremely useful discussion with [Jonas Chevalier
(@zimbatm)][Jonas Chevalier] and implemented in large part by [Harry Garrood].
The idea is that we can achieve incremental builds of Haskell by doing an
impure dependency on the previous build, intentionally breaking the evaluation
chain.

[Jonas Chevalier]: https://twitter.com/zimbatm
[Harry Garrood]: https://twitter.com/hdgarrood

You can get an example project showing what we developed [from Harry's
GitHub][incr-nix-example].

[incr-nix-example]: https://github.com/hdgarrood/haskell-incremental-nix-example

In practice, this looks like a setting on the Haskell builder to enable
a separate output for incremental information (which is the interface and
object files of the run), and a second setting to copy in incremental
information from some path.

This approach [requires GHC 9.4][harry-blog] in order to use hash-based
incremental information rather than entirely relying on file timestamps as
was previously done.

The reason this is fantastic is that it avoids the following false dichotomy of
flawed options:
  * Use one derivation per file. This would pessimize build times by having to
    invoke GHC for each file as [ghc-nix] does, eating startup costs for each
    file, and also losing finer grained incremental support than "did the
    file change".

    That is a completely valid and reasonable approach as it keeps the build
    hermetic at the cost of more build time, but it relies heavily on
    content-addressed derivations, and if you used it within Nix, it would
    also use recursive Nix or [derivations-building-derivations].

  * Change the project structure to use more packages so that Nix can
    incrementally build at the package level.

    This is hard to do, and [multi-package pessimizes the developer
    experience][mp-fail] due to lack of multiple home units support as well
    as slowing down builds in development (as opposed to Nix builds) since
    Cabal/GHC do not yet know how to build the non-dependent parts of
    dependent packages at the same time.

    In my view, commercial projects probably should be one package as it
    currently stands, because splitting packages is bad for development
    efficiency, requiring duplicating dependency lists and doing a bunch of
    other housekeeping, on top of the issues with concurrently working on
    multiple packages described above.

    Note that as in the link above, calling GHC once per file *does* allow
    solving the dependent-package parallelism problem, as Bazel does, but it
    also pessimizes build times.

We decided to have our cake and eat it too. We prototyped an approach of
letting GHC do the incremental builds in the way [Harry describes][harry-blog],
and then convincing Nix to let us do it. This leaves dev completely alone, and
constitutes only a minor impurity crime (since at least it is reproducible
given some effort!), while not pessimizing compile times at all.

[harry-blog]: https://harry.garrood.me/blog/easy-incremental-haskell-ci-builds-with-ghc-9.4/
[ghc-nix]: https://github.com/matthewbauer/ghc-nix
[derivations-building-derivations]: https://github.com/NixOS/rfcs/blob/master/rfcs/0092-plan-dynamism.md
[mp-fail]: ./cabal-test-dev-trick

### [nix-otel] grows up

Another really nice achievement of the conference is that, with the help of
[Linus Heckemann] and [Jean-François Roche], we have improved data quality in
nix-otel and poked at making it work in the daemon, after which it could be
integrated into Nix itself.

Following discussions, it's likely that future structured logging will be
OpenTelemetry based as it avoids reinventing the wheel.

The data quality improvement is that previously, changing phases in the builder
would not emit spans, which it now does. There is one span for each phase. This
was achieved by effectively postprocessing the log data from Nix. Also, there
was a memory corruption I fixed, which was somehow only causing missing data
rather than crashes. Yikes.

We also now report 100% of the information that Nix gives us via the logger,
which means that further improvements will be in Nix itself, improving
logging for everyone.

Linus worked on getting nix-otel to work in the daemon, which is still a work
in progress. We want to use settings for the API keys and endpoint to avoid
needing environment variables for them. On that account, we arrived at hunting
a bug in our settings handling in which the settings were not getting their
values properly.

Another thing that was discussed is making the daemon and client cooperate
since the client knows some things the daemon doesn't, and the daemon has
better timing information. This can be done pretty easily by having the client
do propagation of trace IDs to the daemon, and keeping track of whether log
data was forwarded (and in that case, not sending it to OpenTelemetry since it
already was sent).

Once this foundational work is done, nix-otel can be integrated into Nix
itself, potentially representing the first Rust in Nix since the previous
attempt that had significantly more complicated foreign-function-interface
usage, leading to its failure.

Looking forward, another thing we can probably do is to use the `$NIX_LOG_FD`
infrastructure that already exists to build an OpenTelemetry
propagator/exporter that can be used within builds to also instrument the
inside of builds.

[nix-otel]: https://github.com/lf-/nix-otel
[Linus Heckemann]: https://twitter.com/linux_hackerman
[Jean-François Roche]: https://github.com/jfroche

## oops, feelings

Paris is beautiful. I really appreciate having a practical transit system and
being able to walk everywhere.

Certainly this trip has renewed my motivation for looking into possibly moving
to Europe in the next few years.

-----

Thanks to Harry Garrood for reviewing a draft of this post.
