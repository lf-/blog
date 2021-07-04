+++
date = "2021-02-19"
draft = false
path = "/blog/finding-functions-in-nixpkgs"
tags = ["nix"]
title = "Finding functions in nixpkgs"
+++

It is a poorly guarded secret that the most effective way to get documentation
on nixpkgs or nix functions is to read the source code. The hard part of that
is *finding* the right source code. I'll document a few static and dynamic
analysis strategies to find the documentation or definition of things in
nixpkgs going from trivial to some effort.

## Simple

These work on functions that have no wrappers around them, which account for
most library functions in nixpkgs. The option for `ctags` is a little bit
better because it will just show you the source code which you can subsequently
trace through.

### Static

#### ctags

As of version 0.5.0 (released 2021-07-03), `nix-doc` supports emitting ctags
files with `nix-doc tags .` from a nixpkgs checkout.

This lets you `:tag` things in vim or other editor supporting ctags and
instantly jump to them by name, as well as `CTRL-]` to jump to the symbol under
the cursor. It's clever enough to distinguish functions from other values at a
syntax level, but like every ctags tool that's about where it stops.

#### Search tools

Static analysis is, in my view, slightly slower, since you can't be sure you're
getting the function you're seeing in the interactive environment in `nix repl`
or elsewhere.

There are two tools for this that are capable of parsing nix source, `nix-doc`
(my project) and `manix`, both of which are in nixpkgs.

Note that `nix-doc` will only work from within a nixpkgs checkout or if you
pass it a second parameter of where your nixpkgs is. This is mostly because
`nix-doc`'s main focus has switched to being mainly on providing a function in
the REPL.

There is also a [fork of `rnix-lsp`](https://github.com/elkowar/rnix-lsp) which
provides `manix` based documentation from within editors.

```
# your nixpkgs checkout
$ cd ~/dev/nixpkgs; nix-shell -p manix nix-doc
[nix-shell:~/dev/nixpkgs]$ manix foldl
```
<details>
<summary>
<code class="language-text">manix</code> output
</summary>

<pre class="language-text"><code>
<b>Here&apos;s what I found in nixpkgs:</b> <font color="#D0CFCC">lib.lists.foldl&apos;</font>
<font color="#D0CFCC">lib.lists.foldl</font> <font color="#D0CFCC">lib.foldl</font>
<font color="#D0CFCC">lib.foldl&apos;</font> <font color="#D0CFCC">haskellPackages.foldl-statistics</font>
<font color="#D0CFCC">haskellPackages.foldl-transduce-attoparsec</font>
<font color="#D0CFCC">haskellPackages.foldl-incremental</font> <font color="#D0CFCC">haskellPackages.foldl-exceptions</font>
<font color="#D0CFCC">haskellPackages.foldl</font> <font color="#D0CFCC">haskellPackages.foldl-transduce</font>

<font color="#D0CFCC">Nixpkgs Comments</font>
<font color="#26A269">────────────────────</font>
# <font color="#12488B"><b>foldl</b></font> (<font color="#D0CFCC">lib/lists.nix</font>)
 “left fold”, like `foldr`, but from the left:
     `foldl op nul [x_1 x_2 ... x_n] == op (... (op (op nul x_1) x_2) ... x_n)`.

     Type: foldl :: (b -&gt; a -&gt; b) -&gt; b -&gt; [a] -&gt; b

     Example:
       lconcat = foldl (a: b: a + b) &quot;z&quot;
       lconcat [ &quot;a&quot; &quot;b&quot; &quot;c&quot; ]
       =&gt; &quot;zabc&quot;
       # different types
       lstrange = foldl (str: int: str + toString (int + 1)) &quot;a&quot;
       lstrange [ 1 2 3 4 ]
       =&gt; &quot;a2345&quot;



<font color="#D0CFCC">NixOS Documentation</font>
<font color="#26A269">────────────────────</font>
# <font color="#12488B"><b>lib.lists.foldl&apos;</b></font> (<font color="#2AA1B3">foldl&apos; :: (b -&gt; a -&gt; b) -&gt; b -&gt; [a] -&gt; b</font>)
Strict version of `foldl`.

<font color="#D0CFCC">NixOS Documentation</font>
<font color="#26A269">────────────────────</font>
# <font color="#12488B"><b>lib.lists.foldl</b></font> (<font color="#2AA1B3">foldl :: (b -&gt; a -&gt; b) -&gt; b -&gt; [a] -&gt; b</font>)
“left fold”, like `foldr`, but from the left:
`foldl op nul [x_1 x_2 ... x_n] == op (... (op (op nul x_1) x_2) ... x_n)`.

Arguments:
  <font color="#26A269">op</font>: Function argument
  <font color="#26A269">nul</font>: Function argument
  <font color="#26A269">list</font>: Function argument

Example:

  <font color="#D0CFCC">lconcat = foldl (a: b: a + b) &quot;z&quot;</font>
  <font color="#D0CFCC">lconcat [ &quot;a&quot; &quot;b&quot; &quot;c&quot; ]</font>
  <font color="#D0CFCC">=&gt; &quot;zabc&quot;</font>
  <font color="#D0CFCC"># different types</font>
  <font color="#D0CFCC">lstrange = foldl (str: int: str + toString (int + 1)) &quot;a&quot;</font>
  <font color="#D0CFCC">lstrange [ 1 2 3 4 ]</font>
  <font color="#D0CFCC">=&gt; &quot;a2345&quot;</font>

  <font color="#D0CFCC">lconcat = foldl (a: b: a + b) &quot;z&quot;</font>
  <font color="#D0CFCC">lconcat [ &quot;a&quot; &quot;b&quot; &quot;c&quot; ]</font>
  <font color="#D0CFCC">=&gt; &quot;zabc&quot;</font>
  <font color="#D0CFCC"># different types</font>
  <font color="#D0CFCC">lstrange = foldl (str: int: str + toString (int + 1)) &quot;a&quot;</font>
  <font color="#D0CFCC">lstrange [ 1 2 3 4 ]</font>
  <font color="#D0CFCC">=&gt; &quot;a2345&quot;</font>
</code></pre>

</details>

`manix` includes the file path with the documentation from the nixpkgs sources
but no line number. It also includes NixOS manual documentation, which I
appreciate.

```
[nix-shell:~/dev/nixpkgs]$ nix-doc foldl
```

<details>
<summary>
<code class="language-text">nix-doc</code> output
</summary>

<pre class="language-text"><code>
   “left fold”, like `foldr`, but from the left:
       `foldl op nul [x_1 x_2 ... x_n] == op (... (op (op nul x_1) x_2) ... x_n)`.

       Type: foldl :: (b -&gt; a -&gt; b) -&gt; b -&gt; [a] -&gt; b

       Example:
         lconcat = foldl (a: b: a + b) &quot;z&quot;
         lconcat [ &quot;a&quot; &quot;b&quot; &quot;c&quot; ]
         =&gt; &quot;zabc&quot;
   different types
         lstrange = foldl (str: int: str + toString (int + 1)) &quot;a&quot;
         lstrange [ 1 2 3 4 ]
         =&gt; &quot;a2345&quot;
<font color="#FFFFFF"><b>foldl</b></font> = op: nul: list: ...
# ./lib/lists.nix:80

</code></pre>
</details>

`nix-doc` basically gets you the same thing, but it is missing `foldl'`, which
is a bug in the `nix-doc` command line interface, I think. It does, however,
give you a source path with line number so you can use middle click or `C-w F`
or similar to go directly to the function's source in your editor.

### Dynamic

This is the wheelhouse of `nix-doc`. It adds the two functions demonstrated
below (added by the `nix-doc` Nix plugin, see [the README][1] for installation
instructions):

[1]: https://github.com/lf-/nix-doc/#nix-plugin

<pre class="language-text"><code>nix-repl&gt; n = import &lt;nixpkgs&gt; {}

nix-repl&gt; builtins.unsafeGetLambdaPos n.lib.foldl
{ column = <font color="#2AA1B3">11</font>; file = <font color="#A2734C">&quot;/nix/store/...-nixpkgs-.../nixpkgs/lib/lists.nix&quot;</font>; line = <font color="#2AA1B3">80</font>; }

nix-repl&gt; builtins.doc n.lib.foldl
   “left fold”, like `foldr`, but from the left:
       `foldl op nul [x_1 x_2 ... x_n] == op (... (op (op nul x_1) x_2) ... x_n)`.

       Type: foldl :: (b -&gt; a -&gt; b) -&gt; b -&gt; [a] -&gt; b

       Example:
         lconcat = foldl (a: b: a + b) &quot;z&quot;
         lconcat [ &quot;a&quot; &quot;b&quot; &quot;c&quot; ]
         =&gt; &quot;zabc&quot;
   different types
         lstrange = foldl (str: int: str + toString (int + 1)) &quot;a&quot;
         lstrange [ 1 2 3 4 ]
         =&gt; &quot;a2345&quot;
<font color="#FFFFFF"><b>func</b></font> = op: nul: list: ...
# /nix/store/...-nixpkgs-.../nixpkgs/lib/lists.nix:80
<font color="#2AA1B3">null</font>
</code>
</pre>

You can also get this information using `builtins.unsafeGetAttrPos`, an
undocumented built-in function in Nix itself:

<pre class="language-text"><code>
nix-repl&gt; builtins.unsafeGetAttrPos &quot;foldl&quot; n.lib
{ column = <font color="#2AA1B3">25</font>; file = <font color="#A2734C">&quot;/nix/store/...-nixpkgs-.../nixpkgs/lib/default.nix&quot;</font>; line = <font color="#2AA1B3">82</font>; }
</code></pre>

## Functions without documentation

nixpkgs has a few of these. Let's pick on Haskell infrastructure because I am
most familiar with it.

First let's try some static analysis to try to find the signature or source for
`nixpkgs.haskell.lib.disableLibraryProfiling`:

<pre class="language-text"><code>
<font color="#26A269"><b>[nix-shell:~/dev/nixpkgs]$</b></font> manix disableLibraryProfiling

<font color="#26A269"><b>[nix-shell:~/dev/nixpkgs]$</b></font> nix-doc disableLibraryProfiling

<font color="#26A269"><b>[nix-shell:~/dev/nixpkgs]$</b></font> rg disableLibraryProfiling
<font color="#A347BA">pkgs/development/haskell-modules/configuration-common.nix</font>
<font color="#26A269">50</font>:  ghc-heap-view = <font color="#C01C28"><b>disableLibraryProfiling</b></font> super.ghc-heap-view;
<font color="#26A269">51</font>:  ghc-datasize = <font color="#C01C28"><b>disableLibraryProfiling</b></font> super.ghc-datasize;
<font color="#26A269">1343</font>:  graphql-engine = <font color="#C01C28"><b>disableLibraryProfiling</b></font>( overrideCabal (super.graphql-engine.override {

<font color="#A347BA">pkgs/development/haskell-modules/lib.nix</font>
<font color="#26A269">177</font>:  <font color="#C01C28"><b>disableLibraryProfiling</b></font> = drv: overrideCabal drv (drv: { enableLibraryProfiling = false; });

<font color="#A347BA">pkgs/development/haskell-modules/configuration-nix.nix</font>
<font color="#26A269">97</font>:  hercules-ci-agent = <font color="#C01C28"><b>disableLibraryProfiling</b></font> super.hercules-ci-agent;
</code></pre>

Oh dear! That's not good. Neither the `manix` nor `nix-doc` command line tools
found the function. This leaves `rg`, which is not based on the Nix abstract
syntax tree, and for functions that are used a lot of times, the definition of
a function will get buried among its uses. This is not ideal.

I believe that in the case of `nix-doc` it may have found
it but ignored the function since it had no documentation. Let's test that.

<details>
<summary>Results of adding a comment to see what happens</summary>
<pre language="language-text"><code>
<font color="#26A269"><b>[nix-shell:~/dev/nixpkgs]$</b></font> nix-doc disableLibraryProfiling
   disable library profiling
<font color="#FFFFFF"><b>disableLibraryProfiling</b></font> = drv: ...
# ./pkgs/development/haskell-modules/lib.nix:178
</code></pre>
</details>

Yep.

Well, time to pull out the dynamic analysis again. Like in the [simple
case](#simple), you can get the source code with `builtins.unsafeGetAttrPos`
or the functions added by `nix-doc`. On my system nixpkgs where there is no
documentation comment for the function, this is what I get:

<pre class="language-text"><code>
nix-repl&gt; builtins.doc n.haskell.lib.disableLibraryProfiling

<font color="#FFFFFF"><b>func</b></font> = drv: ...
# /nix/store/...-nixpkgs-.../nixpkgs/pkgs/development/haskell-modules/lib.nix:177
</code></pre>

Although there is no documentation, `nix-doc` has pulled out the signature,
which may already be enough to guess what the function does. If not, there is a
source code reference.

## Indirection

The hardest class of functions to find documentation for are ones which are
wrapped by some other function. These can be frustrating since the AST pattern
matching for functions as used by `nix-doc` and `manix` will fall apart on
them.

An example function like this is `nixpkgs.fetchFromGitLab`, but any arbitrary
package created via `callPackage` will also work for this, as they are not
really functions, but you do want to find them.

`manix` knows of the function, but does not know from whence it came, whereas
`nix-doc`'s CLI does not see it at all:

<pre class="language-text"><code>
<font color="#26A269"><b>[nix-shell:~/dev/nixpkgs]$</b></font> manix fetchFromGitLab
<b>Here&apos;s what I found in nixpkgs:</b> <font color="#D0CFCC">pkgsMusl.fetchFromGitLab</font>
<font color="#D0CFCC">fetchFromGitLab</font> <font color="#D0CFCC">fetchFromGitLab.override</font>
<font color="#D0CFCC">fetchFromGitLab.__functor</font> <font color="#D0CFCC">fetchFromGitLab.__functionArgs</font>
<font color="#D0CFCC">pkgsHostTarget.fetchFromGitLab</font> <font color="#D0CFCC">pkgsBuildBuild.fetchFromGitLab</font>
<font color="#D0CFCC">pkgsStatic.fetchFromGitLab</font> <font color="#D0CFCC">pkgsTargetTarget.fetchFromGitLab</font>
<font color="#D0CFCC">targetPackages.fetchFromGitLab</font> <font color="#D0CFCC">gitAndTools.fetchFromGitLab</font>
<font color="#D0CFCC">__splicedPackages.fetchFromGitLab</font> <font color="#D0CFCC">buildPackages.fetchFromGitLab</font>
<font color="#D0CFCC">pkgsHostHost.fetchFromGitLab</font> <font color="#D0CFCC">pkgsBuildHost.fetchFromGitLab</font>
<font color="#D0CFCC">pkgsBuildTarget.fetchFromGitLab</font> <font color="#D0CFCC">pkgsi686Linux.fetchFromGitLab</font>


<font color="#26A269"><b>[nix-shell:~/dev/nixpkgs]$</b></font> nix-doc fetchFromGitLab
</code></pre>

Time to get out the dynamic analysis again!

<pre class="language-text"><code>
nix-repl&gt; n = import &lt;nixpkgs&gt; {}

nix-repl&gt; builtins.doc n.fetchFromGitLab
<font color="#C01C28"><b>error:</b></font> <b>(string)</b>:1:1: value is a set while a lambda was expected

nix-repl&gt; builtins.typeOf n.fetchFromGitLab
<font color="#A2734C">&quot;set&quot;</font>

nix-repl&gt; n.fetchFromGitLab
{ __functionArgs = { ... }; __functor = <font color="#12488B"><b>«lambda @ /nix/store/...-nixpkgs-.../nixpkgs/lib/trivial.nix</b></font>:324:19»; override = { ... }; }
</code></pre>

That didn't work! It's a set with the `__functor` attribute that makes it
callable.

Even if we try pointing `nix-doc` at the `__functor`, it will tell us about
`setFunctionArgs`, which is not what we were looking for.

From what I understand of the Nix internals from writing the plugin, there is
not really a nice way of getting the source of a function wrapped like this,
since the information is already lost by the time the value enters the dumping
function as Nix only stores lambda and attribute definition locations so once
you have taken the value of the attribute that information is no longer
available.

This could be resolved with a new REPL command as those take strings of source
which could be split to get the attribute name and attribute set, but custom
REPL commands are not supported so some kind of modification would have to be
made to Nix itself to add this feature.

Therefore, I have to use the last trick up my sleeve, `unsafeGetAttrPos`, to
find the definition of the attribute:

<pre class="language-text"><code>
nix-repl&gt; builtins.unsafeGetAttrPos &quot;fetchFromGitLab&quot; n
{ column = <font color="#2AA1B3">3</font>; file = <font color="#A2734C">&quot;/nix/store/...-nixpkgs-.../nixpkgs/pkgs/top-level/all-packages.nix&quot;</font>; line = <font color="#2AA1B3">466</font>; }
</code></pre>

This tells me, albeit in an annoying to copy format, that the next breadcrumb
is at `pkgs/top-level/all-packages.nix:466`, which is

```nix
  fetchFromGitLab = callPackage ../build-support/fetchgitlab {};
```

Then, I can look in `pkgs/build-support/fetchgitlab` and find a `default.nix`
which will have the definition I want.

