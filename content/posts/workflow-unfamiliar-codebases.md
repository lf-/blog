+++
date = "2021-07-27"
draft = false
path = "/blog/workflow-unfamiliar-c-cpp-codebases"
tags = ["workflow"]
title = "My Workflow: Unfamiliar C and C++ codebases"
+++

Improving and automating my workflow is something I have put considerable
investment into, and I would like to share what I can. This is part of a
series of posts about my development workflow. You can read the other
installments here:

- [Docs](./docs-tricks-and-gnus)

---

I have a curse: I know how to program and I run Linux, so I naturally tend to
fix things when I see them, which results in significant yak shaving, but also
fixes things permanently. I also know that one of the most effective ways to
learn things about libraries or programs that are misbehaving is reading their
source code.

# Acquiring source code

Actually getting the source to things is surprisingly annoying: every project
has its own Web site where they might link their source, and I would have to
find those. I don't want to navigate websites as they're distracting and too
often don't have the links to the code anywhere easy to find.

## Just grab it off GitHub

Because of the monoculture in open source, very few projects don't at least
have a mirror of their source on GitHub. This makes it very convenient to
acquire source for things, as I only have to look in one place that's also
quite uniform and machine accessible.

The `gh` GitHub command line tool is probably one of the better ways to
interact with the Web site without distractions. Unfortunately, there is an old
[feature request](https://github.com/cli/cli/issues/1004) for adding search,
which has not been implemented yet. Thankfully, you can add aliases. I've done
so with a fancy alias for searching repos which emits nice coloured output for
finding where the name of the repo for the thing I want.

```yaml
aliases:
    search: 'api -X GET search/repositories -f q=''$1'' --template ''{{range .items}}{{ .full_name | color "white" }}: {{ .description }}{{"\n"}}{{ end }}'''
```

I can then do something like `gh search 'github cli'`, for example, and it will
print out the name and description of `cli/cli` which is the one I want. It can
then be cloned with `gh repo clone cli/cli`.

## Can't find it on GitHub

At this point I would either Google it on DuckDuckGo, or look at where the
distro package got it from (this is important in the case of things that have
been forked or have multiple versions). I use Arch, so that would entail either
looking at the package info with `pacman -Si PACKAGE-NAME` or grabbing the
package source with `asp checkout PACKAGE-NAME`, then reading the `PKGBUILD`.
Equivalent things exist for other distros, for example, reading `nixpkgs`
source for NixOS.

# Dealing with C or C++

C or C++ projects often have a lot of latitude to do creative things with their
build processes, and I want an IDE to work on them. I use [`nvim`] and
[`clangd`] for my IDE, so working on codebases with arbitrary build systems is
a question of generating a compilation database (`compile_commands.json`).

[`nvim`]: https://neovim.io/
[`clangd`]: https://clangd.llvm.org/

## Using various build systems

These are the build systems I have dealt with the most while working on random
C or C++ projects. Sometimes they don't document how to use the build system,
or I don't want to read the README.

### GNU autotools

**Identifier**: `.in` files or `configure` script at the root of the repo.

**Notes**: If `configure` is missing, there may be `bootstrap` or
`bootstrap.sh` that will generate one, or you may have to run
`autoreconf --install` if that's not there.

**Usage**: `./configure`, then `make -jN` where N is the number of build jobs.
`./configure` may need some options, it has a `--help` option that will list
the possible ones.

### CMake

**Identifier**: `CMakeLists.txt` at the root of the repo.

**Usage**: `cmake -G Ninja -B build`, then `ninja -C build`.

### Meson

**Identifier**: `meson.build` at the root of the repo.

**Usage**: `meson ./build`, then `ninja -C build`.

## Compilation databases

### Unusual and obsolete build systems such as GNU autotools/GNU make

Use [Bear]: configure, then `bear -- make [make options]`. This will do
`LD_PRELOAD` magic and intercept the calls to the compiler and save them. This
tool works on basically any build system, even silly shell scripts. Just
remember to run it on a clean build or else it will miss some files!

Sometimes [`compiledb`] works better: `compiledb make -- [make options]`.

[Bear]: https://github.com/rizsotto/Bear
[`compiledb`]: https://github.com/nickdiego/compiledb

### Linux kernel

Pretty high up on the list of unusual build systems. [Build the kernel with
clang]: `make CC=clang defconfig` then `make CC=clang -jN`, then run
`scripts/clang-tools/gen_compile_commands.py`.

[Build the kernel with clang]: https://www.kernel.org/doc/html/latest/kbuild/llvm.html

### CMake

CMake is nice because it can generate Ninja. You can invoke it with `-G Ninja`,
build, then ask Ninja for compile commands with
`ninja -C build -t compdb > compile_commands.json`.

### Meson

Like CMake, after building the software, you can use Ninja to get a compilation
database with `ninja -C build -t compdb > compile_commands.json`.

## My IDE got confused because they're doing cursed stuff

This has happened a couple of times, especially when reading source code to
`glibc`, for instance, where there are definitions in headers and definitions
in unrelated `.c` files, among other things. Fortunately, `ctags` is not smart
enough to get confused by cursed stuff and works fine in parallel with a LSP
server. Run `ctags -R .` at the root of the repo and use `nvim` to navigate
with the tags:

- <kbd>CTRL-]</kbd> jump to the identifier under the cursor.
- <kbd>CTRL-W g CTRL-]</kbd> jump to the identifier under the cursor in a new
  split.
- `:tj TAG_NAME` selects from the tags called `TAG_NAME` or jumps there
  directly if there's only one. Useful if there are multiple definitions of
  the same identifier.
- <kbd>CTRL-O</kbd> goes back in history to the last jumped position.
- <kbd>CTRL-I</kbd> goes forward in history to the last jumped position.

# Finding things

I use [`ripgrep`] as it has good defaults and is extremely fast. Usually the
way I find things is I look for a unique word related to the thing I want in
the documentation, for instance, a long command line option or an error
message, then I search it case insensitively (`-i`) and start browsing code
from there.

Sometimes it's not that easy, and I have to use some more tricks as I can't
find it by searching. I often pull out a debugger after `strace`ing the program
to try to find an interesting system call I can set a breakpoint on to track
down the code path. Or, for instance, I know that a program opens two dialogs
before the interesting behaviour, so I set a breakpoint on `XCreateWindow`. I
then take a backtrace and have somewhere to start looking in the codebase. Be
creative!

Usually my debugger of choice is either [`rr`] or `gdb`.

[`ripgrep`]: https://github.com/burntsushi/ripgrep
[`rr`]: https://github.com/rr-debugger/rr

---

This is part of a series of posts about my development workflow. You can read
the other installments here:

- [Docs](./docs-tricks-and-gnus)
