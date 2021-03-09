+++
date = "2020-11-11"
draft = false
path = "/blog/patching-jars-aa"
tags = ["reverse-engineering"]
title = "How to patch Java font rendering for AA"
+++

{{ image(name="jar-pre.png", alt="Screenshot of the software displaying disassembly of ARM instructions. The font is both very small and shows significant aliasing artifacts, making it hard to read") }}

This post was inspired by a *hypothetical* closed source piece of software from
a hardware vendor, written in Java, which has unusable font rendering that
makes it inaccessible for me, but I need to use it for class, so what am I to
do? I want to write evil `LD_PRELOAD` hacks but it's probably easier to patch
the program itself, so that's what we're going to do.

I use IntelliJ IDEA for my Java work. It includes quite a nice Java decompiler,
which is (probably) intentionally not exposed to the user in its full
functionality, but includes a main class that lets us access it anyway.

First, make an IntelliJ project for your sources. Include all the libraries
that they depend on. Now, time for some mild reversing!

Decompile the bad JAR file ([hat tip to
StackOverflow](https://stackoverflow.com/q/28389006)):

```
PS> $p = 'C:\Program Files\JetBrains\IntelliJ IDEA Community Edition 2020.2.1\plugins\java-decompiler\lib\java-decompiler.jar'
PS> mkdir decomp
PS> java -cp $p org.jetbrains.java.decompiler.main.decompiler.ConsoleDecompiler .\ProblemProgram.jar decomp
```

Then, you will get a source JAR with all the sources in it. You can just unzip
this with whatever tool you prefer:

```
PS> Expand-Archive decomp/ProblemProgram.jar -dest src
```

You should have all the files in your source directory and can work on them!

There are probably a pile of compile errors, because decompilers aren't
perfect. They are, however, likely fairly easy to fix to convince the project
to build. In the tool I patched, it was primarily mysteriously inserted
redefinitions and `javac` getting confused about generics.

### Time to patch!

Classes that you are looking for are subclassing `JPanel` or similar AWT
classes. They should have a `setFont` call you can patch, and an implementation
of `paint(Graphics)`. First, patch the `setFont` in the sources to use a better
font (because their choice is probably not good):

```java
this.setFont(new Font("Iosevka", 0, 14));
```

Then, for the magic incantations to patch the actual rendering ([thanks again,
StackOverflow](https://stackoverflow.com/a/31537742)):

```java
// at the top of the file
import java.awt.Graphics2D;
import java.awt.RenderingHints;

// in paint(Graphics g)
((Graphics2D) g).setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_LCD_HRGB);
```

This enables subpixel antialiasing (which is superior to the default
antialiasing type that ends up rather blurry).

Recompile, and you can do the final stage of patching:

### Reincorporating the patches

You can use the `jar` tool included with your Java Development Kit to update
the file. Note that the path to the class file must have the package name at
its base:

```
# Make a backup!!
PS> cp ProblemProgram.jar ProblemProgram-orig.jar
# Patch it!
PS> jar uf ../ProblemProgram.jar com/problemcompany/problemprogram/UI.class
```

We replace only the class that is causing us problems to reduce exposure to
anything bad that happened in the round trip through the decompiler.

Now, for the result:

{{ image(alt="program showing a disassembly view with properly smooth fonts, in contrast to
the header image with pixelated and unreadable fonts", name="jar-post.png") }}

### Bonus fun

Font rendering may not be the only thing wrong with this closed source program,
and you have to figure out some weird behaviours or find a configuration file.
A debugger can be fantastically useful for this purpose. IntelliJ provides
quite a smooth experience at debugging closed source code.

If you don't want to commit to fixing any decompilation errors, you can add the
program's JAR as a library in `File>Project Structure` in IDEA, and it will let
you set breakpoints in arbitrary class files without having to decompile and
recompile them.

Run the program with a similar Java command to this:

```
PS> java '-agentlib:jdwp=transport=dt_socket,address=127.0.0.1:5678,server=y,suspend=y' -jar C:\ThatVendor\ProblematicProgram.jar
```

{% image(name="jar-configs.png") %}
Run/Debug Configurations window in IntelliJ IDEA with a remote configuration on port 5678, host localhost, debugger mode "Attach to Remote JVM", transport "Socket"
{% end %}

Once you have the configuration set up in IDEA, you can click the "Debug"
button and it will connect to your JVM and start running the remote program.

### In case we're thinking of the same program from a blue FPGA vendor

`Monitor_Program/amp.config` has a setting `debug yes` to enable a debug
console, though it doesn't have much of interest in it.

`monitor.properties` has a setting `YOURUSERNAME-enable-source-level-debugging`
that, if disabled, as it seems to have done to itself initially, it disables
all the file related functionality in the program, which is quite confusing
indeed (and was the reason I first got out the decompiler).
