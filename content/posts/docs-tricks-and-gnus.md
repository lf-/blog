+++
date = "2021-05-18"
draft = false
path = "/blog/docs-tricks-and-gnus"
tags = ["site"]
title = "Docs tricks and GNUs"
+++

##### TL;DR: check out my GNU docs builds at <https://docs.jade.fyi/gnu>

They uniquely have:
* Limited width/better-font-size CSS I wrote
* One big page for each tool!!

[Send me an email](/about) if you want some page that's not in there, I'll see
what I can do now that I have the tools built.

---

I have recently adopted the practice of locally building and serving HTML
documentation for projects I use and work on. I have concluded it's a really good idea:

* No way to get distracted while trying to get to the docs
* They load extremely fast and don't *cough Oracle* show cookie popups
* You can get better docs offline!

To achieve this I've [set up nginx as a user
unit](https://github.com/lf-/dotfiles/tree/67dea019b1c26811322d4a7e942b509da3464cd2/docs-svc)
and have stuffed some docs into that web root. Serving docs over http provides
a few notable advantages over the `file://` protocol: does not lose zoom across
pages (accessibility problem!) and can read `index.html` files when present.

## Rust docs

I do the usual routine with `cargo doc` in a project, which will generate docs
with links between libraries and the exact right versions of dependencies.
However, there are some ways I've improved my experience:

* I wrote [a shim script](https://github.com/lf-/dotfiles/blob/9c2ae57c98915ed3a3b089aae442702afad16660/bin/_cargo_doc_open)
  that symlinks docs pages into the web root then opens them in a browser. The
  idea is that it can be set as `BROWSER` for `cargo` (there is a [PR
  outstanding](https://github.com/rust-lang/cargo/pull/9473) for making browser
  into a `cargo doc` config option).
* Use the `--document-private-items` option and maybe even
  `RUSTDOCFLAGS='--document-hidden-items' cargo +nightly doc`
  in order to build documentation with the fun stuff visible, which is really
  good for understanding how things work.

## GNU docs

Preface: GNU is politically useless, they refuse to kick out their
misogynist-in-chief despite him not doing anything good or useful for years,
and their software is not even very good. I absolutely do not endorse them.
However, their software is unfortunately very popular and available everywhere.
Also, for instance, LLVM copies the invocation and other details of the GNU
equivalents to their tools and does not produce separate documentation, in
general. Irrespective of reason, I very often end up needing to read GNU
documentation.

The existing ways of reading GNU docs are all terrible. `info(1)` is hot
garbage, with key bindings that nobody will remember. If you choose to look at
the HTML docs published by the GNU project, they're in about 50 HTML files each
of which is less than a screenful, making them absolutely impossible to search
except with like, Google, which also could do way better but doesn't.

It's actually possible to build single page docs, you do something like the
below snippet:

```
$ git clone git://sourceware.org/git/binutils-gdb.git
$ cd binutils-gdb
$ mkdir build
$ cd build
$ ../configure
$ make html MAKEINFO=makeinfo MAKEINFOFLAGS='--no-split'
$ make pdf
$ find . '(' -name '*.pdf' -or -name '*.html' ')' -exec cp '{}' ~/dev/docs/gnu ';'
```

However, since GNU has development practices stuck in the 90s and no CI, it is
an extremely frequent occurrence that their source repo won't build or some
other nonsense, or nobody has tested the texinfo options or similar (all of
these have happened to me). The point is, this sucks greatly.

Also, when you do actually build these docs, they are using 90s web design
practices that make them unusable on modern machines: there is no significant
CSS in use, so the lines are about 400 characters long on my machine. I
normally fix this with Stylus rules but I've written a
[BeautifulSoup script](https://github.com/lf-/dotfiles/blob/67dea019b1c26811322d4a7e942b509da3464cd2/docs-svc/add_css.py)
to bake some CSS into the texinfo HTML I am publishing.

As of now they are also available publicly at <https://docs.jade.fyi/gnu>.

