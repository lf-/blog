+++
date = "2022-10-30"
draft = false
path = "/blog/workflow-pdfs"
tags = ["pdf"]
title = "My workflow: Managing and munging PDFs"
+++

Dealing with PDFs is something I do every day as someone working in software,
especially given that I tend toward both research and lower-level work where
papers and datasheets rule.

I think that the humble PDF is one of my favourite file formats besides text:
- You can give someone one and it will work
- Vectors work great in it
- Old files also just work
- Anywhere in the continuum between "digital-native output" to "a scan" can be
  represented and worked with nicely
- Search is typically pretty great when you have the right document since they
  tend to be *large* so CTRL-F can go very far

That said, "not being a text file" does sometimes make some tasks difficult,
metadata is often dubious, and I am usually drowning in a mountain of PDFs at
all times.

Most of the stuff described in this post can probably be done with Adobe
Acrobat, but it is not available for my computer. All of the tools described
below have packaging in the AUR or main repos on Arch and are not hard to run
on other operating systems.

# Fixing PDFs

There's several tools I regularly use for fixing up PDFs off the internet,
since it's unfortunately common that they come in with bad metadata, or in
other problematic forms.

## Page numbering

PDF supports switching page numbering midway through the document, for
instance, if the front-matter is numbered in Roman numerals and the main
content is in Arabic numerals. Too often, large PDFs that run across my desk
don't have this set up properly, so the page numbers are annoyingly offset.

You can fix this with the "page numbering" feature of [jPDF Tweak][jpdf-tweak].

[jpdf-tweak-manual](https://jpdftweak.sourceforge.net/manual/index.html)

## Document outline

PDF has a great feature called "document outline" or "bookmarks", which lets
you include the table of contents in searchable form that will show up in the
sidebar of good PDF viewers.

Unfortunately, many PDFs don't have these set up, which makes big documents a
hassle to work with as you have to jump back and forth between the table of
contents page and the rest of the document to find things. Fortunately, these
can be fixed.

There are three main tools that are useful for bookmarks hacking:
- [jPDF Tweak][jpdf-tweak], a multi-tool for doing various metadata hacking.
- [JPdfBookmarks], a powerful bookmarks-specific editor.
- [HandyOutliner], a small tool mostly useful to turn textual
  tables of contents into bookmarks.

[jpdf-tweak]: https://jpdftweak.sourceforge.net/
[HandyOutliner]: https://handyoutlinerfo.sourceforge.net/
[JPdfBookmarks]: https://sourceforge.net/projects/jpdfbookmarks/

### Hyperlinked table of contents

This is the most convenient case: the author put in a hyperlinked table of
contents, but somehow the tooling didn't create a document outline. If this
happens, you can get a perfect outline with almost no work.

Use the "Extract links from current page and add them as bookmarks" button in
[JPdfBookmarks] to deal with this. It will do as it says: just grab all the
hyperlinks and turn them directly into a document outline.

This is great since generally the hyperlinks will have correct page positions
and so the outline will go to the right spot on the page in addition to going
to the right page.

### Textual table of contents

If you can cleanly get or create a table of contents such as the following:

```text
I. Introduction 1
1. Introduction 3
1.1. Software deployment 3
1.2. The state of the art 6
1.3. Motivation 13
1.4. The Nix deployment system 14
1.5. Contributions 14
1.6. Outline of this thesis 16
1.7. Notational conventions 17
```

Then the best bet is probably to use [HandyOutliner] to ingest that table of
contents as text and create bookmarks.

Often copy support in PDF tables of contents is pretty awful (and I can only
imagine it does horrors to screen readers), so it may need some serious amount
of cleanup in a text editor, as was the case for me while making an outline for
Eelco Dolstra's PhD thesis on Nix.

Another way this can be done is with the "Bookmarks" tab in [jPDF
Tweak][jpdf-tweak] and importing a CSV you make.

Such a CSV looks like so:

```
1;O;Acknowledgements;3
1;O;Contents;5
1;O;I. Introduction;9
2;O;1. Introduction;11
3;O;1.1. Software deployment;11
3;O;1.2. The state of the art;14
```

The columns are:

1. Depth
2. Open ("O" if the level in the tree should start opened, else "")
3. Data
4. Page number. You can also put coordinates at the end if truly motivated.

## Encrypted PDFs

These are annoying. You can strip the encryption with `qpdf`:

```text
qpdf --decrypt input.pdf output.pdf
```

## Pages are in the wrong order/PDFs need merging

Imagine that you have been fighting a scanner to scan some document and the
software for it is bad and doesn't show previews large enough to make out the
page numbers. Exasperated, you just save the PDF knowing the pages are in the
wrong order and spread over multiple files.

For this, use [pdfarranger], which makes it easy to reorder pages as desired.

[pdfarranger]: https://github.com/pdfarranger/pdfarranger

# Having too many PDFs in my life

## Directory full of PDFs to search

Relatable problem! Use [pdfgrep]:

```text
pdfgrep -nri 'somequery' .
```

[pdfgrep]: https://pdfgrep.org/

## Too many bloody PDFs; overflowing disorganized directories

Academics have this problem and equally have solutions: Use [Zotero] or similar
research document management software to categorize and tag documents.

[Zotero]: https://www.zotero.org/

## Getting more of them

As I have student credentials, I can use the University library to get
documents. However, getting authenticated to publisher sites is annoying: I
often don't use the University library's search system since it can have poor
results, but the login pages for individual publisher sites are confusing as
well.

UBC uses OpenAthens for their access control on publisher sites. They have a
rather nice uniform redirector service that can log in and redirect back to
sites:
<https://docs.openathens.net/libraries/redirector-link-generator>

I made a little bookmarklet to authenticate to publisher sites:

```javascript
javascript:void(location.href='https://go.openathens.net/redirector/ubc.ca?url='+location.href)
```

It's also possible to use a well-known Web site to "acquire" papers, which is
often more convenient than the silly barriers that publishers use to extract
profits from keeping publicly-funded knowledge unfree (paper authors are paid
*nil* by journals), even with legitimate access. If one were to use such a
hypothetical Web site, it is easiest to use by putting the DOI of papers into
it.

Also, paper authors probably have copies of their papers, and are typically
happy to send them to you for free if you email them.

