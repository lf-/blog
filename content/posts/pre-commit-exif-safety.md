+++
date = "2023-04-24"
draft = false
path = "/blog/pre-commit-exif-safety"
tags = ["workflow", "git"]
title = "pre-commit for safe image handling"
+++

Modern cameras put a *lot* of metadata into images:

* GPS location
* Device model
* Camera software version
* Subject distance
* Facing direction
* Colour profiles
* Time, with timezone
* Reasonable camera stuff like ISO, shutter speed, flash usage, focal length

This is mostly good actually, since it is useful to you as the photographer.
I've very frequently found use for photo geolocation of old photos. However, it
can present a significant privacy risk if you ever post or send someone
verbatim image files taken by such a camera; in particular, the GPS
coordinates. Out of an abundance of caution, I would prefer to strip *all* of
it that is not necessary to displaying the image.

Image metadata, of course, is not the only way to cause yourself privacy
problems with images. The *data* itself can be just as big of a problem: your
OS vendor can [fuck up their filesystem APIs undocumentedly and cause an
"acropalypse"][acropalypse], or particularly motivated stalkers can geolocate
most distinctive things, especially if there's a background of "outside". That
said, the phrase "your threat model is not my threat model but your threat
model is OK" always rings true, and this may or may not actually be a
consideration.

[acropalypse]: https://arstechnica.com/gadgets/2023/03/google-pixel-bug-lets-you-uncrop-the-last-four-years-of-screenshots/

It's a well known bug class to forget to strip image metadata so relatively few
web tools will make the mistake of not stripping it, but sometimes [people mess
it up][bug1]. If I used a web-based content management system, I would double
check it, but I would expect that it strips any private metadata off of images.

[bug1]: https://gitlab.com/gitlab-org/gitlab/-/issues/239343

That said, this website (like many others run by computer dorks) is maintained
with a static site generator, a [forked version][zola-fork] of [Zola], which
takes text and image sources to generate HTML, as a compilation process: the
source files are left untouched. Further, perhaps unfortunately, my [source
files] are public so I had better not check in anything bad.

[zola-fork]: https://github.com/lf-/zola/tree/tree-painter
[source files]: https://github.com/lf-/blog
[Zola]: https://getzola.org

Ruh roh. Better not check in any images with metadata. I have, to date,
succeeded in this purely by vigilance, but vigilance is not a robust process.
Typically I stick the images into the GNU Image Manipulation Program and export
fresh files without retaining EXIF metadata.

Let's fix this by instituting an automated barrier that also fixes images:
[`exiftool`][exiftool] conveniently supports most image formats, and can do
arbitrary metadata editing. We can ensure that it is always run on files before
they are checked in by using a tool like [pre-commit] to create user-friendly
Git hooks.

[exiftool]: https://exiftool.org
[pre-commit]: https://pre-commit.com/

First, we need to find a `exiftool` invocation. We want to keep *some* metadata
that is crucial to having the image display correctly: we need the colour
profile so the colours are right, and we need the orientation (since phone
cameras tend to rotate the image on the viewer side, probably because that
makes rotation lossless).

The [manual][exiftool-docs] states:

[exiftool-docs]: https://exiftool.org/exiftool_pod.html

> --TAG
>
> Exclude specified tag from extracted information.
>
> (...)
>
> May also be used following a `-tagsFromFile` option to exclude tags from being
> copied (when redirecting to another tag, it is the source tag that should be
> excluded), or to exclude groups from being deleted when deleting all
> information (eg. `-all= --exif:all` deletes all but EXIF information). But note
> that this will not exclude individual tags from a group delete (unless a
> family 2 group is specified, see note 4 below).
>
> Instead, individual tags may be recovered using the
> `-tagsFromFile` option (eg. `-all= -tagsfromfile @ -artist`).

Hmm, so `-all= --icc_profile:all -tagsfromfile @ -orientation`, maybe?

{% codesample(desc="exiftool output") %}

```
 » exiftool PXL_20220116_223722991.jpg
ExifTool Version Number         : 12.50
File Name                       : PXL_20220116_223722991.jpg
Directory                       : .
File Size                       : 1551 kB
File Modification Date/Time     : 2023:04:24 15:05:02-07:00
File Access Date/Time           : 2023:04:24 15:05:02-07:00
File Inode Change Date/Time     : 2023:04:24 15:05:02-07:00
File Permissions                : -rw-r--r--
File Type                       : JPEG
File Type Extension             : jpg
MIME Type                       : image/jpeg
Exif Byte Order                 : Big-endian (Motorola, MM)
Orientation                     : Horizontal (normal)
X Resolution                    : 72
Y Resolution                    : 72
Resolution Unit                 : inches
Y Cb Cr Positioning             : Centered
Profile CMM Type                : 
Profile Version                 : 4.0.0
Profile Class                   : Display Device Profile
Color Space Data                : RGB
Profile Connection Space        : XYZ
Profile Date Time               : 2016:12:08 09:38:28
Profile File Signature          : acsp
Primary Platform                : Unknown ()
CMM Flags                       : Not Embedded, Independent
Device Manufacturer             : Google
Device Model                    : 
Device Attributes               : Reflective, Glossy, Positive, Color
Rendering Intent                : Perceptual
Connection Space Illuminant     : 0.9642 1 0.82491
Profile Creator                 : Google
Profile ID                      : 75e1a6b13c34376310c8ab660632a28a
Profile Description             : sRGB IEC61966-2.1
Profile Copyright               : Copyright (c) 2016 Google Inc.
Media White Point               : 0.95045 1 1.08905
Media Black Point               : 0 0 0
Red Matrix Column               : 0.43604 0.22249 0.01392
Green Matrix Column             : 0.38512 0.7169 0.09706
Blue Matrix Column              : 0.14305 0.06061 0.71391
Red Tone Reproduction Curve     : (Binary data 32 bytes, use -b option to extract)
Chromatic Adaptation            : 1.04788 0.02292 -0.05019 0.02959 0.99048 -0.01704 -0.00922 0.
01508 0.75168
Blue Tone Reproduction Curve    : (Binary data 32 bytes, use -b option to extract)
Green Tone Reproduction Curve   : (Binary data 32 bytes, use -b option to extract)
Image Width                     : 4080
Image Height                    : 3072
Encoding Process                : Baseline DCT, Huffman coding
Bits Per Sample                 : 8
Color Components                : 3
Y Cb Cr Sub Sampling            : YCbCr4:2:0 (2 2)
Image Size                      : 4080x3072
Megapixels                      : 12.5
```
{% end %}

Looks like it. It's not overwriting the file though, but it looks like there's
`-overwrite_original` for that.

Let's put it all together into pre-commit: we want a [repo-local
hook][precommit-repolocal] because it's easier to manage, so something like
this as `.pre-commit-config.yml`:

[precommit-repolocal]: https://pre-commit.com/index.html#repository-local-hooks

```yaml
repos:
    - repo: local
      hooks:
          - id: no-spicy-exif
            name: Ban spicy exif data
            description: Ensures that there is no sensitive exif data committed
            language: system
            entry: exiftool -all= --icc_profile:all -tagsfromfile @ -orientation -overwrite_original
            exclude_types: ["svg"]
            types: ["image"]
```

Check with `git add .pre-commit-config.yml image-with-gps.jpg && pre-commit
run`, and it fails as expected. If we `git add` the file again, it will pass,
and the file is now devoid of problematic metadata. Success!
