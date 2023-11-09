+++
date = "2023-11-08"
draft = false
path = "/blog/debugging-ios-safari-from-linux"
tags = ["ios", "web"]
title = "Debugging iOS Safari from Linux"
+++

I was debugging an issue with a friend's website that was Safari-only, and a
pretty funny issue at that: autoplay videos won't play inside iframes, even if
the navigation of the iframe is caused by a user gesture. Turns out it's a
likely WebKit bug, but we needed to look at it to find that out.

Like most mobile browsers, Safari supports being debugged from a computer.
Unfortunately, Apple doesn't acknowledge the existence of computers not made by
them, so the official way of using Safari on a Mac is out.

There's a commercial service [inspect.dev] that provides this capability, but
they mysteriously require an account for fundamentally a local service, and I
don't do this nearly enough to pay them.

[inspect.dev]: https://inspect.dev/

Fortunately, WebKit contains the code to do it, you just have to poke it the
right way.

# Setup

Doing any kind of iOS work on Linux requires [`usbmuxd`][usbmuxd], which
sets up a pairing connection with the iOS device. NixOS has an option
`services.usbmuxd.enable`, which can simply be set to true. Otherwise,
`usbmuxd` probably exists in the repos.

Next, [ios-webkit-debug-proxy] is required. This is packaged as
`ios-webkit-debug-proxy` in nixpkgs, so install it or `nix shell` it.

[usbmuxd]: https://github.com/libimobiledevice/usbmuxd
[ios-webkit-debug-proxy]: https://github.com/google/ios-webkit-debug-proxy

# Verification

Ensure that `usbmuxd` is running with `systemctl status usbmuxd` and plug in
the iOS device. If it is unlocked, it should show a permission dialog to
accept.

If the connection works properly, `idevice_id -l` should give some output. If
not, check the `usbmuxd` logs, and/or kill `usbmuxd` and replug the device.
In my experience it is somewhat janky.

<aside>

`libimobiledevice` can also be very usefully used for pulling system logs off
of an iOS device using `idevicesyslog`, although do note that these probably
need to be postprocessed and filtered due to the sheer volume of logs Apple
devices output. An example use case for this is debugging AirPlay or other
Apple client implementations against custom servers.

Sometimes this requires the sensitive log content profile to be installed,
which is available from the [Apple site].

[Apple site]: https://developer.apple.com/bug-reporting/profiles-and-logs/

</aside>

# Debugging

In the past, there were several working debugging clients for
[ios-webkit-debug-proxy]; now the only really working one is WebKit, since
Chrome diverged and Mozilla abandoned [valence].

[valence]: https://github.com/mozilla/valence

I have used [ios-safari-remote-debug-kit], but it has some issues. Download it,
then in `src`, run `sh generate.sh` to download a WebKit inspector and patch
it, then *in theory* you would be able to just run the start script.

[ios-safari-remote-debug-kit]: https://github.com/HimbeersaftLP/ios-safari-remote-debug-kit

The `start.sh` script as of 77620eb0e has the wrong executable name for
`ios-webkit-debug-proxy`, so this patch is required:

```patch
diff --git a/src/start.sh b/src/start.sh
index e471b39..95a0bdd 100644
--- a/src/start.sh
+++ b/src/start.sh
@@ -15,7 +15,7 @@ if [ "$1" != "-noServer" ] && [ ! -d "WebKit" ]; then
   exit
 fi

-DEBUG_PROXY_EXE="ios-webkit-debug-proxy"
+DEBUG_PROXY_EXE="ios_webkit_debug_proxy"

 if [ "$1" != "-noServer" ]; then
   echo "Running ios-webkit-debug-proxy..."
```

Then, run `sh start.sh a` (an arbitrary argument is required due to a bug in
the script).

In Chromium, go to `http://localhost:9222/`, and find the index of the page to
debug. Then, in another tab, go to
`http://localhost:8080/Main.html?ws=localhost:9222/devtools/page/THE_INDEX`.

If everything works properly, this is the expected result:

{% image(name="working-screenshot.png", colocated=true) %}
screenshot of safari devtools running in chromium on about:blank
{% end %}

# Conclusion

All this software feels quite poorly maintained, and could definitely have some
serious UX polish to work better. It does work, and at least it's probably
going to keep working into the future. The commercial offering is possibly
worthwhile for heavier usage. One thing that's curious about that is that they
have done screencasting over USB, which definitely is possible e.g. with Zoom
on a Mac, but I don't think there are any open source implementations. This
would be useful research.

