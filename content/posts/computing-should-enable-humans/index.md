+++
date = "2023-03-02"
draft = true
path = "/blog/computing-should-enable-humans"
tags = []
title = "Computing should enable humans: how to choose tools"
+++

> the first thing our new hire did was fix a bug that's been bugging him forever as a user prior to joining.
>
> he then breathed a sigh of relief and submitted his two weeks' notice. wtf??
>
> <https://twitter.com/swaglord__420/status/1377051721655066629>

In celebration of the fixing of the [notorious 4 year old VSCode
bug][vscode-bug] which practically everyone I know has seethed about, I think
it's important to write about choosing tools that support and enable humans by
aligning with our values.

[vscode-bug]: https://github.com/microsoft/vscode/issues/73120

In order to enable humans, tools must be reparable. If you find a fault in
the tool, it *must* be possible to get it fixed in a timely fashion. Imagine
having a broken stove that only works if you jump twice, spin around three
times, then smack the thing, only to have a 50% chance of turning on the
burner, but your landlord won't do anything about it. Every day you use it,
you expire an exasperated sigh, hoping it will work *this* time.

The same is true for software: either you need to be able to replace it, fix
it, or get it fixed, but all need to be able to happen in a timely manner.
Unfortunately, everyone *will* find bugs, and sometimes, they are sufficiently
problematic that they get under your skin every single day.

As someone with a troubled upbringing, I am intimately familiar with the
feeling of lack of agency over my life, and I'm determined to never have that
happen again in any facet of my life. For the most part, I feel that the
computer generally *gives* me more agency, but that is not the case for
everyone, not every developer, and *absolutely* not every non-developer.

The way that a lot of people experience software is that it comes from magical
beings from on high, and they pray that it works correctly, for they can't do
anything if not. We need to have empathy for people who use our tools: as the
people from on high bequeathing the rest of the world with tools, we are in a
position of power over them and their lives.

We have constructed a world where software serves to take agency away from
people: if people are *forced* to use your tools, you have a responsibility to
them to make it usable. That means accessibility; that means that you are
accountable to your customers when bugs are reported; that means that your
system's decisions can be appealed when they have influence over lives.

## Structural factors

Various structures of software development have different effects on whether
the software gets fixed.

Open source is not necessarily the answer. We see that that VSCode bug has been
present for four years, that the fix was 5 lines, that it was submitted by
someone outside Microsoft, and that the fix was not reviewed for multiple
months. Responsible closed source developers can be less frustrating to deal
with than hegemonic open source landlords such as Microsoft who gather goodwill
by producing a good open source product, then don't fix their bugs or review
their patches, then turn around and [close the source of language
servers][pylance-closed].

[pylance-closed]: https://visualstudiomagazine.com/articles/2021/11/05/vscode-python-nov21.aspx

A major differentiator of whether you are hosed if you run into a bug or not is
whether the bug tracker is public. That is: if there is a problem, then can you
see it? I ran into a frustrating bug in a JetBrains product's code formatter,
and while it *was* not being fixed, the bug was at least public: I could see
that I am not the only one having it.

Microsoft has a closed bug tracker, although there is the "Feedback Hub", which
my experience has been that it is where I find that my bug is a year old and
unfixed. Apple has a closed bug tracker, and [damningly, community members have
made a web site that publishes their own bugs][openradar] so that they could
determine if they were alone.

[openradar]: https://openradar.appspot.com/

Another factor that determines whether you are in for misery when software
breaks is the release schedule of the software. Assuming that someone (whether
you or not) *does* fix the issue, how long are you going to wait to get the
patch? Is this months? Weeks?

A major red flag for software remaining unfixed is how homogeneous its
development workflow is: is it one giant repository where everything goes into
a black hole unless you work there? Which organization owns the majority of the
functionality you rely on? Are teams autonomous?

Thinking back on why I switched back to Neovim exclusively as an editor, one
major reason is the amount of the functionality that is in plugins instead of
in the core. Autocompletion is in a plugin. *Highlighting queries* are in a
plugin and can be *overridden in your config file*. Much of the UI is in a
plugin. I can hack up basically any plugin in my config by doing various things
to override it without having to fork it. None of these plugins are owned by
the same team, and there are alternatives for each piece, so that if it sucks,
I *can* hit da bricks.

{% image(name="just-walk-out.jpg", colocated=true) %}
Skeleton meme: "just walk out, you can leave!!!"

If it sucks ... HIT DA BRICKS
{% end %}

### Business model

Consider the business model of any software and services that you use. Is it a
two-sided market in which the company has inserted themselves in the middle to
extract value? How do they make money? If they don't obviously make money, how
*might* they make money in the future, and is that method acceptable?

The products I am least concerned about using are the ones which have an
obvious business model: they have *customers*, who *pay them* for something
they do.

Consider the case study of Microsoft Visual Studio Code, which is free. How are
they extracting money? God knows, but they sure are eating market share and
gaining themselves a tremendous position of power in the market by doing so.
From the very beginning, it was released as a closed source distribution of an
open source tool, and various *very important* pieces depend on closed source
code, so that Microsoft retains full control. For example, the remote
extension, an increasing number of language servers, the *extension store*, all
are closed source components under EULA.

As another example, Microsoft Bing tells you to not install Chrome when you
google "Chrome" in the Bing search box. Then, Microsoft Edge [*injects
pop-ups*][edge-popups] into Google's webpage for downloading Chrome. Then they
do it again when you try to change default browser in the settings app. This is
so obviously anticompetitive that it *should* have every country suing them for
billions for the exact same reason they [got sued for billions for doing *less*
to IE][us-v-microsoft], but apparently we do not live in a world where laws
apply to corporations anymore.

[us-v-microsoft]: https://en.wikipedia.org/wiki/United_States_v._Microsoft_Corp.
[edge-popups]: https://www.extremetech.com/internet/329450-microsoft-edge-gets-new-anti-chrome-pop-ups

There are infinite stories of Microsoft abusing monopoly positions in every
market they are in, but I will digress.

Venture capital funded startups are crooked. Exercise *serious* caution in
using their products, since they have an obligation to their investors to screw
you over eventually.

It's a traditional practice in VC-funded startups to [enshittify
products][enshittification], a form of bait and switch: gather a huge market
share by providing a decent service at a loss, driving competitors out of
business, then, once the market has been burned to the ground, start screwing
everyone over for *even more* money because they can't leave. First, make
suppliers depend on the startup by eliminating their agency: Facebook, for
example, prioritized posts that did not direct people off-platform, demanding
full text of articles, destroying their website audiences. Then, they started
demanding money from said news outlets. The news outlets can't say no because
their control over their destiny has been systematically destroyed.

Uber destroyed the taxi business everywhere by providing a service for less
money, more conveniently, at a massive loss, by subsidizing their two-sided
market. They drove the local businesses out of business (and, to be clear,
small businesses are often terribly abusive environments, but I would rather
them over Silicon Valley landleeches). Then, they started screwing their
customers and their employees (sorry sorry, "independent contractors"),
extracting maximum profit by inflicting maximum misery.

[enshittification]: https://pluralistic.net/2023/01/21/potemkin-ai/

It's not trivial to blame startups for doing this, because those were the
conditions they agreed to when they accepted the money in the first place:
hockey-stick growth is the expectation, and their leaders will get fired if
they don't do it.

"Software" (venture capital) is eating the world.

## Can you patch it?

In the case where you *are* in the software developer class, and you have free
time, it is important that you can patch the software as easily as possible if
it has bugs or oversights. This is significantly enabled by systems that reduce
the power that others hold over the software: patching, plugins, and extension
points. Some of the stories here are based on real life, and the names of the
projects in question have been omitted to protect the guilty.

There's various considerations of community health that matter to the selection
of software that has influence over your life, such as Linux distributions,
programming languages, etc, where you expect to spend a lot of time in that
community. For example:
* Does the project have a Benevolent Dictator for Life?
  * How do they behave?
  * Do the rules apply to thee but not to me?
  * If you disagree with them, what happens? Does the *project* hold special
    power, such as access to special APIs restricted to their GitHub org?
* Does the community accept bigots or convicted rapists in open arms?
* Does the project have a code of conduct? Is it enforced?
* Are you going to be called a fucking idiot for using the wrong words to
  describe a class method on IRC?

The ease of which you can set up a development environment for the software,
fix the bug, and submit the change matters. I share the opinion that mailing
lists and `git send-email` are obsolete gatekeeping nonsense that should be
avoided when possible, but it is not the only thing that matters: how fast do
patches get reviewed? How functional is the development workflow upstream?

How forkable is the software? If you have to hold a patch against it, how bad
is that going to be? A *big* reason that VSCode is so troublesome to use as
someone who wants working software is that it is aggressively not forkable: you
have to get stuff merged for it to get into the closed source distribution,
they are bad about merging things, and it moves pretty fast while being this
massive thing.

In spite of being a card-carrying anti-FSF person, I very much care about
so-called "software freedom": I care that I can fix my own software. For
example, this is enabled by Nix making patched versions of software no harder
to deploy than upstream versions, which unties me from their release schedules
when required. Further, there is approximately no difference between package
definitions I write and ones that are in nixpkgs upstream, which is a *huge*
boon which combines well with nixpkgs not being insular: I can contribute to it
just as much as anyone else. The end result of this is that my operating system
no longer holds a significant position of power over me being able to get
things done.

Another thing that's useful is when the software is extensible, since it gives
you agency as the user to be able to rectify oversights without even
maintaining patches. Nix is not without criticism on some of the bases above: I
wrote the Nix plugin included with `nix-doc` to rectify the oversight of
upstream not completing their patch for a way of getting function documentation
interactively from `nix repl`. Because it has plugins, I can experiment with
new features that aren't yet upstream, and I have accordingly enjoyed having
this feature for a year and a half, without worrying about when it will get
implemented upstream.

## Conclusion

We spend a huge amount of our lives using software, and there are a *lot* of
factors that can make the difference between being under the thumb of software
and software being a force of good in our lives. I have been thinking about a
lot of these things subconsciously for years, and it's become clear that these
are actually *values* that I care about, not just software things.

I hope that you too can get to a place where the Computer generally works and
is a positive influence on your life.
