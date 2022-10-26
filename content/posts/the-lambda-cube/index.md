+++
date = "2022-10-25"
draft = false
path = "/blog/the-lambda-cube"
tags = ["haskell"]
title = "The Lambda Cube in Haskell: what construct do I need for this polymorphism?"
+++

> *Note*: I [just rewrote][zola-ts] the syntax highlighter for my site's
> generator, Zola, to use tree-sitter, and there are probably some
> deficiencies. Let me know if there's anything going terribly wrong.

[zola-ts]: https://github.com/lf-/zola/tree/tree-painter

I was reading a beta copy of [Production Haskell] by Matt Parsons again, and a
section stood out to me in the type level programming chapter (something I am
trying to get better at): "Value Associations", discussing the varieties of
functions in the language. It brought up the idea of the Lambda Cube. What
the heck is a Lambda Cube and why haven't I heard of one before?

[Production Haskell]: https://leanpub.com/production-haskell

Let's [look it up on Wikipe][Lambda Cube]—uhh maybe not

Wikipedia tells me to pursue other fields of study by its use of absolutely
baffling jargon and a bunch of judgements. Apparently this article was so
unusually baffling that someone put a note on it:

> This article may need to be rewritten to comply with Wikipedia's quality
> standards, as article uses pervasively inconsistent, confusing and misleading
> terminology for basic concepts fundamental to the understanding of the
> article's subject. You can help. The talk page may contain suggestions.

Incidentally, I was recommended [Practical Foundations for Programming
Languages][pfpl] as a textbook covering the use of judgements/sequents
in type theory. It's pretty dense and the authors have a bad habit of defining
symbols in the middle of paragraphs, but it is doable and useful for figuring
out the notation in papers.

[pfpl]: http://www.cs.cmu.edu/~rwh/pfpl/

Here's my understanding of the Lambda Cube (my email is on [About] if you have
any corrections to submit):

[About]: /about

The [Lambda Cube] is an idea from type theory about the possible combinations
of ways a language can extend the simply typed lambda calculus which has `value
-> value` functions.

Beginning at the simply typed lambda calculus on one corner of the cube,
there are three directions it can be extended, leading to eight combinations of
extensions, one for each point of the cube:

* [`value -> type`](#value-type) (values determining types), representing dependent types.
* [`type -> value`](#type-value) (types determining values), representing type
  classes and generic functions.
* [`type -> type`](#type-type) (types determining types), representing type
  level functions.

[Lambda Cube]: https://en.wikipedia.org/wiki/Lambda_cube

Looking at language features through the lens of the cube has made it easier to
figure out which of the dizzying array of Haskell language features I might
want to achieve a specific goal ~~in writing incomprehensible code that my
coworkers will have to suffer through~~.

In this post I'll go through somewhat-practical uses of features in the
vicinity of each of the three axes.

# `value -> type` {#value-type}

Value to type functions represent dependent types.

Haskell does not have dependent types, although Haskell programmers seem
strangely willing to engage in so-called "hasochism" to pretend it does.
Dependent types would allow the type of the result to depend on a *value* input
to the function, constraining the caller to exactly the set of relevant output
types. Generally, dependent types are the realm of languages that lean more
toward theorem prover on the spectrum between general purpose languages and
theorem provers, such as Agda, Idris, Coq, and so on, although the
configuration language Dhall also has dependent types.

That said, there are several features that together can be combined to produce
things in the general vicinity of `value -> type` to allow constraining the
result type of functions depending on input values, falling short of dependent
types.

## [GADTs]

[Generalised algebraic data types (GADTs)][GADTs] are among the features that
are useful for problems where you have to make types depend on values. I think
of GADTs as a bridge allowing proofs made at compile time to be attached to
values and recalled later.

The following is a (very uninspired) example of the use of GADTs on
[Peano numbers], a representation of the natural numbers as zero or the
successor of a number. It demonstrates rejecting programs that try to call
`predecessor` to get the number prior to zero, which does not exist:

{{ codefile(path="Peano.hs", colocated=true, code_lang="haskell", hide=false) }}

There is a [package on hackage][peano-hackage] for Peano numbers in a GADT, but
a Peano number GADT is not necessarily as useful as one might initially think.
One annoying downside of using a GADT is that it makes it harder to write
functions potentially returning values using any of the constructors, since
different constructors have different types.

Consider the following function:

```haskell
fromInt :: Int -> Peano a
fromInt 0 = Z
fromInt n = S $ fromInt (n - 1)
```

The function does not type check, since it has different types in the two
equations:

```
• Couldn't match type ‘a’ with ‘Zero’
  Expected: Peano a
    Actual: Peano Zero
  ‘a’ is a rigid type variable bound by
    the type signature for:
      fromInt :: forall a. Int -> Peano a
   |
17 | fromInt 0 = Z
   |             ^
```

If we wanted this to compile, we would have to hide the
type variable somehow. Hmmm.

The tool for "I want to hide this type variable" is an existential type.
Existential types are so called because they mean "there exists this type. See?
Here's a value of that type".

Such a type for this would be `data SomePeano = forall a. SomePeano (Peano a)`
which will hide the `a`, giving both arms the same type. That existential
can equivalently be written in GADT notation, which may be somewhat easier to
understand since its constructor's signature looks like a normal function
signature: `data SomePeano where SomePeano :: forall a. Peano a -> SomePeano`

[peano-hackage]: https://hackage.haskell.org/package/PeanoWitnesses
[Peano numbers]: https://en.wikipedia.org/wiki/Peano_axioms#Addition
[GADTs]: https://ghc.gitlab.haskell.org/ghc/doc/users_guide/exts/gadt.html

## [DataKinds]

Another useful feature in making values kind of into types is [DataKinds],
although DataKinds does not allow the functionality you might expect on the
surface.

A "kind" can be seen as the "type" of a type, in the same relationship as a
value has to its type. Most data types you probably write are of kind `Type`
(equivalently [spelled `*`][star-is-type]), representing a fully applied type such
as `Maybe Bool`, `()`, `Int`, and so on. Partially applied types have arrows in
their kind, just like partially applied functions have arrows in their type.
For instance, `Maybe` has the kind `Type -> Type`.

DataKinds turns *types* into kinds, and *data constructors* into types. If you
have a type `Nat`, which has two constructors `Zero` and `Succ Nat`, then the
kind of `Nat` is `Type`, the kind of `Zero` is `Nat`, and the kind of `Succ` is
`Nat -> Nat`.

One odd new piece of syntax here is the use of prefix apostrophe symbols. This
is to denote that you're naming the constructor as a type, rather than the
datatype. For instance, if you have `data Foo = Foo Int`, `'Foo` would refer to
the constructor, having a kind `Int -> Foo`.

Another neat thing that DataKinds do is turning natural numbers and strings
into types which can be manipulated with the `GHC.TypeLits` and `GHC.TypeNats`
libraries.

<aside>

Some clever folks at work wrote a library for non-empty strings with some
maximum length, called [string-variants]. Its main data type is `NonEmptyText
(n :: Natural)`. Combining DataKinds and
[TypeOperators] allows the definition of a function:  
`widen :: (1 <= n, n <= m) => NonEmptyText n -> NonEmptyText m`  
allowing the conversion of a shorter string type to a
longer one. They also wrote this function for concatenation with a bounded
output size:  
`(<>|) :: NonEmptyText n -> NonEmptyText m -> NonEmptyText (n + m)`.

Pretty cool.

</aside>

[string-variants]: https://hackage.haskell.org/package/string-variants
[TypeOperators]: https://ghc.gitlab.haskell.org/ghc/doc/users_guide/exts/type_operators.html

Let's see an example that someone might use in industry: decoding untyped data
into the correct variant when the tag is known.

I've written approximately this code in order to implement a settings system
with data stored as `Map Tag Value`, where `Value` is some untyped value that
can be parsed in different ways depending on the tag. I know what the tag is
supposed to be at compile time, so I can use that information with a GADT to
prove that only one variant is possible to be returned from the get-setting
function. A typeclass is used to write a function turning the type-level tag
into its respective value-level representation.

{{ codefile(path="DataKinds.hs", colocated=true, code_lang="haskell", hide=false) }}

I had a misconception while learning Haskell and baffled by all these fancy
underdocumented features, each having « un soupçon de Type »:

DataKinds do not let you pass around sum type variants' bodies. The following
program does not compile.

{{ codefile(path="WhatIThoughtDataKindsDid.hs", colocated=true, code_lang="haskell", hide=false) }}

You can *sort of* do this! It's what the first DataKinds example above is
doing, but it looks a little different than I initially imagined it would work.
The DataKinds are used as a witness that a GADT is a particular variant, rather
than being directly returned.

[star-is-type]: https://ghc.gitlab.haskell.org/ghc/doc/users_guide/exts/poly_kinds.html#extension-StarIsType

[DataKinds]: https://ghc.gitlab.haskell.org/ghc/doc/users_guide/exts/data_kinds.html#extension-DataKinds

## [Hasochism]

Is it really worth it? Just because you can does not mean you should. The
[singletons][Hasochism] library allows for simulating dependent types with
very bad ergonomics and many crimes. Thus, the question arises: *should you*?

[Hasochism]: https://hackage.haskell.org/package/singletons


# `type -> value` {#type-value}

Turning types into values is something that we do every day. It represents the
usual mechanisms for ad-hoc and parametric polymorphism: type classes and
generic functions. If there is any conclusion to draw from this post, it's that
a typeclass is a type to value function.

After starting to use this mental model, I know to reach for them immediately
when looking to dispatch something based on type.

Functions take two kinds of arguments: type and value arguments. In the case of
functions on type classes, the type argument selects *which value* it is by
selecting the instance.

This is most clearly illustrated with the use of [TypeApplications], where you
can explicitly apply a type to a function (which, it stands to reason, is thus
a type to value function). Let's use [`Bounded`][Bounded] as an example, with
the `minBound` function:

[Bounded]: https://hackage.haskell.org/package/base-4.17.0.0/docs/GHC-Enum.html#t:Bounded

```
-- minBound is a function from a type that's an instance of Bounded to a value
-- of that type
λ> :t minBound
minBound :: Bounded a => a
λ> :t minBound @Bool
minBound @Bool :: Bool
λ> minBound @Bool
False
```

[TypeApplications]: https://ghc.gitlab.haskell.org/ghc/doc/users_guide/exts/type_applications.html

Realizing *this* made me write more type classes deliberately as functions from
type to value.

In Haskell and many languages, types are erased at runtime. All the fancy
things you do with type families and so on go away. This is important to
remember as it means that Haskell programs typically need programmer specified
structures to bridge between types and values. What stays around is
dictionaries, which are similar to vtables in Rust: tables of functions for
some class. Values are accompanied by references to the relevant dictionaries.

# `type -> type` {#type-type}

Functions from type to type are the bread and butter of type level programming.
They allow you to transform types in nearly arbitrary ways, allowing for
better DSLs and creating very generic functions.

The main facilities Haskell has for type to type functions are:

## [MultiParamTypeClasses] plus [FunctionalDependencies]

This method of writing type level functions is kind of Odd, since one of the
"parameters" is actually the result type, and you have to put the middle parts
of the function on the left hand side as constraints.

It goes like so:

```haskell
class TypeOr (a :: Bool) (b :: Bool) (result :: Bool) | a b -> result

instance TypeOr 'False 'False 'False
instance TypeOr 'True a 'True
instance TypeOr a 'True 'True
-- >>> x = Proxy :: TypeOr 'True 'False r => Proxy r
-- >>> :t x
-- x :: Proxy 'True
```

Clearly, I did not suffer enough, so I wrote a simple program to concatenate
two type level lists, breaking my brain in the process:

{{ codefile(path="MPTCFundeps.hs", colocated=true, code_lang="haskell", hide=false) }}

There is one benefit to this, which is that the compiler can infer types
backwards through these. That is not really a good reason to do this to
yourself though: you can just use [TypeFamilyDependencies] with a closed type
family instead.

[TypeFamilyDependencies]: https://ghc.gitlab.haskell.org/ghc/doc/users_guide/exts/type_families.html#extension-TypeFamilyDependencies

[MultiParamTypeClasses]: https://ghc.gitlab.haskell.org/ghc/doc/users_guide/exts/multi_param_type_classes.html
[FunctionalDependencies]: https://ghc.gitlab.haskell.org/ghc/doc/users_guide/exts/functional_dependencies.html

## OK but that's awful: using associated [TypeFamilies] instead

That's not a question, but nevertheless you can use [associated type
families][TypeFamilies] to achieve the same objective and the code makes way
more sense:

[TypeFamilies]: http://ghc.gitlab.haskell.org/ghc/doc/users_guide/exts/type_families.html

{{ codefile(path="AssociatedTypes.hs", colocated=true, code_lang="haskell", hide=false) }}

## Getting rid of the class: closed [TypeFamilies]

What if you could not write the class at all? Turns out, the associated type
was unnecessary (although it is useful to use an associated type if you *also*
need type class features).

Using a closed type family is definitely the nicest option ergonomically: it
just looks like pattern matches:

{{ codefile(path="TypeFamilies.hs", colocated=true, code_lang="haskell", hide=false) }}

There's also the ugly duckling, the open type family, but it has the same
limitations as an associated type family.

# Conclusion

I hope that this ten thousand foot overview is useful in giving a better mental
model of which structure to reach for and when.

Thanks to Hazel Weakly for reviewing the draft of this article.
