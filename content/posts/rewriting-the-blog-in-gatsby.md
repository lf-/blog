+++
date = "2019-11-11"
draft = false
path = "/blog/rewriting-the-blog-in-gatsby"
tags = ["web", "javascript"]
title = "Rewriting the blog in Gatsby"
+++

I just rewrote the formerly-Ghost blog in Gatsby, which may improve performance, will definitely improve image loading, and will substantially simplify maintenance. A significant motivation was that maintaining a database is a pain, especially on Arch Linux where I have to do migrations on a somewhat unplanned schedule on pace with the release schedule of the database system. Another further annoyance is that if I don't update my Ghost version, there is potential for security vulnerabilities and server compromise. It's not as bad as WordPress, being written in NodeJS, but it is still a risk.

<!-- excerpt -->

It's a significant improvement to no longer have dynamic code running server side and be able to just ship a pile of static code, which I can version using git and update the core when I want without substantial concern for security issues.

In summary, getting rid of the server side stuff:
- saves sysadmin time
- eliminates attack surface
- eliminates services such as database and email
- improves versioning and resilience to data loss by inherently having backups
- produces a more comfortable paradigm to develop for due to substantially better tooling
- avoids the need to remake my obsolescent Ghost theme that lacks support for the latest Ghost features

I chose Gatsby because it makes it easy to abstract away modern web stuff such as image processing/compression, but more importantly is gratuitously novel and thus fun to develop with.

This theme is based on [gatsby-starter-julia](https://github.com/niklasmtj/gatsby-starter-julia), with modifications including adding a dark theme, featured images, adding support for non-post pages such as the About page here, changing a bunch of styles, and setting up image compression stuff.

Gatsby was also chosen so I could write posts in Markdown in my preferred editor.

### Importing posts

I had a bunch of existing content I wanted to migrate over, and I didn't really want to do manual work for each post, with the associated possibility for error. There didn't seem to be any options for those who just want to replace Ghost with plain Markdown within the Gatsby ecosystem, though there seem to be a lot of resources for headless Ghost. However, I noticed there is [ghostToHugo](https://github.com/jbarone/ghostToHugo) which can dump the posts out of a Ghost export and turn them all into Markdown with proper frontmatter. This was sort of annoying to use because I had to install Hugo, make a site, then run the program to convert all the posts from the Ghost backup, then pull all the Markdown files out of that site and move them to Gatsby.

Also, somewhat annoyingly, since Hugo uses `toml` for its frontmatter, I needed to adjust the configuration of `gray-matter` in order to get it to parse `toml` rather than `yaml`, which was a large amount of documentation-reading but feasible.
