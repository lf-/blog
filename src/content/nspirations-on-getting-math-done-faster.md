+++
author = "lf"
categories = ["nspire", "school", "software"]
date = 2019-04-16T23:50:00Z
description = ""
draft = false
path = "/blog/nspirations-on-getting-math-done-faster"
tags = ["nspire", "school", "software"]
title = "Nspirations on getting math done faster"

+++

I enjoy math so much that my primary goal is to get it done as quickly as possible. In more practical terms, the better I can get stuff done on my Nspire, potentially the higher score I can get on the AP exams.

The Nspire is not *un*documented, just that the documentation is very well hidden. It's also not sorted by how often you might use something.

## Ctrl shortcuts
The fastest way to enter stuff is either by memorizing the menu numbers (you can press the number key which shows up on a menu to go straight to it), though that often puts you in a dialog box, or by typing it in. Unfortunately, typing stuff in is not always easy and there are many characters which seem to have no way to be typed other than by selecting them from the library or in the character list.

The most significant ones are the `\` (shift-divide) and the `_` (ctrl-space). The backslash is useful for libraries, for example: `ch\mm`, and the underscore is useful for annotating units, but I use it mostly for getting the constants such as `_Rc` (8.31 J/g·°C) and `_nA` (Avogadro's number).

Many of the usual shortcuts as you might use on a computer are also available on the Nspire, for instance, Ctrl-C, Ctrl-V, Ctrl-X, Ctrl-A (specifically with this one, I like to enter square roots as typing the inside, Ctrl-A, then the square root button). Selection can be done by shift-arrows or with the cursor as follows (note: works on computers too, awesome for copying an entire page): click the mouse where you want to start a selection, then shift click where you want the end.

For Calculus, some of the most important shortcuts are Shift-plus and Shift-minus, which are the integral and the derivative. One way to remember these is to think of what evaluating the given thing would do to the exponents in a polynomial. Integrals increase these exponents, and derivatives decrease them.

If there's anything you should take away from this post though, it's the cursor navigation shortcuts! They are in the same arrangement as you would see on a computer numpad. That is to say, Ctrl-1 is home, Ctrl-7 is end, Ctrl-9 is Page Up and Ctrl-3 is Page Down.

## Graph environment
The most interesting thing about the graph environment is what I call the right click, which brings up the context menu for whatever is under the cursor (Ctrl-Menu). From this, you can access recent commands and other stuff:

![Annotation-2019-04-16-172723](/blog/content/images/2019/04/Annotation-2019-04-16-172723.png)

To do stuff precisely, for example when you are finding an integral between 0 and 2, you select the integral command, then type 0 on the keyboard, press Enter, then press 2, then Enter.

To get the precise coordinate of some point, for example an intersection, click once on the text of the coordinate you want to store, press Ctrl-Var (sto->), and it will give something like `var := 123.45`. Enter the variable name you want, and press enter. You can then access the information about that variable in the right click menu of the text.

If that point doesn't yet have coordinates displayed, for instance if you placed it from the geometry environment and you need to move it to some precise position, you can give it some by clicking on the point, then using the right click menu and selecting "Coordinates and Equations".

