+++
date = "2022-05-29"
draft = false
path = "/blog/WALL-side"
tags = ["art"]
title = "WALL side"
+++

{% image(name="wallside.png", colocated=true) %}
poster with diagonal WALL side text in four different
languages
{% end %}

My partner has a brilliant poster they made of the backing of 3M command strips
in their apartment, which I wanted to recreate as a vector image to make
another. I initially tried inkscape, where I ran into issues with the tiled
clone tool not supporting dragging to set spacing and more crucially not
supporting absolute distances, which meant that it could not maintain proper
spacing of things of different height (I later realized it could probably be
done with a group, but there were unrelated factors of fiddliness at play such
as difficulty working in a transformed coordinate system that made Inkscape
infeasible to use).

I conceded and did this project as a simple Python SVG generator. First, I took
a picture as reference, then included it in the SVG as an `<image>`. SVG is fun
because it is *not* HTML, and is also strict XML. For instance, one difference
is that the image tag is called `image` rather than `img` and uses an `href`,
not a `src` (or indeed, `xlink:href` if you are using an older implementation
such as inkscape).

With that out of the way, I made a `<g>` group that's rotated 45 degrees and
translated some amount (`transform="rotate(-45) translate(-1000, 100)"`), then
I created the four languages of `<text>` text elements inside. Regarding how to
get the actual text to put in there, there are various ways to do this; I typed
it in on my phone (including the Japanese! there's a drawing keyboard for
Japanese in Google Keyboard, so even my dubious-quality non-Japanese-speaker
scrawls got turned into characters pretty easily).

To get each text fragment into position easily,
I nicked [some code to make them draggable][draggable],
then noted down the transformation after dragging them into position. Next, I
duplicated each language's element and moved the new one into the next
horizontal position to figure out the horizontal (along the line) period and
the next vertical position to figure out the cross-line period.

Then, I made these definitions reusable by giving them an `id` property and
putting them in a `<defs>` block. This makes the original definition invisible,
so you have to reference them as something like `<use xlink:href="#someId" />`.

Since I knew the spacings, I got Python out in earnest. To make my workflow
more pleasant, I wanted to rebuild the image on every editor save. I found a
tool [`entr`][entr] that can do this: `ls *.py | entr -r python wallside.py`.
It takes a list of files to watch on standard input, and a command to run when
any of them change.

With my setup sufficiently pleasant, I wrote some Python to generate a series
of instances of the definition with the horizontal spacing for every language,
with each looking like this:
`<use x="{idx * SPACING[language]}" xlink:href="#{language}" />`.
This forms one line of several copies of each of English, French, Spanish, and
Japanese. I put this into a `<defs>` block as a group, then referenced it in
the body of the document with a `<use>` to check my work.

After I was satisfied this worked, I then started generating that `<use>`
automatically, with the `y` offset set to some multiple of the line spacing,
and with some tweaks, that was that.

Next was the job of getting it to work on Inkscape since I was prototyping
against Firefox, which, being a web browser, has a very advanced SVG renderer
compared to non-browser programs. One thing I was doing that was not ideal for
Inkscape was that I was rendering a bunch of text off-page. I fixed this with a
clip path the size of the document like so:

```xml
<clipPath id="viewRect">
    <rect height="100%" width="100%" />
</clipPath>
<!-- ... -->
<g clip-path="url(#viewRect)">
    <g transform="..."><!-- all the text goes in here --></g>
</g>
```

Another thing that Inkscape disliked (to the point of not rendering anything)
was the use of `href="..."` in my document. Its predecessor, `xlink:href`, was
[noted on MDN][mdn xlink] as being deprecated, replaced in the SVG 2 standard
by unprefixed `href`. I just had to switch to the older one and add
`xmlns:xlink="http://www.w3.org/1999/xlink"` to my `<svg>` element to fix this.

The last bit of trouble I got from Inkscape was that it does not support the
CSS `transform` property, so I had to convert to the `transform="..."` property
directly on tags. Oh well, so much for the shiny features. But it works now and
is more portable!

Finally, I have a SVG file that is exactly what I want and was not that painful
to create. That was fun!

I've included the sources and SVG file below (note: it requires Source Han Sans
installed on your computer, which is a nice open source sans-serif font with
Chinese/Japanese/Korean support).

* [SVG file here](./wallside.svg)
* [PDF for printing here (11x17 inch tabloid size)](./wallside.svg.pdf)

{{ codefile(path="wallside.py", colocated=true, code_lang="python", hide=true) }}

[draggable]: https://github.com/petercollingridge/code-for-blog/blob/master/svg-interaction/draggable/draggable_groups.svg
[mdn xlink]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/xlink:href
[entr]: https://github.com/eradman/entr
