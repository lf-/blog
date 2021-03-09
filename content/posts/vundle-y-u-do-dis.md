+++
author = "lf"
categories = ["vim"]
date = 2015-01-18T05:43:30Z
description = ""
draft = false
path = "/blog/vundle-y-u-do-dis"
tags = ["vim"]
title = "Vundle, y u do dis"

+++

Now to start off with, I apparently can't read and feel quite stupid for wasting 30 mins of my life messing with this problem.

Recently, I decided that vim was a good idea. So I commited to not avoiding it in favor of Sublime Text (I still need to fix the html stuff so that using Sublime isn't so damn tempting) and the editor-switching stuff has been going well.

When I decided to stop stealing someone else's vimrc, I also switched to using Vundle instead of Pathogen. This ended up throwing a slew of strange errors *not even mentioning a shell* such as `Error detected while processing function vundle#installer#new..vundle#scripts#view:`. Googling this gave me a seemingly completely unrelated issue from 2010 (typical as of late sadly). After trying a few things like deleting .vim/bundle, nothing was seeming to work. So I went off to read the docs. After messing with the GitHub wiki, I realised that I'm a derp and should read properly. There was a section clearly labeled `I don't use a POSIX Shell (i.e. Bash/Sh)` to read about this.

That being said, this isn't a totally useless I'm-an-idiot post, because gmarik could do something better. There could be detection of capabilities required, so that there's a pleasant error message stating what went wrong, rather than the current state of throwing a 20 line long error lacking entirely in description of **what** failed, and where. This is also partially vim's problem, because it could state that an error happened while executing shell code or similarly useful things.

