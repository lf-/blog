+++
date = "2025-06-15"
draft = true
path = "/blog/slack-frustrations"
tags = ["slack", "corporate-drone-content"]
title = "What if Slack were good?"
+++

<aside>

These are my own opinions and do not necessarily represent those of any of my employers, past or present.

I am just posting through it.

</aside>

> you should not need fucking discipline to use a chat app. this should be difficult to do incorrectly
>
> \- Anonymous

Complaining about Slack is a common pastime in this industry and I am surely not saying a single new thing, nor have I done a literature review before starting to write this post to generate some catharsis.
However, it being my blog, there will be some solutions sprinkled throughout.

Slack is well known for many things, including their [rather ironic practice of historically being quite against remote work][slack-in-person], though [this seems to have changed][slack-in-person-less]?

TODO: better links, or remove?

As a maintainer of the Haskell Slack library, I have been very aware of the shadows of the sort of cowboy coded, undocumented, and ill-typed parts of the product showing through in the API examples from 2016 that are missing a dozen response fields, the APIs documented exclusively in blog posts, and more. There are also maybe some signs that it might get better eventually; for example, error messages citing an OpenAPI schema on more recently added APIs, though *they did not publish said schema*.

Like anyone maintaining software people actually use, they are sitting on a product that grew over years and that has a lot of sharp corners that make it hard to make fundamental changes.
That isn't to say that it's not frustrating as a user of their service or that *poor billion dollar company not fixing their product boo hoo*, but fixing things *is* really expensive and risky both at a technical and social level.
People often find change to be deeply frustrating, so it's not that likely Slack will ever actually change and by choosing Slack, to some extent, one is choosing the set of problems that comes with their service.

[slack-in-person]: https://slack.com/blog/news/update-on-extended-work-from-home-for-slack-employees
[slack-in-person-less]: https://www.hrdconnect.com/casestudy/making-hybrid-work-for-everyone-how-slack-is-fighting-proximity-bias/

# Principles

Let's establish why Slack's way of thinking about communication structure rubs up against me by describing what I actually believe that a communications tool should actually do.

Here, by communication system, I mean the sum of all the communication tools, integrations, and human patterns inside the organization.

I believe that the communication system inside an organization should be:
- Open and transparent
  - The communication system should not create new, unnecessary silos, besides the ones that already exist in the org itself.
  - The communication system should allow silos to be porous and flexible wherever possible and allow for selective and temporary breaking of separation between teams.
- Findable and organized
  - This means not showing excessive irrelevant junk to people trying to use the system.
  - This means search that at least somewhat works.
  - This means not hiding important information in a chat system where it *will* be lost to both the sands of time and bad search.
- Intentionally loose with tidying permissions
  - We have a way of dealing with people doing things that bother others with their powers, namely, "talking to them about it".
  - If you are an open source project, give away issue tracker permissions like candy. There will only be positive consequences.
- Capturing intent
  - This means comprehensive links between relevant data and *eliminating as many dependencies on the calendar date as possible* for those looking for things later so that you don't have to have seen the thing originally happen to be able to track down some context.
    - Creating persistent artifacts starting from an IM message should be easy.
      It needs to be easy to write a ticket based on a message that receives an automatic backlink.

      It should be easy to open a wiki/docs page based on a message and create a two-way link with the discussion that incited it.

Slack is *not a knowledge base* **nor a wiki** nor a ticketing system.
There is no avoiding putting information into those, and those *should* be the primary and preferred way that things are communicated once decisions are made.

# The golden rule of enterprise software

Every sufficiently bad compulsory piece of enterprise software will have people reimplementing a better piece of software as a layer on top because it generates so much value to fix the problems that the platform is not fixing and it is approximately impossible to ditch the bad product.

This may be accomplished by manual process or by abusing the features of the product in creative ways or by writing bots against its API.
Worsening the problem, this hacking often reduces pressure on the entrenched companies to take the high risk decisions to fix the fundamental design flaws in their products.

For an example of this, look at any of the many third-party stacked PR/"changeset" solutions for GitHub like [Graphite], which, as a somewhat hilarious example, is an *entire startup* formed on the principle that GitHub ships a code review system that doesn't work.
This is sort of absurd! You have a company that extracts even more per-seat licenses from companies because the existing product they're using doesn't work and it's not possible to overcome the inertia of using GitHub and switch to Gerrit instead.

I've been responsible for pointing *at least some* of this type of energy towards Slack.
For example, [Slacklinker] was my doing and has had *huge* effects on the structure through which people use Slack at the company I wrote it for.
See [linking] for more on how a backlink bot helps make Slack work in a more healthy and transparent way.

[linking]: #linking
[Slacklinker]: https://github.com/MercuryTechnologies/slacklinker

<aside>

Graphite is actually pretty good except for how it reveals that Git itself is frustrating to use in such a workflow, arguably *immensely moreso* than against Gerrit, since you have to deal with *both* Git rebase/etc semantics under the hood under the leaky Graphite abstraction *and* convincing the data model of Graphite itself to not corrupt your PR stack or submit garbage PRs if you move commits between PRs or clone the stack on another computer or similar.

The Graphite review interface is actually lovely and allows you to *see and compare revisions of PRs* no matter whether they are done by pushing new history pollution commits or by force pushing.

On Gerrit, because of commit identity and one-commit-per-review, the only fighting you really have to do is with Git itself, since you don't have a stack state that isn't just the commit parent graph.

I want to write another post about how GitHub doesn't work, and I will try to put a link here in the future when I get to writing a longer form of that digression.

I really really want a Graphite client that operates against a version control system like either [Facebook Sapling][sapling] or [jujutsu] that has a data model with commit identity, because I *want* to use their web UI but their CLI/submit experience is so frustrating.

</aside>

[sapling]: https://github.com/facebook/sapling
[jujutsu]: https://jj-vcs.github.io/jj/latest/
[Graphite]: https://graphite.dev

# Threading model

The Slack threading model is somewhere on a continuum of options between "extremely linear" and "Zulip" that is approximately like so:
- Discord replies
- Matrix threads which are like Slack threads in Element and that some clients display as if they are Discord replies.

  Matrix threads share their unusable nature with the rest of Matrix.
- Slack threads which open the messages within as a sidebar only, or, if you click the "Threads" button, within a unified full-width threads view of all the threads you're in in sequence.
  Threads generate a high priority *non-distinguishable* notification for everyone who has commented in them.

  That is, a thread message generates the red dot on the browser tab icon as-if it is a DM or ping and it highlights the "Threads" item at the top of the sidebar, but there is *zero* indication of *what* thread it is or any way to treat a thread as-if it is an unread channel rather than a ping, besides disabling notifications for it altogether.
  Pings (`@`s) in threads show a number on the "Threads" item but behave otherwise the same as other thread messages.
  There's a button to forward a thread message to the channel containing the thread, which puts it in the channel with a miniature link to the thread.

  Emoji-reacting to a message in a channel with a thread on it will subscribe to notifications on a thread, which means that someone made a `:subscribe:` emoji at work for this explicit purpose.
- Discord threads: they can be opened *as if* they are a channel, in addition to as a sidebar like in Slack.
- Zulip: uniquely, threads can spawn other threads and the primary shape of object in the system is a thread.

  Threads appear in a sidebar in a similar fashion to Discord, but there aren't *really* unthreaded messages at all from my recollection.
  Zulip is an odd hybrid between a forum and a chat system and *personally* I think it is a highly interesting idea given that nothing else works properly.

This spot in the continuum sucks, like, a lot!!
The design of threads means that people hate using threads for anything lasting more than an hour or two because it:
- Renders the thread notifications unusable for everyone in the thread for all other threads.
- Doesn't allow for sub-threads if a discussion grows too much.
- Isn't especially discoverable if the parent channel is going fast(!).

Discord gets this vastly more correct than Slack: if something *is* being discussed in a single channel, it's possible to interleave discussions in a top-level message stream (either a channel or a thread) more clearly with the replies mechanism, which is separate from threads and also generates notifications.

Also, making the *parent channel* go fast is frustrating to do to your coworkers as well, because it means that you have taken out a mutex lock on the channel for your discussion, making it hard to have other discussions in the channel, even moreso because of the lack of replies.
This [drives people into DMs](#dm-proliferation) instead of publicly visible and searchable spaces *for fundamentally non-private matters*, because the threads don't bloody work, the channels don't bloody work because you don't want to spam them with your workings, and so you are stuck shitposting in each others' DMs about your problems and maybe about your newfound problems with Slack.

The threading model might also be less aggravating if one could simply open the thread full screen in a separate window.
It's very important to how Slack's threads suck and how people use them a very careful amount (minimizing a goal function of coworker annoyance) that the UI for them is bad, that it's annoying to get back to a particular thread, and that their notifications are all mushed together with each other.
Alas, we have forgotten what a window is as an industry (probably mostly thanks to Web technology making them a pain in the ass).

<aside>
The irony is not lost on me that the extremely enterprise chat app is inferior to the gamer chat app both by having significantly worse replies and threading and also not having syntax highlighting in practice.

(Yes, I know that you can use "snippets". I have not seen more than like two of them in my entire tenure at a pretty big company using Slack. Syntax highlighting is NOT REAL and CANNOT HURT YOU)
</aside>

I should call out that I think that it's often *also* smarter to have unscheduled meetings about problems and use a pad (or Notion/Google Docs) to take notes and paste things as you're working rather than use *any* chat app.
Oxide Computer Company also [records all possible meetings][record-meetings], which is a cultural pattern I have not been in, but I suspect would generate *greatly more* context for later and overall be a plain good idea.

[record-meetings]: https://rfd.shared.oxide.computer/rfd/0537

In my view, the Slack threading model is the root of nearly all the other problems with Slack: channel proliferation, [DM proliferation][dm-proliferation], [non-discoverable discussions/context][context], and [useless search][search].

[dm-proliferation]: #dm-proliferation
[context]: #context
[search]: #search

## The point of all of this

It should be stated explicitly: the *job of a chat app and its primitives* is delivering messages to the people who are interested in those particular messages and relatively few people who are disinterested in the messages, in a reasonably deterministic manner.
That is, putting a "For You" page in work Slack in would likely piss people off as they absolutely do not want to miss messages they care about.
A chat app serves a secondary purpose of allegedly archiving such discussions in a way that they can be found again later, but in reality chat apps are best considered [information shredders](#solutions) because they are full of so many non-organized messages.

This leads directly to some slightly odd bits of Slack culture:
- Using threads in channels is considered polite, to the greatest extent in large channels, since it reduces the amount of vertical space that uninteresting messages take up: people have to opt in to reading threads and can glance at the first message and skip right over it if they don't care.

  The `:subscribe:` emoji being used to subscribe to a thread is part of this: *people want to generate as few useless notifications as possible*, and an emoji react to the top post of a thread does not light up the "Threads" button.
- It can be somewhat impolite to make a thread on an old message without also checking the "send message to the channel" box, since it won't be seen by anyone except the message author.
- Using threads in DMs or ephemeral or tiny channels is impolite because it leads to the threads sidebar entry being uselessly used, and because conversation notifications for such conversations *are* meaningful, much moreso than in large public channels.

At a broader level, people speak in multiple different registers at work, for example, often being more candid and direct about internal-politics sensitive or otherwise emotionally sensitive subjects (frustrations with other teams, for example) with their immediate teams and in more private spaces.
Any kind of chat apps, social media, TV, or *any* other media where a message is transmitted to multiple people without knowing who will read it, inherently are likely to cause [context collapse]; that is to say, multiple groups get shown the same message which they will interpret in different ways depending on their positionality.
Concerns of privacy and context collapse are *also* a type of thing that is very much at play with how chat apps' notification and visibility structures interact with systems of people; it is a driver towards people talking in private team channels and DMs rather than public channels.
It's important to psychological safety that not too many random people are up in one's business at work; this need not be strict access control lists, but there is some expectation of the intended visibility level of the context being respected by others.

[context collapse]: https://en.wikipedia.org/wiki/Context_collapse

If you want to read a cool academic paper or two on a somewhat related subject:

> B. E. Duffy and N. K. Chan, “‘You never really know who’s looking’: Imagined surveillance across social media platforms,” *New Media & Society*, vol. 21, no. 1, pp. 119–138, Jan. 2019, doi: 10.1177/1461444818791318.
>
> B. E. Duffy and C. Meisner, “Platform governance at the margins: Social media creators’ experiences with algorithmic (in)visibility,” *Media, Culture & Society*, vol. 45, no. 2, pp. 285–304, Mar. 2023, doi: 10.1177/01634437221111923.



## Channel proliferation {#channel-proliferation}

At work, there are \[redacted for comedic effect\] channels and I am a member of \[redacted for comedic effect\] channels\*.
The core problem that channels and threads and DMs try to solve is to keep exactly the right number of people in the loop in discussions to not distract people with giant piles of messages.

\*Editor's note: she did not make any effort to find out these numbers. There are too many of them, regardless!

Channel proliferation happens because individual discussions occupy too much vertical space in the chat and generate notifications to people who don't care about something in an existing chat, so it is moved to another chat to have fewer distractions to the people inside and outside a discussion.
Threads *do* reduce this substantially, but they also don't work.

The problem with channel proliferation is that it is hard to read combined unreads for related groups of channels as one stream; that is, a channel may have been created because another one has too much traffic, but then the traffic patterns may change and it becomes an affair of clicking through a million channels to read them all.

That is, you are trading it being annoying to read channel backlogs if you had fewer channels for having more, and more specific channels to read the backlog of, which is also annoying and makes it less clear where to post something.

Ironically, the solution to channel proliferation and the broken threading model is *more channel proliferation* to approximate Zulip threads/streams on top of ephemeral channels, but this is *different* channel proliferation that collects together the exact people who need to see the discussion and then does not impose a long term cost.
More about this in the [solutions section](#solutions).

## Driving discussions into DMs, reducing transparency {#dm-proliferation}

Because channels are frustrating and there is a general understanding that posting in them causes more of the noise problems, and that threads don't allow for longer form working discussions because they don't admit more threads and their notifications don't work, the outcome of this is that discussions that *should happen in the open* land in DMs.
Putting clutter messages in DMs significantly reduces notification bother towards bystanders and allows threading as if they are ephemeral channels.

This has many problems at an organizational level because it means that peoples' small-scale day to day workings are often not visible to others, and it *also* makes them remarkably hard to find after the fact and impossible for others.

However, I did find out by Googling that there's some ways to find DMs after the fact.
- You can search `to:me` to find anything in a DM directed to you (TODO: does this also get MPIM contents?) and `from:me` to find anything you sent in a DM, `is:dm` to search all DMs you're a part of, or `with:` to select threads and DMs with particular people involved.

  `to:me` is undocumented except in a random blog post and in the filters modal of the search page.
- The top-level DMs section allows for *somewhat* better visibility into old direct messages.

## Shareable channel categories {#shared-categories}

It turns out that Slack invented a cute feature where you can have [shared sidebar sections].
In theory this could be a really helpful primitive so that you could share some of the burden of dealing with channel proliferation and organization with your coworkers.

However, they are fundamentally attached to a Slack user group, one sidebar section per user group.
They also seemingly only allow a channel to appear in one place, which is equally suboptimal for using them for search scopes (assuming that that works).
It's also clearly intended as a thing for administrators to configure to encourage a certain way of working, rather than groups self-organizing, which, *sprays with spray bottle like a misbehaving cat*.

[shared sidebar sections]: https://slack.com/intl/en-gb/help/articles/29873996048019-Share-sidebar-sections-in-Slack

# Search {#search}

Here are some search tips which are *only partially documented*.

> This reminds me of using the secret Twitter search query `filter:follows include:nativeretweets` for all posts that appeared on your follows timeline including retweets

- You can find messages by emoji reaction with `has::eyes:`, for example.
- Quotation marks *do* work like they used to work on Google back when Google worked properly: forcing a particular phrase to literally appear rather than applying an OR for all the words in your query.
- This is a list of the operators the client knows about that I can find, since they are [missing from the docs][search-docs]:
  - Channel/DM it was in: `in:`

    **Notably**, this allows searching in categories (!).
    It's unclear to me whether this applies to [shared categories](#shared-categories).
  - Attachment type: `type:canvases`, `type:pdfs`, `type:presentations`, `type:snippets`, `type:lists`, `type:images`, `type:emails`, `type:spreadsheets`, `type:audio`, `type:videos`
  - User involved in the DM/thread: `with:`
  - User who sent it in a DM: `to:`, `from:`
  - Message metadata: `has:star`, `has:pin`, `has:file`, `has:action`, `has:link`
  - Message type: `is:saved`, `is:dm`, `is:thread`
  - Time: `before:`, `during:`, `after:`

[search-docs]: https://slack.com/help/articles/202528808

## Unable to share search exclusion lists

In any company with enough Slack integrations, there's a lot of channels that are *utterly* full of spam that, if you don't work in the relevant part of the company, are absolutely useless.

Fortunately there's a setting for this in the advanced section of the settings!
Unfortunately, it's using a very frustrating UI component that doesn't have working paste, so if you have 25 channels to ignore, it is no fun.

I used to have a script to fix this, but while writing this post, I found out that they seem to have gotten rid of all the members of `slackDebug` in the dev tools window, perhaps because of removing it from public builds, perhaps because of internal technical changes that didn't care about it.
As a result my script stands no chance to work, so I'm not going to publish it.

If it is helpful to reimplementing it, however, the API method to poke at is `users.prefs.set` with `search_exclude_channels`.

```js
const res = await slackDebug.activeTeam.api.call({method: 'users.prefs.set', args: {name: 'search_exclude_channels', value: valueString}})
```

This used to allow writing little bookmarklets to mess with Slack via JavaScript, which may still be possible but it's now definitely been made a pain and I can't easily figure out how to do it.

## Doesn't work (tm)

By default the search is pretty aggressive about allowing the query terms to appear in any permutation, which results in often rather frustrating experiences.
This is fixable with quotes, but I also think that searching a fundamentally kind of low signal-to-noise ratio space like Slack is inevitably going to be at least somewhat bad.

The default "relevance" order seems to be basically random if you are giving a short query, which is rather unhelpful.

In general I would summarize the Slack search experience as working poorly for hard-to-specify reasons.

# Context {#context}

Because of the channel proliferation problems in Slack due to its threading design, it's *very* easy for a discussion to an incident or other problem to happen in one place and then have a link or a forward object sent to other channels which contain even more discussion.
Those forwards/links then often have discussion on them, or at the very least are interesting to the original post's author, but by default the app does not surface this whatsoever, which enforces siloing.

Thankfully I wrote [Slacklinker] while interning at Mercury, which pretty much entirely fixes this by, er, grabbing a fire hose of all the Slack messages in the workspace and looking for links and replying in a thread with a backlink.
There were a couple of things we learned by doing this: one was that people are quite easily annoyed at thread messages (doubly so for ones from bots) so we changed it to consolidate all backlinks into one reply to the thread that is later edited.
Also, we learned that backlinks lead to fully traversable webs of messages and that this is super helpful when duplicates are found of e.g. discussions about obscure weird Nix behaviours or other things that come up every so often, which makes these a lot easier to find as all the threads get linked together.

Interestingly enough, it appears that [Linear]'s Slack integration for expanding TEAM-1234 mentions without requiring links *also* has been necessarily implemented by grabbing a fire hose of every message on the workspace, but it rather amusingly does not do backlinks of Slack mentions of tickets on the Linear side.
I've suggested to the Linear devs that they should implement that but in the mean time I just implemented it in Slacklinker instead.

[Linear]: https://linear.app

# Solutions and conclusion {#solutions}

I don't really think there's a general solution to Slack's design flaws other than switching to another platform, which is so severely not your job as an individual in an enterprise context that it can be assumed to be far out of the realm of possibility.

Also, what are the serious alternative platforms?
- Discord is not an enterprise chat platform and really shouldn't be used as one, though I'm sure some people do it anyway
- Mattermost is a 1:1 Slack clone
- RocketChat is similar but for defense contractors (according to their website)
- Matrix is an extremely funny prank to play on any organization, let alone one that is trying to make money, and their threading model is at best as good as Discord
- Zulip is somewhat arcane, but it is the only one I know of that has a threading model that is better, though I suspect it has many discoverability limitations as well

Realistically, the actual solution here is **put less shit in chats!**
Treat Slack like a time-delayed information shredder and do not assume that anything can ever be found again in it.
Retention policies will make it into an actual information shredder, which may or may not be desirable.

- Write meeting notes.
- Send them to an archived mailing list.
- Record your meetings.
- Write design documents.
- Write actual comments in your code.
- Write meaningful commit/PR messages.
- Put links everywhere.
- Move certain discussions into mailing lists or forums, perhaps?

These solutions don't altogether fix the problems and do introduce new problems, but I think it's important to mention them.

## Ephemeral channels

Incident management tools like [FireHydrant] allow for automatic Slack channel creation and a defined life cycle for said Slack channels that involves writing e.g. postmortems in a durable form.
The good thing is that this doesn't contribute to channel proliferation long-term.
It also allows appropriate use of threads and DM-like channel spamming in incident contexts where it is *absolutely* helpful and would culturally not be acceptable otherwise.

It's totally worth setting up such a workflow for incident management and for non-incident hard problems, say, rough debugging sessions.

The bad thing is that this leads to *archived* channel proliferation, and absent ways to do something like `in:#enginc-*`, it seems like this will generate information that is *even harder* to find, since channel proliferation means that in order to find "an incident channel involving Nix" the best you can do is search for channels by name and manually search each one, and archived channels disappear from the sidebar automatically.

[FireHydrant]: https://firehydrant.com/

## Strong usage of linking {#linking}

Adding links everywhere helps a *lot* in making information traversable.
It should not be required to use search and guesses to be able to find things; search has to be a whole lot less good if you can just traverse the information that was already generated .

This is both a technical and cultural problem.
On the technical side, it's really valuable to make it as easy as possible to do the right thing, by, for example:
- Using an issue tracker that generates backlinks and auto closes tickets on PR merge if ticket numbers are in the title, to provide a carrot to doing the right thing.

  This was so important to our work at Lix that [we wrote a link bot][gerrit-linkbot] to propagate issue mentions on Gerrit to our Forgejo issue tracker to avoid duplicated work and provide better context.
- Adding [GitHub autolinks]\* to your repos to make it easier to get to tickets from mentions in body text and commit messages
- Setting up [Slacklinker] or similar bots that generate context automatically on Slack and elsewhere

  This one is so valuable because people are lazy and will hit the forward button, so doing the right thing is also doing the easy thing.

On the cultural side, finding stuff is made a lot easier by:
- Normalizing putting links in things; put the ticket number in the branch name/PR title/etc so that context is generated
- Considering information organization to be a priority.

  Hire a librarian and empower them to design an information organization system that leads people to find things by looking in the right place rather than primarily relying on search.
  Search has some critical shortfalls compared to a good hierarchical and/or link-web based organization system; in particular, the latter lets you find related pages by looking in the section, and that these are very often useful to know about and read, even if they are on different subjects.

  For instance, perhaps there's a page on how to deploy a MySQL instance and once you read that one, you might want to know how to deploy Redis or just know more in general about database deployment, perhaps, how remote access is set up.
  With just search, that exploration process doesn't come naturally.

\*: If you also use Linear, you may find <https://github.com/mercurytechnologies/linear-autolink> helpful, assuming that Linear has not implemented the same thing as a built-in feature in the three years since I wrote that tool while simultaneously filing a feature request.

[GitHub autolinks]: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/configuring-autolinks-to-reference-external-resources
[gerrit-linkbot]: https://git.lix.systems/lix-project/gerrit-linkbot

## Strong use of workflows

Slack Workflows allow enforcing particular message formats and forcing discussions about things into threads rather than allowing posting messages directly in a channel.
This does allow reducing the noise level in a channel and maybe forces more useful keywords into messages.
However, it also leads to thread proliferation, which, as established, is not something that people enjoy interacting with very much.

It can perhaps lead to more useful archives though.

Another thing that is perhaps worth doing is translating support/incident Slack channels into tickets, which then leads to them being very clearly organized and findable amongst other tickets.
