+++
date = "2020-12-29"
draft = false
path = "/blog/custom-targets-in-rust"
tags = ["rust", "embedded"]
title = "Custom targets in Rust"
+++

I'm going to try a new style of blog post for this one, more of a lab notebook
style. Expect normal posts for more interesting topics than fixing build
systems.

## ISSUE: workspaces interact very poorly with targets

### BUGS:

* https://github.com/rust-lang/cargo/issues/7004

You can't make Cargo use a separate target per workspace crate. Thus, workspace
wide builds like `cargo b --workspace` from the workspace root basically don't
work. Thus, put `default-members = []` in the virtual manifest to stop those
doing anything at all.

Workspace wide documentation also doesn't work, so use `-p PACKAGENAME` with
`cargo doc` which will document `PACKAGENAME` and all its dependencies,
including transitive dependencies. This is very likely to actually build if the
normal build works.

## ISSUE: `RUST_TARGET_PATH`

### BUGS

* https://stackoverflow.com/questions/48040146/error-loading-target-specification-could-not-find-specification-for-target

* https://github.com/japaric/xargo/issues/44

* https://github.com/rust-lang/cargo/issues/4905

This one was actually,,, attempted to be fixed, but the `xargo` PR got lost for
a year in 2018 and got abandoned.

Thus you should use `cargo -Z build-std` instead of any of `xargo` or
`cargo-xbuild`, per the instructions in the [cargo-xbuild
README](https://docs.rs/crate/cargo-xbuild/0.6.4).

In particular, to not use `xargo` and not have to use `RUST_TARGET_PATH`:

```text
cargo build -Z build-std=core,compiler_builtins -Z build-std-features=compiler-builtins-mem --release --target ../riscv64imac-mu-kern-elf.json
```

## ISSUE: documentation for target spec files

[This page wrongly suggests `xargo` which is outdated.](https://doc.rust-lang.org/stable/rustc/targets/custom.html)

Some of the options are documented on
[codegen-options](https://doc.rust-lang.org/stable/rustc/codegen-options/index.html)
but not really,

I just stole most of mine out of
[SunriseOS](https://github.com/sunriseos/SunriseOS/blob/master/i386-unknown-none.json).

There's some WEIRD caching going on with this, and you probably want to wipe
`target` for each build while messing with this file.

## ISSUE: how do you even get a target spec file?

```text
# Get a starting point for a target spec
rustc +nightly -Zunstable-options --print target-spec-json --target riscv64imac-unknown-none-elf > ../riscv64imac-unknown-mukern-elf.json

# Check if the target spec is round tripping properly
RUST_TARGET_PATH=$(realpath ..) rustc --target riscv64imac-unknown-mukern-elf -Z unstable-options --print target-spec-json
```

## ISSUE: debugging `cargo check` issues in rust-analyzer

Put this incantation in a shell startup file such that it ends up in your RA
process's environment (🙃). I wish it was configurable in VSCode somewhere.

```
export RA_LOG='rust_analyzer=info,salsa=error,flycheck=debug'
```

The RA logs have useful config information, the `salsa` logs are extremely
spammy, and `flycheck` is the `cargo check` module. [Its docs are
here](https://rust-analyzer.github.io/rust-analyzer/flycheck/index.html).
