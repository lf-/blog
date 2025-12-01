+++
date = "2024-03-10"
draft = true
path = "/blog/the-matrix-of-nixos-deployments"
tags = ["nixos"]
title = "The matrix of NixOS deployment options"
+++

there's a lot of approaches, because NixOS is agnostic to the entire Cartesian product of:

pull vs push
centrally built or not
replacing the entire e.g. AMI by building a disk image, or mutating into the new state
local binary cache or not (you have 50 computers, you very much want one unless you are push deploying from a central point)

yeah so there's a bunch of ci services for nix all of which are bad in their own ways and my expert friends and i don't know of any that are good. Hydra exists but is less than well maintained.

but it's basically irrelevant what ci system you run

jade_
yeah i guess the other question is, is this a deployment of 50 mostly the same servers or different?
jade_
cuz you could do image based deployment and just image them all the same. NixOS is fairly good at that model as well
jade_
or even, if you're using the same configuration on several machines the deploy process can be, build centrally, nix copy then invoke switch-to-configuration
jade_
(this also works in a pull configuration and is one of the nicer NixOS deploy models, besides the very nicest which is netboot off of a network nix store over http)

Salt seems like it works for this, and provides continuity for us. We also use Concourse for building/deploying/testing sites, this would be easier for doing the central builds
jade_
alright cool, then you can look into s3 nix cache, built into nix or another option there. use your ci system of choice to fire off a bunch of jobs to build the configs on changes to your git repo. nix copy result to the binary cache. you can say, put the output path to the closure you want in some file on a web server at the end of the build.
jade_
to pull on a machine, nix-store --realise the path that was already built, then run path/switch-to-configuration switch.
John
oh wow
jade_
I'm not sure if anyone's really made a public version with all this glue together, all of these I've seen are pretty well custom
jade_
this should get you pull based deploys with centrally ci built images

another thing that will help you a lot is looking at config.system.build.toplevel in the nixos manual and source code. this is an exercise i'd recommend to anyone learning NixOS because it explains how this thing relates to the nix build system in the end

but especially if you're not using nixos-rebuild it's good to know (though, you can! you can just give it the path to the closure like nixos-rebuild switch /nix/store/whatever)

jade_
to accomplish auto updates you can set up a cron job with gh actions or whatever to try updating the lock and building and auto merge if successful.

also if you're doing that you may want to use NixOS tests to make sure your specific use cases don't regress. we try pretty hard on the maintainers team but stuff happens.
