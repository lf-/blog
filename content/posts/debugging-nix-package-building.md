+++
date = "2023-10-19"
draft = false
path = "/blog/debugging-nix-package-building"
tags = ["nix"]
title = "Debugging Nix build inconsistencies: manual vs automatic build"
+++

This is a quick post about an issue I debugged in a package build that didn't
matter, which may however still be instructive.

I was packaging [ios-webkit-debug-proxy] for NixOS, not having noticed it was
already there (oops! I noticed after fixing my build), and I ran into an issue
where my build was not working, so I tried building it manually, and it worked.
Wat.

[ios-webkit-debug-proxy]: https://github.com/google/ios-webkit-debug-proxy

Here is the `package.nix` I was using:

```nix
{ stdenv, fetchFromGitHub, autoconf, automake, libtool, pkg-config, libimobiledevice }:
stdenv.mkDerivation {
  pname = "ios-webkit-debug-proxy";
  version = "unstable-2023-09-23";
  src = fetchFromGitHub {
    owner = "google";
    repo = "ios-webkit-debug-proxy";
    rev = "c5d2e959043293ee7d0587618af2bcc4dde7feef";
    sha256 = "sha256-vBrYbCzH83BqB7uTybEmF/yp2N40qJp+97lu+nKulXM=";
  };

  preConfigure = ''
    NOCONFIGURE=1 ./autogen.sh
  '';

  # These are the fix ;)
  # dontAddDisableDepTrack = true;
  # dontDisableStatic = true;

  nativeBuildInputs = [
    autoconf
    automake
    libtool
    pkg-config
  ];

  buildInputs = [
    libimobiledevice
  ];
}
```

This is what was happening:

```
$ nix build -L --impure --expr 'with import <nixpkgs> {}; (callPackage ../package.nix {})'
error: builder for '/nix/store/0ci7kyfmcbbxq5g5svzlp316y98vvgng-ios-webkit-debug-proxy-unstable-202
3-09-23.drv' failed with exit code 2;
       last 10 log lines:
       > gcc -DHAVE_CONFIG_H -I. -I..  -I../include -I../src   -I/nix/store/n4wwsam3rk07mghksrp46sn
lmf7cdi33-libimobiledevice-1.3.0+date=2023-04-30-dev/include -I/nix/store/cykm9dyc58l9jfilgrd0aflfn
znzrc39-libplist-2.3.0-dev/include -I/nix/store/cykm9dyc58l9jfilgrd0aflfnznzrc39-libplist-2.3.0-dev
/include -I/nix/store/3g9fg7cdh3234xi5b14v1fp135q8ix49-libusbmuxd-2.0.2+date=2023-04-30/include -I/
nix/store/lqsfdc4p9vax2h55csza9iw46zjpghl6-openssl-3.0.10-dev/include -g -O2 -Wall -Werror -c -o ..
/src/socket_manager.o ../src/socket_manager.c
       > ../src/socket_manager.c:34:10: fatal error: socket_manager.h: No such file or directory
       >    34 | #include "socket_manager.h"
       >       |          ^~~~~~~~~~~~~~~~~~
       > compilation terminated.
       > make[2]: *** [Makefile:464: ../src/socket_manager.o] Error 1
       > make[2]: Leaving directory '/build/source/examples'
       > make[1]: *** [Makefile:410: all-recursive] Error 1
       > make[1]: Leaving directory '/build/source'
       > make: *** [Makefile:342: all] Error 2
       For full logs, run 'nix log /nix/store/0ci7kyfmcbbxq5g5svzlp316y98vvgng-ios-webkit-debug-pro

$ nix develop --impure --expr 'with import <nixpkgs> {}; (callPackage ../package.nix {})'
$ cd manually-cloned-src
$ NOCONFIGURE=1 ./autogen.sh
$ make -j8
(succeeds)
```

So, we know that the issue is one of two problems, either:

* The build relies on an impurity of not being in the sandbox. This symptom
  makes no sense for that, but if this is your problem, use [breakpointHook]
  and [cntr] to enter the build environment.
* There is some inconsistency in the actual build process. If this is the case,
  we *believe*, in this case, that Make must be doing something different,
  since the `../src/socket_manager.c` target does not appear as being compiled
  in the successful build (it is only used in the link stage!).

  One way to verify this is to [manually run the build] and see if the
  behaviour still is occurring. I expect that in this case, it would have
  (extremely hilariously!) caused the bug to reproduce differently due to
  `dontAddDisableDepTrack` being automatically set in nix shells.


[manually run the build]: https://jade.fyi/blog/building-nix-derivations-manually/

[breakpointHook]: https://nixos.org/manual/nixpkgs/stable/#breakpointhook
[cntr]: https://github.com/Mic92/cntr

What I did was to run the failing `nix build` with `--keep-failed`, then looked
in `/tmp/nix-build-*` for the failed tree. From this failed tree I found I
could reproduce the failure again using `make`.

Let's figure out what differs between these directory trees. To do this, we can
use [diffoscope], an advanced diff tool that can compare directory structures
with nice structural diffs.

[diffoscope]: https://diffoscope.org/

We believe that it's an inconsistent Makefile, so let's dig through the output and
test that:

```
--- ./src/Makefile
+++ /tmp/nix-build-ios-webkit-debug-proxy-unstable-2023-09-23.drv-0/source/src/Makefile
+#include ./$(DEPDIR)/sha1.Plo # am--include-marker
+#include ./$(DEPDIR)/socket_manager.Plo # am--include-marker
+#include ./$(DEPDIR)/webinspector.Plo # am--include-marker
+#include ./$(DEPDIR)/websocket.Plo # am--include-marker
-include ./$(DEPDIR)/base64.Plo # am--include-marker
-include ./$(DEPDIR)/char_buffer.Plo # am--include-marker
-include ./$(DEPDIR)/device_listener.Plo # am--include-marker
```

Interesting, so the Makefile would have included some things in the successful
build that were not in the other build. For context, the way that autotools
works is:

* `Makefile.am` defines the rules to generate the `Makefile.in`, using
  `automake`.
* `Makefile.in` is templated to `Makefile` when `./configure` is run.

Autotools is a turducken of string templating on more string templating on more
string templating. String templates generate string templates which generate
new string templates which finally generate a Makefile.

In a distribution tarball, `autoconf` and `automake` were already run so
`configure` and `Makefile.in` will be included in the tarball.

If we look for where that probably came from in `src/Makefile.in`, we find:

```
@AMDEP_TRUE@@am__include@ @am__quote@./$(DEPDIR)/webinspector.Plo@am__quote@ # am--include-marker
@AMDEP_TRUE@@am__include@ @am__quote@./$(DEPDIR)/websocket.Plo@am__quote@ # am--include-marker
```

We also observe in `config.status`:

```
-AMDEPBACKSLASH='\'
-AMDEP_FALSE='#'
-AMDEP_TRUE=''
+AMDEPBACKSLASH=''
+AMDEP_FALSE=''
+AMDEP_TRUE='#'

...

-am_cv_CC_dependencies_compiler_type=gcc3
+am_cv_CC_dependencies_compiler_type=none

...

-am__fastdepCC_FALSE='#'
-am__fastdepCC_TRUE=''
+am__fastdepCC_FALSE=''
+am__fastdepCC_TRUE='#'
```

and in `config.log`:

```
 This file contains any messages produced by compilers while
 running configure, to aid debugging if configure makes a mistake.

 It was created by ios_webkit_debug_proxy configure 1.9.0, which was
 generated by GNU Autoconf 2.71.  Invocation command line was

-  $ ./configure
+  $ ./configure --disable-static --disable-dependency-tracking --prefix=/nix/store/19fsba4r1c0jwsqcdjs76y83ndah7vyh-ios-webkit-debug-proxy-unstable-2023-09-23

...

 configure:4539: checking dependency style of gcc
-configure:4651: result: gcc3
+configure:4651: result: none

...

 configure:13417: checking whether to build static libraries
-configure:13421: result: yes
+configure:13421: result: no
```

Well. It looks like the synthesis of all of this is that different configure
arguments were used, causing this. But why?!

As is often the case,
[`setup.sh`](https://github.com/nixos/nixpkgs/blob/d5139e30179237517e09174561b82bdacc1c2a03/pkgs/stdenv/generic/setup.sh#L1262-L1276)
is responsible:

```
$ rg -C3 -- --disable-dependency-track ~/dev/nixpkgs
/home/jade/dev/nixpkgs/pkgs/stdenv/generic/setup.sh
1260-    fi
1261-
1262-    if [[ -f "$configureScript" ]]; then
1263:        # Add --disable-dependency-tracking to speed up some builds.
1264-        if [ -z "${dontAddDisableDepTrack:-}" ]; then
1265-            if grep -q dependency-tracking "$configureScript"; then
1266:                prependToVar configureFlags --disable-dependency-tracking
1267-            fi
1268-        fi
1269-
```

and likewise for `--disable-static`, if `dontDisableStatic` is unset.

Indeed, changing the derivation to set both `dontAddDisableDepTrack` and
`dontDisableStatic` fixes the build.

This all took altogether far longer than it should have to derive a hypothesis
for why it was broken.
