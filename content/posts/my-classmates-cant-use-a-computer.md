+++
date = "2023-11-03"
draft = true
path = "/blog/my-classmates-cant-use-a-computer"
tags = []
title = "My classmates can't use a computer: a tragedy in three parts"
+++

I am a fourth year computer engineering student and I lack pride in my
vocation. None of this is the fault of the other students, or even, often, the
professors. Structurally it is all wrong and I don't believe it will change
without at least acknowledgement of the problem at the highest levels.

Many of my classmates don't do more than is graded in their classes, and they
often don't seek support when they're lost. This happens, among other reasons,
because the program is allegedly 4 years, but only 20% of people complete it in
4 years due to class snafus, co-op internships, and other reasons. But, the
standard course load is very heavy and makes a lot of giant leaps in
expectations without actually teaching prerequisite skills. The result of heavy
course load plus inadequate teaching of basic "using a computer" skills is that
labs take most students at least 4 times longer than they usually take me or my
friends, so *of course* people can't get out from being underwater: they have
no free time to pay down the knowledge debt.

It is reasonable that people might learn computers to get a well-paying job,
rather than out of significant interest, but the program fails both the highest
performing and lowest performing students. Often, classes do not provide
resources to learn further things about the discussed concepts, and often don't
verbally acknowledge the next pieces of those things at all. At the same time,
the prerequisite classes don't adequately represent the knowledge actually
needed so students who were already behind stay behind.

Wonder why there aren't many women in computer engineering? There are many
reasons but it doesn't help that many women going into computing did not do it
as a hobby growing up, and then get tossed in a program that expects them to
somehow have learned skills through osmosis. Some people refer to a pipeline
problem, where more diverse people don't get into computing early, and while
that is true, what is the point of fixing the pipeline when the pipeline leads
into a meat grinder, because industry is a misogynist hellscape.

This post does not name the courses responsible but they are likely familiar to
anyone in the program.

# Bad professors, good professors

There are professors who are known for being difficult, but there is equally a
culture of learned helplessness or adversarial attitudes in the program: when
things are hard or feel unfair, it is quickly blamed on the professors.

## The curriculum made me do it

One of the courses in the computer engineering curriculum is a first-year C
class. This class does not effectively bring students from a state of not being
able to program to a state of being able to program, or to be able to program
effectively in C. One of the problems with this class is that it only briefly
covers pointers, and issues of bounds checking are not covered.

For example, the class gives `scanf("%s", some_buf)` in one of the labs as a
way of getting a word into a variable. This code is simply wrong, since it does
not have any way of specifying the length of the buffer so it always creates a
buffer overflow problem, but it is presented as the way of doing things and at
no point is any issue with it mentioned.

There is some brief coverage of embedded, using an emulator of an Arduino, but
it's not really covered why an embedded system is meaningfully different from
running it on your own computer. Students aren't taught how to run C on their
own computer.

About equal if not more time and exam questions are spent on printf specifiers
as are spent on pointers.

The immediately following year in a Java "Software Construction" course after
not properly being taught C, without any further programming instruction,
students are expected to write Java at a medium level for practical projects
such as implementing a Fourier transform, implementing a multi-threaded cache,
and implementing a basic query parser and execution engine. This class is
genuinely well run, but it is being given students who don't know much of how
to program to begin with, in perhaps the busiest semester in the entire
program. The course teaches most of the higher level ideas that it uses, but
not the actual mechanics of Java. Although the Java course suggests that
students learn Java over the summer, it is unclear whether people actually do,
perhaps for lack of time or support.

The Java course equally does not teach anything about build systems or how to
use a command line: they encourage students to use IntelliJ to set up their
projects and build them because it reduces the amount of work students have to
do to get a working environment, and allows TAs to spend time not fixing
students' computers. Although this is individually a reasonable decision, it
contributes to the "running programs on your own computer" debt.

Later in second year, students are expected to write an ext2 device driver in
C, among several other reasonable sized projects. Somehow, between the end of
"baby C" and "applying C" students are supposed to have acquired by osmosis: a
working knowledge of resource management, heap vs stack, pointers (real
edition), and more. Equally, they somehow are supposed to have figured out how
to use a debugger or how to find memory bugs. At no point in any class I have
taken has the existence of `-fsanitize=address` been mentioned; though
`valgrind` has.

## Not updating the documentation when students fix it

It's repeatedly the case that the materials for assignments are highly
outdated, and often students fix them. It's very infrequently the case that
they actually get updated with feedback.

I took an OS class, which I regard very highly as probably one of the kindest
courses to students I have ever taken. It uses an OS written by Harvard
professors 20 years ago, on a custom MIPS emulator, built with GCC-4.8, and BSD
make to build it. Using old software is not inherently a problem although such
an old GCC does not have good diagnostics compared to modern ones. However,
sources they provide for their toolchain don't compile on modern Linuxes due to
bugs in the configure script of old versions of gdb, and the emulator defining
rather than declaring variables inside a header file which is included into
multiple source files, among other things.

I fixed this and wrote an automated script that applies the necessary fixes and
builds it. This script was added in a footnote. It did not replace the official
guide, which, notably, does not work and has a list of errata at the bottom,
which they did not bother actually fixing in the files they distribute.

Hiding the process to run the software on your own computer contributes to the
debt of "running software on your own computer".

Another similar story is related to Git commands: a project class professor
made basic slides about Git. I suggested that the `checkout` slides be changed
to use `switch` and `reset`/`checkout` be changed to `restore`. These were
stuffed into the bottom of the slide as "to investigate" in the next year, with
the implication that they are unsupported and not recommended. These commands
were added to Git in 2018 and reduce errors. At UBC we don't teach git with the
most modern commands because we didn't look them up.

## idk, i use stock emacs like it is 2003, what's the problem, use cscope!

I also documented how to use `bear` to build the OS class's kernel and get
`clangd` to work with it. `clangd` provides a modern editor experience for C
including completion, immediate error feedback, good error messages, macro
expansions, and more. This documentation did not survive until the next year in
any official place and was manually ported from the previous year's discussion
board. The prof by comparison suggests using `cscope` and `emacs`, as she has
presumably not done any yak-shaving on editor tooling in the past 8 years. This
is fine, and she is allowed to do it, but it denies students the confidence
that they can have good tools no matter the project.

Theoretically the policy espoused by professors is of neutrality in the tooling
that students use. However, by not explaining how to integrate the project with
the modern standard tools or indeed incorporating fixes to build it on a modern
computer, the message being sent is that if you have only the knowledge you're
expected to have to do the course, you can't work on your own computer and you
can't use any tools that assist in programming.

Students are not taught how to get IDEs working on projects, in spite of
"having a working IDE" being standard practice in industry. This contributes to
a learned helplessness where "the tooling catgirl" would have to fix it in
industry: working tools have to be given to you, you don't make it work
yourself.

## Code experiences the passage of time

Often times, code distributed with assignments does not build on modern Linux
distributions. In many cases, the code is accompanied with information that it
has only been tested on some old distribution or tool version. The typical
student reaction is to not try running it on their own computer because often
it is suggested it does not even work on newer versions.

I have had to fix at least 5 assignments to run on modern machines over
the course of my degree. Sometimes the assignments don't even work on the
provided servers because they last compiled them 5 years ago, and usually
professors don't take personal responsibility for this oversight.

Typically it is blamed on the student in question if they ask for help, since
it is assumed it is their environment that is broken rather than the
assignment; yet, assignments are simply carried over unchanged from previous
years without ever testing that they work on modern machines.

<aside>
Recently, there was a post on a computer architecture course's message board
about an assignment failing since an Intel binary instrumentation tool would
not run, complaining of unrecognized ELF features. The student was blamed for
using an AMD CPU and suggested to run it on the department servers, without any
further investigation.

Reader: the problem was that the assignment shipped a version of that
instrumentation tool from 2020, with 500MB of bonus redundant precompiled
object files (?!), which is incompatible with newer glibc versions, nothing to
do with the CPU. It was solved by updating it to a slightly newer version and
praying that my code does not rely on new features.
</aside>

### Intel Quartus and the passage of time

The computer engineering program includes several classes that use Intel
Quartus for building FPGA designs. Universally, they recommended ancient
versions. The oldest I have seen recommended (in 2021!) is version 14, but
version 18 was also suggested as the only version that is supported for another
class in 2020.

These versions are [severely broken on
Linux](https://jade.fyi/blog/quartus-16-on-arch-linux/), due to changes in
fontconfig/freetype2 ABI, as well as launcher scripts for ModelSim which simply
do not work at all as-written.

They actually work fine on newer Quartus, btw, the professors just didn't test
it and put scary warnings up. I was even scared to do it because I couldn't be
certain that my stuff would build with the old version they might check it
with.

## Aside: "non-technical" classes

The degree program includes several classes that are non-technical in nature.
Many of them are very ineffective and had I not taken real classes from the
humanities, these would absolutely make me think anything nontechnical is
completely useless and miserable.

The poor execution of these required courses is a *serious* problem for the
quality of the graduates of the program, as it contributes to the perception of
non-technical tasks as not becoming of engineers. Also, based on the limited
dataset I've seen of my classmates' writing, they are underserved by their
degree program.

Quality humanities classes often involve extensive discussion components, doing
readings, and writing essays with limited structure on the process of doing so.
They are fun, engaging, and generally far smaller than the required
non-technical engineering classes. They develop writing skills, empathy, and
the ability to work with information.

The following are some required non-computer classes:

* Accounting (CPEN 481)

  Teaches how to understand the time value of money, how loans work, how to
  read financial reports, how taxes work. Almost teaches Excel, but falls short
  of actually committing to that.
* Writing (WRDS 150)

  Does a reasonable effort at trying to teach how to write or read scientific
  papers and generally work with the literature. Genuinely useful.
* Technical Communication (CPEN 281)

  This teaches writing a report and writing formal letters or emails. But it's
  very formulaic and involves the writing of cursed group summary papers.
* Impact of Engineering on Society (APSC 262)

  Weird combination of a philosophy class and an engineering class and fails at
  being either one. The number of things wrong with this class do not fit in
  this blog post. A couple of problems with it include largely brushing over
  discussing the power structures engineers exist in, student-run
  strangely-large-group discussions on unfocused subjects with little research
  required, and unfocused attempts to cover the intersection of
  indigeneity/race/etc and engineering that tend to skirt around power.
* Physics lab (PHYS 159 ≈ PHYS 119)

  Included in this list because it's probably the most useful course I have
  taken in my degree. I took PHYS 119 rather than 159. This one-credit (!)
  course teaches how to collect and analyze data from performing simple physics
  experiments using Excel and develops statistical formulas from first
  principles. It genuinely teaches how to use Excel. This did more for me being
  an ok scientist than anything else in the degree program.

## Aside: professors engaging in truly unacceptable behaviour

### FIXME: idk if i should include but like. fuck it we are at 4k words already.

There are difficult professors, and then there are professors who cross lines.
Both exist, but the latter are especially unacceptable.

There is one tenured professor who is so notorious for his behaviour that he
actually got reprimanded, but he is still teaching. He is notorious for going
on creepy personal tangents, having weird behaviour towards women, and has
commented on my friend's weight.

To understand more about how institutions protect missing stairs and otherwise
unacceptable behaviour, I would suggest [Sara Ahmed's book
"Complaint!"][complaint], which provides a chilling look into how the
structures behind universities tend towards burying allegations,
engaging in discriminatory practices, and stonewalling complaints.

[complaint]: https://www.dukeupress.edu/complaint

# Not learning what you don't get graded on

The practice of only looking at what one is graded on is a very common one: if
there is not summative assessment attached, it is not interesting.

At no point in the computer engineering degree is one graded on using a
computer, or using one's own computer, and it is almost always possible to get
away with not doing so. Thus, it is possible to graduate from computer
engineering without being able to write software and run it on one's own
computer.

## Nobody knows how to use a command line

It is a common experience that people will get confused by command lines. The
following skills are highly uncommon even in upper level students:

* Knowing which directory one is in and getting around the filesystem
* Adding things to PATH
* Installing things from the OS package manager

## Nobody believes that you can run code on your own computer

Many tasks in school involve building and running software on x86_64 Linux. One
would imagine that this would mean that students are given resources for how to
set up a VM on their computer or install Linux themselves. Especially with the
proliferation of ARM computers now, it is increasingly hard to run school code
on one's own computer without a bunch of knowledge that is simply not taught.
Unfortunately, no such resources are provided, possibly owing to the
decentralized planning/non-planning of the program curriculum.

It would be really useful to tell people e.g. how to use WSL2 on their own
Windows computer, or how to use [UTM] on a Mac to emulate x86_64 Linux or run
arm64 Linux. But this is not done, and it is not done centrally. There should
be a central help system for helping people get school software running on
their computer and documenting/keeping track of the problems encountered.

[UTM]: https://mac.getutm.app/

Perhaps helpfully, the department provides a lowest-common-denominator for
students to use. However, it is terrible: it is a VM on an 8 year old server
with 2 cores, 96 GB of memory, and the world's slowest NFS home directory. As
of the writing of this post it is running Ubuntu 20.04. The typical conditions
on this machine are overload and sadness, especially proximate to deadlines.
One factor which has certainly not helped is the proliferation of [VSCode
Remote], which runs a pretty heavy nodejs process on the machine for every
editor client.

[VSCode Remote]: https://code.visualstudio.com/docs/remote/remote-overview

I don't support the elimination of the department servers since these *have* to
exist for the sake of people who can't afford laptops with decent performance,
but there are *plenty* of people who have perfectly adequate machines that they
simply don't know how to run software on and have to eat *even more* wasted
time on their labs on account of unnecessarily using overloaded and slow
department servers.

In one egregious case, an assignment involved running a CPU simulation on 20GB
of instruction trace files, which took some hours on the server (single
threaded, to not disrupt others) compared to 15 minutes on my desktop computer
using parallelism.

## Nobody knows how to use git

The number of git repositories I have fixed is certainly over 5. People are not
taught git yet they are expected to know git by some sort of diffusion through
the air.

The only instance I know of people being taught git was in that third year
project class (now optional!) with the professor who didn't look into `git
restore` and `git switch`. Yet, students are expected to use git regularly in
second year, and are not taught it. Sometimes there are tutorials linked
somewhere, but as always, problems show up right before some deadline and it is
not appropriate timing to learn.

Git is treated as something to be learned as you go, rather than as something
to actually get good at and understand deeply. [Julia Evans] has [quite][jvns1]
a [few][jvns2] excellent [pieces][jvns3] about Git being confusing, and these
are all true. They are doubly true when one is muddling through Git whilst
distracted by some other problem and not in the mental space to learn or
understand Git.

[Julia Evans]: https://jvns.ca
[jvns1]: https://jvns.ca/blog/2023/11/01/confusing-git-terminology/
[jvns2]: https://jvns.ca/blog/2023/10/20/some-miscellaneous-git-facts/
[jvns3]: https://jvns.ca/blog/2023/11/06/rebasing-what-can-go-wrong-/

## Graphs? What graphs?

Something that is rather shockingly not in the standard computer engineering
curriculum is teaching students how to make good plots. At best, we allegedly
learned allegedly-Matlab (Octave) in a math class, but not at much of a level
and sort of as a secondary objective.

There's also not really any teaching of crunching numbers with the (imo
terrible but useful) `numpy`/`pandas`/`matplotlib` stack or any equivalent such
as R.

Despite this, being able to visualize data in graphs quickly and efficiently is
an incredibly useful skill in any kind of engineering including software: see,
for example, [some of the work of Dan Luu][danluu], plotting latencies of
services to understand pathologies. I have also used [gnuplot] plots myself to
evaluate a motion planning system and validate its behaviour by simulation.

[danluu]: https://danluu.com/latency-pitfalls/
[gnuplot]: https://gnuplot.info

This gap came up recently with needing to produce a pile of bar charts for an
assignment, struggling with `pandas` for a while, and realizing I have almost
never produced a plot in my degree. I guess it's not considered a requisite
skill to be an engineer.

## Epistemic habits: looking up external resources

It's very infrequently the case that students look at external resources,
especially the official reference documentation. This is partially because it's
not taught, and often it is not linked. The end result is that my classmates
often assume that things work by incomprehensible eldritch magic, when they are
actually extensively documented somewhere hard to find.

Part of the problem is that often it's not discussed *who* is responsible for
making the various tools being used and thus where the official documentation
might be. People don't know that their compiler is GCC or clang and that they
should look up the GCC documentation for its options.

Since the Unix command line is not taught, it's not clear where to even go
looking (`man` pages are hardly mentioned) to learn more about how a shell
script works. It's relatively established in my circles that Google is useless
these days; most programming queries give you TutorialsPoint, w3schools, or
some similar Web site optimized for high Google ranking that just gives you the
answer, but often they don't say where the reference is, so it is hard to ever
learn anything from using them.

Given this epistemic environment of the Internet (and with AI shovelware
producing even more of such Web sites), a useful education needs to include how
to find reliable documentation, and UBC engineering does not deliver it.

Very criminally, the C course never mentions either the `man` pages for C
functions or [cppreference]. The operating systems course at best passingly
mentions reading the POSIX standard, in spite of being *about* implementing a
Unix system.

[cppreference]: https://cppreference.com

There are excellent tools like [Zeal]/[Dash], similarly [devdocs.io], and, for
GNU things [docs.jade.fyi], that yield very nice experiences for reading
official docs and somewhat sidestep the issue of finding the actual sources.

[Zeal]: https://zealdocs.org/
[Dash]: https://kapeli.com/dash
[docs.jade.fyi]: https://docs.jade.fyi/
[devdocs.io]: https://devdocs.io/

### ChatGPT

ChatGPT is a menace, and is going to make all of this worse, because VC bros
invented a box that gives you the answer directly without having to understand
anything you don't have time or energy to understand; yet it is also often
wrong and confusing and doesn't provide citations to check its work or learn
more.

I don't blame anyone cheating their future selves by using it, since this
engineering program is simply failing its students by throwing them into the
shark pit and expecting them to learn under fire.

The university has been fucking around with respect to teaching fundamental
skills and now they get to find out the consequences of their actions (having a
computer muddle through things for students). I think ChatGPT is immensely
destructive to the university as we know it, but maybe it needs destroying.

# Stories

## Optimization exercises compiled with `-O0`

On multiple occasions in my degree, first, egregiously, in an assignment about
teaching temporal/spatial locality for caching, then recently in an assignment
about optimizing a search algorithm expecting a change from a linear search to
a binary search, I have been assigned supposed optimization exercises where the
build system was misconfigured to not ask the compiler to optimize the code.

The egregious example of this was an exercise where students were expected to
rearrange loops so that they were accessing items in linear memory order.
However, in order to get the expected performance, one has to also use the
`register` keyword on the loop counter.

The `register` keyword should never be used in modern code: it does not do
anything because the compiler's register allocator will do it properly as-is.
Well, it does not do anything *except* in `-O0`, where at least on `gcc`, it
forces the compiler to stop constantly spilling the variable into memory.

In the second example, at least, it would not be possible to achieve sufficient
performance without switching the search algorithm, even with vectorization, so
at least it does not teach any false lessons.

## Docked for "experimental Java features"

I had marks docked for using "experimental Java features" in one class since I
used features newly brought out of preview in Java 14, released 6 months prior
to the course starting. I think I might have argued it, but did not escalate
far enough.

Similarly, I think I have gotten trouble for using a compiler for which the C++
release when unspecified is newer than the one the instructors used. The code
built on my machine but it did not on theirs, since they inadequately specified
the expected build environment by not including a `-std=` flag.

Thereafter, I have had a constant fear that by using literally anything
released in the past five years, I might get docked marks.

