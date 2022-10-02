+++
date = "2022-10-03"
draft = false
path = "/blog/cabal-test-dev-trick"
tags = ["haskell"]
title = "The cabal 'test-dev' trick"
+++

I found something mysterious while working on a large Haskell codebase: there
was a Cabal target called `test:test-dev`, containing `test` and `src` in
`source-dirs`. For a while, I didn't realise what it's for, and it seemed like
the kind of thing that someone goes and creates for some old use case. Now I
have put this into at least three other codebases because it fixes my problems.
What changed?

I learned about some limitations of cabal, GHC, and GHCi:

* Cabal will only build modules in one package (and target!) at a time.
  In practice this means that your test suite can only start building after
  your entire library is built. This is silly!

  To illustrate the problem, say you have some module deep in your module tree,
  `Instrumentation` that depends on `hs-opentelemetry`, and you have
  `hs-opentelemetry` in your workspace. Then if you change something in
  `hs-opentelemetry`, Cabal will build that package in its entirety before
  starting on building yours, even though most of your package doesn't need any
  of `hs-opentelemetry`.

  Cross-package parallelism has motivated some [intrepid hackers at
  Tweag][haskell-bazel] to make Bazel work well for Haskell builds. This work
  allows you to build things in parallel, ignoring package boundaries for
  modules that don't require the entire dependency package to be ready yet.
  However, it also loses the fine grained recompilation avoidance that's always
  improving inside `ghc-make`. It turns out, we can hack cabal to do nearly the
  same thing.

* GHCi doesn't know how to have interpreted modules from multiple packages.

  This is consequential for a couple of reasons:
  * No `:load` support if you want to work on dependencies and grab everything
    in scope including private items
  * The debugger doesn't work across packages! This one really hurts in the
    occasions when you absolutely need the debugger. While figuring out a bug
    in my HSpec integration for OpenTelemetry, I needed to point the GHCi
    debugger at HSpec, and this was the (only) way.
  * `:reload` does not work across packages. This alone is enough to recommend
    this trick with abandon.

[haskell-bazel]: https://www.tweag.io/blog/2022-06-23-haskell-module/

What if you could Not Have Those Problems? It turns out, they are all solved by
Putting More Code in a Target, although sometimes this needs to be done with
a little more persuasion of the build system.

If you think you have too much code in one package, you are probably mistaken.
Most of GHC, representing a Lot of Haskell, is one package. Avoiding the
limitations of the build infrastructure around multiple packages improves build
times and developer productivity.

## How do I `test-dev`?

Include both `src` and `test` in `hs-source-dirs` (`source-dirs` in hpack), and
then use `cabal run test:test-dev` (yes, `run`; cabal's shiny new test
runner doesn't let you control the entry point, which is no fun), or
`cabal repl test:test-dev`.

You will need to put all your dependencies for `src/` *and* your dependencies
for `test/` in the dependencies for `test-dev`.

## But what if a dependency is causing cross-target sadness?

In the spirit of [the yolo method of setting up HLS][yolo-method] in which you
unceremoniously temporarily stuff some third party project into a cabal
workspace with your code, you can also just lie to cabal that the dependency is
part of your package.

[yolo-method]: ../nix-hls-for-deps#yolo-method

Simply tell cabal "it's *my* package now" by putting its source directory into
`hs-source-dirs` and remove the dependency (since it's your package now).
Cabal will apparently not think much of it!

Let's use hspec as an example. First clone hspec below your project directory
(nested git repos are no problem as long as they remain untracked):

```
$ git clone https://github.com/hspec/hspec
```

Then do something like this in your cabal file:

```
test-suite test-dev
    -- ...
    hs-source-dirs:
        src
        test
        hspec/hspec
        hspec/hspec-core
    build-depends:
        -- your app depends PLUS (your test depends MINUS hspec/hspec-core) PLUS hspec/hspec-core's depends
```

Finally you can `cabal run test:test-dev`, or `cabal repl test:test-dev`, and
it will build your code *and* the hspec code all as one imaginary package,
allowing you to use the full GHCi feature set and compile faster, especially if
you're actively working on hspec.

In this way, you can blur the line between dependencies and your own code,
working on them as one, while also keeping them separate the rest of the time.

### Bonus section: It also makes HLS work better

You can also put `test-dev` in place of the other targets in `hie.yaml` in all
the paths it includes, which will improve HLS's overall performance and
usability, although perhaps at the cost of more startup time. This is because
HLS has the same problem as cabal where it seemingly doesn't build dependent
targets in parallel with their dependencies.

More frustratingly, if a dependency fails to compile, it will sometimes take
down all the dependent code with it, even if the dependent code doesn't all
actually import the dependency.

You can set this up in `hie.yaml` something like so:

```yaml
cradle:
  cabal:
    - path: "src"
      component: "test:test-dev"

    - path: "test"
      component: "test:test-dev"
```

---

## Are split packages a good idea in some contexts?

Here's a [blog post by Matt Parsons on compile times][parsons-compile-times],
which I generally agree with based on my experience working in large Haskell
codebases.

[parsons-compile-times]: https://www.parsonsmatt.org/2019/11/27/keeping_compilation_fast.html#module-parallelism

Some highlights include:

Given a package `B`, depending on `A`:

> By combining `A` and `B` into a single package, we sped up compile
  times for a *complete* build of the application by 10%. A clean build of the
  new `AB` package was 15% faster to build all told, and incremental builds were
  improved too.

He suggests "if you're not willing to GitHub it, then it should probably stay
in the main package".

I agree with this heuristic: you can cache the entire thing as a package (in
fact, Nix will automatically do it for you) if it's on GitHub/Hackage, and it
probably doesn't change that often if you are willing to do that, so the slight
increase in annoyingness of developing it is probably fine.

That said, you can have your cake and eat it too! It's easily possible to [stuff
dependencies into your workspace while working on them][yolo-method], or even
artificially integrate them into your own package while working on them via the
`test-dev` trick.

Using these methods, you can get exactly the same developer experience while working
on libraries as if they are fully part of the codebase by telling cabal that
they *are* fully part of the codebase only while developing on them, then have
them be separate while releasing.

---

## The elephant in the room: "Wait, GHC fixed this?"

My post describes a workaround for the absence of a GHC feature called
"multiple home units", which released in GHC 9.4, and is supposed to solve
these problems. However, [Cabal does not yet support it][cabal-mhu], which is
rather a roadblock. Also, [GHCi has limited functionality under multiple home
units][ghci-mhu].

You can read more about the ongoing work on multiple home units [at the
Well-Typed blog post on the subject][wt-multiple-home-units].

[wt-multiple-home-units]: https://well-typed.com/blog/2022/01/multiple-home-units/
[cabal-mhu]: https://github.com/haskell/cabal/issues/8238
[ghci-mhu]: https://gitlab.haskell.org/ghc/ghc/-/issues/20889

That post points out that Stack does the `test-dev` hack described in this
article if you do something like `stack repl exe:myexample lib:myexample`, but
I don't use Stack.

The `test-dev` trick will continue working into the future, but I look forward
to the day that it is no longer necessary.

### Limitations

This hack has some unfortunate limitations, many of which are discussed in the
posts about multiple home units above:

- It doesn't reuse object code from the build of `lib:sample` or `sample:test:test`.
- You need to set `default-extensions` to the union of all of the
  `default-extensions` that each of the directories are normally built with. I
  didn't actually notice this since I typically use a copious number.
- Other GHC flags need to be compatible.
- It breaks [-XPackageImports].
- Module name conflicts probably don't do anything good.
- I doubt that [cabal `mixins`][cabal-mixins] work with this.

[cabal-mixins]: https://cabal.readthedocs.io/en/3.4/cabal-package.html#pkg-field-mixins

[-XPackageImports]: https://ghc.gitlab.haskell.org/ghc/doc/users_guide/exts/package_qualified_imports.html?highlight=packageimports#extension-PackageImports

## Bonus section: `ghcid` on tests

You know what fixing GHCi on tests in the presence of app modifications does?
That's right, you can run your test suite with ghcid on every file save. This
is seriously awesome since it uses interpreted mode for those sweet GHCi reload
times.

This section was inspired by [Matt Parsons' blog post on ghcid][parsons-ghcid],
which incidentally uses this trick because Stack does it under the hood!

[parsons-ghcid]: https://www.parsonsmatt.org/2018/05/19/ghcid_for_the_win.html

<aside>

### Fractal bonus section (i): Reusing batch-compiled modules for GHCi

In the default configuration, GHC will generate `dyn_o` objects, but for some
reason it will not use them in GHCi. However, you can tell GHCi to use them!

```
cabal repl test:test-dev --ghc-options "-osuf dyn_o -hisuf dyn_hi"
```

This strikes me as being a GHC bug that this is not the default. I've [noted
the workaround on the relevant issue][ghci-bug] and hopefully this will be
fixed in the future.

[ghci-bug]: https://gitlab.haskell.org/ghc/ghc/-/issues/13604#note_455505

</aside>

Back to our regularly scheduled bonus content:

First, create a file `test/Main.hs` something like so (this circumvents the
`cabal test` runner which doesn't let you have a custom entry point):

```haskell
module Main where
import Spec (spec)
import Hspec

main :: IO ()
main = testMain

-- avoids overlapping names with Spec.main
testMain :: IO ()
testMain = hspec spec
```

Then you can ghcid your tests with:

```
$ ghcid --command 'cabal repl test:test-dev --ghc-options="-osuf dyn_o -hisuf dyn_hi"' --test testMain
```

When you save any file, ghcid will pilot the GHCi session to reload and rerun
the tests.

<aside>

### Fractal bonus section (ii): Why is `cabal test` not great?

The main reason that `cabal test` bugs me is that you can't hack it or make it do
additional test setup.

For instance, with an entry point you can control, you can send your Haskell
test suite runs to an OpenTelemetry tracing service such as [Honeycomb] using
the [OpenTelemetry integration I wrote][hspec-otel], and immediately debug SQL
mistakes, perf problems and more in your tests.

[Honeycomb]: https://honeycomb.io
[hspec-otel]: https://github.com/iand675/hs-opentelemetry/blob/main/examples/hspec/test/Main.hs

</aside>

#### Acknowledgements

Thanks to Hazel Weakly, Matt Parsons, and Chris Zehner for their valuable
feedback and discussion on drafts of this post.
