+++
date = "2020-05-22"
draft = false
path = "/blog/qmk-hacking"
tags = ["qmk", "keyboards", "software"]
title = "What I learned doing some casual QMK hacking"
featuredImage = "../images/new-keyboard.jpg"
+++

I recently acquired a new keyboard, which was a Whole Thing (tm) as I ordered
it right at the end of Chinese New Year's, in time for the entire country to be
locked down for COVID-19 reasons so it ended up turning up yesterday, three
months later. It's a KBDFans DZ60 in an extremely normal layout, with Kailh Box
Brown switches. I bought it to replace my Unicomp keyboard which was mostly
fitting requirements but was taking up too much space on my desk, only properly
handles two keypresses at once, which is annoying for even the minimal gaming I
do.

The main attraction of this keyboard is that it runs qmk firmware, the same
software I run on my [macro pad](./i-designed-and-built-a-mechanical-macropad-numpad),
meaning I can do pretty extensive firmware modifications to it. For instance,
on that device, I implemented an autoclicker in firmware. It allows for
multipurpose keys such as using caps lock as escape and control in firmware
such that there are no issues with some applications using raw input as I
experienced while using [`uncap`](https://github.com/susam/uncap).

One major feature I wanted to bring over from the macro pad project was the
custom static light patterns. This is a feature that qmk itself doesn't have a
fantastic story for, so I had to implement it for myself on that platform.
However, my existing implementation had several annoying flaws: at anything
except the lowest brightness, the colours were very washed out (bug), it
sometimes got confused and emitted bad output, which was exacerbated by the new
board having 16 LEDs.

The existing system used a qmk function designed for typical use cases for
setting individual RGB LEDs such as for indicating whether the various lock
keys are on. This had a bug in it which I was very confused about on the
initial implementation on my macro pad: sometimes the LEDs would not turn on as
they should, or they would skip some. However, this was only exposed because I
had accidentally activated on both key press and release events on my custom
keys, causing the light updates to be hit in quick succession. Once I fixed
that unrelated bug, I thought it was fixed. This bug returned on the new
system, yet when I introduced debug statements to see what the LEDs were being
set to, it stopped happening, though I found another bug.

Learning 1: negative values for unsigned types in C behave differently than I
expected. I was using -1 as a sentinel value for LEDs which are off since it
was outside the range I believed the variable had. However, for some reason, it
was failing to hit a branch based on that value. I need to further investigate
this, it might have something to do with literal type.

About this time, I remembered the issue on the macro pad implementation and
assumed it was a timing issue since it happened less with the debug prints, so
I added delays which fixed the problem. Talking with some very helpful people
on the qmk Discord, I learned that the function I was using to set the LED
values was sending out the entire string of LEDs' values on every call, which
was unnecessary since I was updating all of them and it would suffice to send
them all at once. I had read the source code for the LED system but thought I
could not interact closely enough with the internals to do this update all at
once, however, since I was working with it last, [that possibility was even
documented](https://docs.qmk.fm/#/feature_rgblight?id=low-level-functions).

Learning 2: if something is confusing, ask about it and reread the code again.
I thought that the internal state of this module was not `extern` when it
actually was, enabling me to set the LED states then send them all at once by
working with a lower-level API.

There still remained the issue of the desaturated colours. I was struggling
with this on the previous implementation and just assumed that the LEDs were
really bad at colour reproduction. Eventually after reading some documentation,
I noticed that the qmk project ships with constants for various colours and
they were -completely- different from the ones I was using. For context, the
light pattern feature uses Hue-Saturation-Value colours so that brightness can
be adjusted by changing the value component while retaining the same colour.
Typically, this is represented with hue as a rotation of the colour wheel from
0 to 360 degrees, a saturation of 0-100% and a value from 0-100%. If I had
looked at the data types that the functions accepted more closely, I would have
likely noticed that the hue was a uint8_t, too small to represent the 360
degrees. However, I neglected to do that and instead passed in a uint16_t which
was truncated much to my confusion when all my colours were wrong.

Learning 3: When calling C APIs, quickly use `ctags` to double check the
parameter types. C has very loose casting rules that can permit bugs and
misunderstandings to compile when they should not.

Learning 3.5: Apparently you can using floating point in constants in C without
requiring that the entire program be compiled with floating point. This was
useful for converting colour ranges without pointless loss of precision by
multiplying by the ratio with floating point, then casting it back to an
integer. I confirmed this with [godbolt.org](https://godbolt.org) and staring
momentarily at the generated assembly.

I fixed my colours so they were the right hue, but they still were just various
shades of white. This is where I stared at the constants again and realized
that *both hue and saturation* were values from 0-255 in qmk. Oops. Another
scaling to the rescue. The lack of obvious indication that the values had this
range in the documentation is probably a flaw and I intend to submit a patch to
fix it.

Why would I do all this work? I wanted to practice my C. Also, putting pride
flags in unusual places is fun and validating.

You can look at the source of my changes [on
GitHub](https://github.com/lf-/qmk_firmware/tree/em-dz60)
