+++
date = "2023-08-06"
draft = false
path = "/blog/zsh-zim-setup"
tags = ["zim", "zsh", "workflow"]
title = "Setting up zim with zsh"
+++

I have been using an unmaintained fork of [prezto] since 6 years ago, which has
been mostly completely fine. However, one day (and possibly due to my own
actions), it started having severe startup performance issues on my NixOS
system one day, and enough was enough: I will finally figure out how zsh works.
It would be unfair to blame `prezto` for the startup performance issues, since
the version in question is so old.

[prezto]: https://github.com/sorin-ionescu/prezto

## What's broken anyway?

It's possible to profile zsh execution [using `zprof`][zprof].

[zprof]: https://docs.jade.fyi/zsh/zsh.html#The-zsh_002fzprof-Module

To do this, put `zmodload zsh/zprof` into the top of your `.zshrc`, and then
`zprof` at the end of it.

This will print out a listing of where the time went:

```
num  calls                time                       self            name
-----------------------------------------------------------------------------------
 1)    2          36.07    18.04   58.27%     10.75     5.37   17.36%  pmodload
 2)    2           9.71     4.86   15.69%      9.71     4.86   15.69%  compaudit
 3)    2           5.52     2.76    8.92%      5.52     2.76    8.92%  zle-reset-prompt
 4)    5           5.01     1.00    8.09%      4.06     0.81    6.55%  _zsh_highlight_main_highlighter
<snip>
```

This output is from another machine not as bad as my laptop; I found that the
time went into `pmodload` in prezto, which is a function that sources modules;
not terribly interesting.

Undoubtedly, it would have been possible to fix the ancient prezto fork, but it
needed rewriting anyway.

## Rewrite it

Since I'm rewriting it anyway, I switched to [zim], a fancy zsh module manager
thingy. It's distinctly possible that I might wind up canning zim in the future
due to opinions about software pinning, but at least it's much much smaller and
easier to delete.

In particular, zim itself is merely a downloader, and is *not even run* on
normal shell startup if nothing has changed, which means that I can throw away
their code any day.

[zim]: https://github.com/zimfw/zimfw

## Values

I don't want to have dependencies ever update unexpectedly, and I want my
environment to be exactly the same on different machines. Automatic updating
for such a critical tool as my shell configuration, which *does not break
itself* and for the most part never actually needs updates is highly
undesirable.

`zim` does not really agree with this view, but it can be made to work with it
well enough.

## What zim does

`zim` does two things: it downloads dependencies for you, and it compiles a
static `init.zsh` file that is loaded on shell startup. The dependency
downloading is done via either GitHub tarballs or `git`, and is invoked by
`zimfw install` (and `zimfw init`).

The installation process skips directories that already exist (!).

`zim` compiles a static file `init.zsh`, which is sourced on shell startup. It
looks something like the following:

```bash
zimfw() { source /home/jade/.local/share/zim/zimfw.zsh "${@}" }
zmodule() { source /home/jade/.local/share/zim/zimfw.zsh "${@}" }
fpath=(/home/jade/.local/share/zim/modules/prompt-pwd/functions /home/jade/.local/sh
are/zim/modules/git-info/functions /home/jade/.local/share/zim/modules/utility/funct
ions /home/jade/.local/share/zim/modules/zsh-completions/src ${fpath})
autoload -Uz -- prompt-pwd coalesce git-action git-info mkcd mkpw
source /home/jade/.local/share/zim/modules/utility/init.zsh
source /home/jade/.local/share/zim/modules/input/init.zsh
source /home/jade/.dotfiles/configs/zsh/prompt.zsh-theme
# <snip>
```

## Making zim work

The dependency management strategy I used for zim is `git subtree` vendoring.
The reason I am doing it this way is that it ensures that zim is the exact
selected version and avoids submodules.

Since `zimfw install` ignores already-existing directories, we can simply
check in the entire `modules/` directory inside `ZIM_HOME` after running `zimfw
install` and deleting `modules/` from the gitignore. This works much better if you
use `degit`, the GitHub-tarball downloader, since otherwise you would have
nested git repos.

`zim` also chooses to attempt to update itself monthly via the Internet, so
that needs to go too.

This leads to the following zim configuration in `.zshrc`, prior to sourcing
`${ZIM_HOME}/init.zsh`:

```bash
zstyle ':zim:zmodule' use 'degit'
zstyle ':zim' 'disable-version-check' 'true'
```

Then just run `zimfw install` and check in the modules. Now it's pinned, and
`zimfw update` will update the pins.

## Completion

`zsh` has a very advanced completion system, which I have years-old muscle
memory with, so I am going to be tweaking my config until it feels right again.

Settings for completions are under `zstyle
':completion:func:completer:command:argument:tag' 'somestyle'`. Not all of
these fields have to be used; globs can be used. For more details, see
[Completion System Configuration].

[Completion System Configuration]: https://docs.jade.fyi/zsh/zsh.html#Completion-System-Configuration

For example, the following will set the `completer` setting for all contexts
to a configuration which does the following:
- `_extensions`: if the cursor is at `f._`, it will try to complete a file
  extension.
- `_complete`: invoke the standard completion system.
- `_match`: expands globs into the applicable completions when tab is pressed
  ^(\[citation needed\]).
- `_approximate`: tries to autocorrect things to a similar completion; fixes
  paths and other misspelled things.

`zstyle ':completion:*' completer _extensions _complete _match _approximate`

To find out where the completion system is getting ideas from, invoke
[`_complete_help`][complete-help] by pressing `C-x h`:

[complete-help]: https://docs.jade.fyi/zsh/zsh.html#index-_005fcomplete_005fhelp-_0028_005eXh_0029

```
dev/zlog » ls new*
tags in context :completion::approximate:::
    corrections original  (_approximate)
tags in context :completion::approximate-1:ls::
    argument-rest options  (_arguments _ls)
```

## History

By default zsh does not save history! Also, there are various options that
probably should be changed:

```
# save a lot of history
HISTSIZE=1000000
SAVEHIST=1000000

# all instances share the same history
setopt SHARE_HISTORY

# history expansion goes into the editor buffer first
setopt HIST_VERIFY

# don't show dupes in history search
setopt HIST_FIND_NO_DUPS

# don't history commands beginning in space (consistent with bash)
setopt HIST_IGNORE_SPACE

# allow comments in the shell
setopt INTERACTIVE_COMMENTS
```

History search is built into the shell, but it is not fully bound by default,
which is kind of odd. The following will bind, effectively, the emacs
bindings in `viins` mode such that you can `C-r` and `C-s` as in bash (I
know about the conflict with `C-r`; I don't use undo in my shell):

```bash
bindkey -M vicmd "?" history-incremental-pattern-search-backward
bindkey -M vicmd "/" history-incremental-pattern-search-forward

bindkey -M viins '\C-R' history-incremental-pattern-search-backward
bindkey -M viins '\C-S' history-incremental-pattern-search-forward

unsetopt FLOW_CONTROL # disable C-s/C-q in the editor
```

When inside a search already, this is considered `viins` mode, so hitting `C-r`
will cycle through the previous results (it took me 6 years to fix being able
to get more than one result in history).

You can also search history with `history 1 | grep`.

In the future I am probably going to adopt [atuin] for nicer shell history with
better metadata and self-hosted syncing across machines.

[atuin]: https://github.com/atuinsh/atuin

## Syntax highlighting and fancy autosuggestions

Alternate title: Something `fish`y going on here!

Use `zmodule zsh-users/zsh-syntax-highlighting` to get
[zsh-syntax-highlighting], which adds highlighting in the prompt. I find this
super valuable since it highlights file names and makes it obvious before even
running a command whether the path is right.

[zsh-syntax-highlighting]: https://github.com/zsh-users/zsh-syntax-highlighting

You can also get the fish-like history suggestions with [zsh-autosuggestions].

[zsh-autosuggestions]: https://github.com/zsh-users/zsh-autosuggestions

## Bonus: nvim integration

Fun fact: nvim exposes a socket at `$NVIM` to subprocesses, so if you use nvim
as a terminal emulator, you can send arbitrary RPC to the editor from the shell
session.

This is great: set `$VISUAL = 'nvr --remote-wait'` in your nvim configuration
to use [`nvim-remote`][nvim-remote] to open files in the surrounding nvim
instance. This makes `git commit`, `sudo -e`, and other things magically just
work.

I rewrote `nvim-remote` in Rust as [nvimsplit], which is what I use; the
differences are as follows:
- Use the `BufHidden` event instead of `BufDelete`: if you have `'hidden'` set,
  `nvr` will not return since it listens for `BufDelete` (which will not be
  fired unless `:bde` is explicitly called, or `nvr` is invoked as `nvr
  --remote-wait +'setlocal bufhidden=delete' file`).
- Handle weird file names better: `nvr` can't open files that look like
  options.

[nvimsplit]: https://github.com/lf-/dotfiles/tree/main/programs/nvimsplit

[nvim-remote]: https://github.com/mhinz/neovim-remote

## Future improvements

I want to have a fuzzy file search similar to [telescope.nvim] in my shell.
This is probably the most useful one improvement I could make. One day.

[telescope.nvim]: https://github.com/nvim-telescope/telescope.nvim

## Finale

My shell works again :D

For me the shell is very much a tool that must work 100% of the time and not
something to mess with often, as may be evidenced by it having been last
seriously messed with 6 years ago. The rewrite project has been a success in
this respect: I definitely have less code around, and it is now more
maintainable.

It would be kind of nice to switch to PowerShell or nu shell on my Linux
machines, but there's enough broken programs that assume POSIXness from
`$SHELL`, and shell replacement is not something I really want to do.

[nushell]: https://www.nushell.sh/
