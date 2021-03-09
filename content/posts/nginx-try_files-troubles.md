+++
date = "2019-11-11"
draft = false
path = "/blog/nginx-try_files-troubles"
tags = ["nginx"]
title = "nginx: how to try multiple roots successively"
+++

As part of developing this new version of this site, I've needed to mess with nginx a lot to switch from Ghost to Gatsby, especially when related to hosting files out of multiple directories.
<!-- excerpt -->

Specifically, this site is deployed by `rsync`ing the production version of the site onto the server hosting it. I want to be able to use `--delete` to get rid of any old files for reliability reasons (don't want to rely on stuff that's not supposed to be there accidentally). Additionally, I like being able to host random files on the server, which I don't want to manage with Gatsby.

What this means is that I need the server to try in order:
- serve the file from the Gatsby directory
- attempt to serve it as a directory and return index.html
- serve it from the untracked static files
- 404

There are countless StackOverflow posts on this exact issue, but none were quite right for my use case.

One popular suggestion is to set the `root` to some directory above both content directories then use something like `try_files dir1$uri dir1$uri/ dir2$uri =404;`. This works... nearly.

It works properly for all direct paths, but the directory functionality is broken: it sends a 301 to the browser with `dir1/subdir/`, which, once followed, 404s since the nginx server will then try to serve `dir1/dir1/subdir/index.html` which it can't find. Further, this redirection behaviour seems not to be documented anywhere.

The solution here is to just do `try_files dir1$uri dir1$uri/index.html dir2$uri =404;` and bypass the nginx index directive entirely.

