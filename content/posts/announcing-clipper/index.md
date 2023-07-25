+++
date = "2023-07-23"
draft = false
path = "/blog/announcing-clipper"
tags = ["clipper", "rust", "debugging"]
title = "Announcing Clipper: TLS-transparent HTTP debugging for native apps"
+++

{% image(name="wire_blahaj.jpg", colocated=true) %}
little blahaj wrapped in ethernet cable
{% end %}

Sometimes I get jealous of web developers for having real network debugging
tools for watching HTTP traffic, as (primarily) a native developer. Not
anymore: I have their tools now. [You can have them too.][repo]

[repo]: https://github.com/lf-/clipper

A while ago I was debugging an issue with the Rust OpenTelemetry library on my
computer and it was immensely frustrated by not being able to get the actual
requests out of it. Eventually it yielded when I forked `h2` to log the headers
and determined that there was a missing header. I wish I could just get the
requests out at the network level.

Perhaps HTTP libraries should have a standard interface for dumping the raw
requests they perform, but this is going to be filtered through what the
library *thought* it did, rather than necessarily what it actually did. Plus,
there's hundreds of HTTP libraries, so the experience would be undoubtedly
quite variable.

What if there *was* one tool that was universal and could read any HTTP traffic
with no configuration, for almost all apps? What if debugging a modern native
app's HTTP traffic could be (almost) as easy as opening dev tools in a browser?

I picked up the hammer and [built one][repo]. Here's a shell attached to Chrome
Dev Tools, showing `curl` requests live:

<div class="image">
<video controls alt="video of clipper showing curl requests in chrome devtools to the side">
<source src="./chrome-devtools-live.webm">
<source src="./chrome-devtools-live.mp4">
</video>
</div>

# What is this thing?

Clipper is a suite of tools for doing TLS-transparent HTTP interception. It
supports:
* Unprivileged packet capture that also catches keys, storing to PCAPNG files.

  `clipper capture -o nya.pcapng some-command`
* Attaching Chrome DevTools to unmodified native processes and viewing HTTP
  activity.

  `clipper capture-devtools some-command`
* Viewing PCAPNG files in Chrome DevTools.

  `clipper devtools-server nya.pcapng`
* Extracting keys from unmodified applications.

  `LD_PRELOAD=./libclipper_inject.so SSLKEYLOGFILE=keys.log some-command`

## Wire shark doo doo doo doo doo doo ?

{% image(name="ssl-added-and-removed-here.png", colocated=true) %}
Notorious NSA PRISM slide titled "Current Efforts - Google", showing Google
Front End stripping off TLS before sending cleartext into Google datacenters.
{% end %}

If only modern computers had a [Clipper chip] and you happened to be the NSA so
you could just decrypt everything. Thankfully that is not the case. I suppose
the next best thing is to have containers, a binary patching library, and
insufficient fear of `LD_PRELOAD`.

Sadly, "TLS added and removed here" is an architecture of
the past, and for good reason. However, what if we had the session keys and
decrypted the TLS so we could read it?

[Clipper chip]: https://en.wikipedia.org/wiki/Clipper_chip

It turns out that Wireshark [can actually decrypt TLS][wireshark-tls], if you have
the keys already. However, getting the keys is the hard part.

[wireshark-tls]: https://wiki.wireshark.org/TLS

## Keeping your keys from you, for your safety

Also, it turns out that we *did* collectively standardize getting the keys out
of TLS, and practically every TLS implementation implements it. Specifically,
there is a [standard format called `SSLKEYLOGFILE`][sslkeylogfile-spec],
originally implemented in Mozilla NSS, for logging the decryption keys from TLS
libraries.

[sslkeylogfile-spec]: https://www.ietf.org/archive/id/draft-thomson-tls-keylogfile-00.html

Cool, so we're done? Well, as much as it is implemented in the TLS libraries,
code changes to client code are required to actually use it. This is probably
for good reason, since it does break TLS:

- `curl` gates it behind a compile flag that is off by default. Not sure about
  libcurl.
- NSS gates the `SSLKEYLOGFILE` environment variable behind a compile flag
  which is off by default.
- Firefox only enables that NSS flag on nightly or other dev builds.
- rustls requires you set a special field on the ClientSettings and
  ServerSettings structures, which downstream users do not do by default.
- Go `crypto/tls` requires a similar method to rustls.
- OpenSSL requires you call `SSL_CTX_set_keylog_callback` when initializing it.
- Chromium implements the `SSLKEYLOGFILE` environment variable by default, yay.

  Alarmingly, [there is a bug report of this feature being
  abused][no-good-deed-goes-unpunished] by antivirus
  vendors to do TLS decryption, leading the Chromium developers to remove the
  "dangerous environment variable" banner. So perhaps everyone else removing
  support was a good idea.

[no-good-deed-goes-unpunished]: https://crbug.com/991290

## "Good luck, I'm behind 7 proxies"

There's a bunch of nice tools such as Fiddler2, OWASP ZAP, mitmproxy, that can
proxy HTTPS, and they can decrypt the traffic by impersonating the site being
connected to and taking the traffic.

However, in order to use any of these proxies, one needs to execute an active
woman-in-the-middle attack, which has Consequences:

- Proxy support is required
- Support for adding trusted CAs is required
- Key pinning must be disabled
- It's *possible* that certain HTTP library compatibility bugs may be concealed
  by virtue of the proxy decoding and re-encoding the data.

I would like to look at the *actual* traffic and not put anything relevant in
the data plane to the greatest extent possible.

# Plucking requests from ~~thin air~~ raw traffic

Alternate title: what the hell crimes did you do to achieve that, jade?

Glad you asked. Numerous!

## Capture

Let's start at capturing packets. Normally this requires having high privilege
on Linux in order to be able to bind a `AF_PACKET` socket to capture packets.
However, `CAP_NET_RAW` privilege is in the eye of the beholder. Thanks to the
technologies used by unprivileged containers, this is possible and fairly easy.

Specifically, by entering a new user namespace and network namespace, Clipper
jails processes away from the host network onto a virtual network over which it
has root due to the user namespace. Then it can open a `AF_PACKET` socket and
send a handle out of the namespace to the host process over a `unix(7)` socket
and capture everything going on in the namespace.

However, that's not sufficient, since the inner process cannot actually connect
to anything if it is in a newly created network namespace, and *host* root is
required to attach virtual interfaces to the host network stack. Fortunately,
the missing pieces were built for rootless containers: `slirp4netns` is a
userspace NAT daemon that creates a `tap` interface inside the container, and
brokers access to the outer system's network.

## Keys

As for getting the keys, either you can patch the binary at compile time
(boring, may require patching dependencies), or you can patch the binary at
runtime (fun, indistinguishable from malware behaviour). Since I want a magical
user experience, runtime patching it is.

Some absolute sickos at [mirrord] made a system which allows a local process on
a developer computer to interact with the network as if it is on another
machine in a staging environment. This was achieved by writing a `LD_PRELOAD`
library that uses the excellent [Frida] GUM Rust bindings which allow hooking
arbitrary code in executables by patching functions to insert a trampoline to a
wrapper function.

[Frida]: https://frida.re
[mirrord]: https://metalbear.co/blog/mirrord-internals-hooking-libc-functions-in-rust-and-fixing-bugs/

Clipper also uses Frida GUM. The actual patches to extract keys aren't much:
- In OpenSSL, hook `SSL_new` to first call `SSL_CTX_set_keylog_callback` on the
  passed in context.
- In rustls, they use vtable dispatch over a field set in the client/server
  settings structure. This seems like a pain in the ass, so we instead hook the
  no-op key log functions to not be no-ops.
- In Go `crypto/tls` they use a similar mechanism to rustls and we can probably
  do the same thing to rustls.

Once we have the keys, we add universal `SSLKEYLOGFILE` support to programs as
well as allowing sending the keys over a socket to the capturing Clipper instance.

## Decoding

Clipper contains a homegrown network decoding stack, since it gets raw bytes
and keys but needs to get application level information out.

It implements (some of):
- Ethernet
- IPv4 and IPv6
- TCP
- TLS
- HTTP/1.1 and HTTP/2

Our TCP implementation reorders segments back into order before running them
through a somewhat weird TCP state machine (somewhat of a theme in
`net_decode`) that takes both roles in the conversation. It takes packets and
identifies them based on 4-tuple (source IP, dest IP, source port, dest port)
and whether they are to the client or server, before sending them onto the
`Listener` system.

The central abstraction of `net_decode` is a `Listener`, accepting data (of
some type) and sideband data and possibly sending new data along to the next
layer. Data can be bytes or more complex data such as HTTP flow events.
Sideband data is used for data such as newly received TLS keys and [ALPN]
negotiation information.

[ALPN]: https://datatracker.ietf.org/doc/html/rfc7301

The typical layer following TCP decoding is a dispatcher that sends traffic to
different downstream `Listener`s depending on its server port (we may in the
future add a stateful packet inspector to this that does protocol sniffing to
also catch traffic on non-standard ports). After that, protocol decoders,
currently an HTTP decoder on 80 and a TLS decoder feeding into an HTTP
decoder on 443.

The HTTP decoder receives sideband [ALPN] data from the TLS decoder to
set itself in HTTP/2 mode if that's negotiated.

A join connector is then used to join the streams of unencrypted HTTP and
encrypted HTTP into one HTTP connection events stream, which is then either
used for serving Chrome DevTools Protocol or for integration testing
`net_decode`.

The actual implementation of the TLS decoder is based on a forked `rustls`,
from which the deframing is used, but the higher level protocol handling is
rewritten to deal with being a non-speaking listener. The TLS system buffers
input while waiting for missing keys, then retries decryption once such keys
appear.

HTTP is based on `httparse` and a custom state machine for HTTP/1 and a forked
`h2` for HTTP/2. The latter is, as with `rustls`, forked and split down the
middle: the low level protocol decoding is reused, but the state machine has to
be rewritten for the non-speaking listener role.

### Aside: testing

My thinking on testing has been greatly [influenced by
rust-analyzer][ra-testing]: tests are each very simple and reuse the same
fixture and snapshot the result. Most of the testing of `net_decode`, for
example, is running a corpus of `pcapng` files through various parsers and
snapshot testing the result. This methodology makes testing much less
individually annoying and makes it a lot more likely that it actually gets
done, which is the real threat to testing.

[ra-testing]: https://matklad.github.io/2021/05/31/how-to-test.html

Not that Clipper is a shining example of great testing, it's missing a lot of
integration tests of the capture capabilities in particular, which is for
several reasons including that starting captures should not be done from
multi-threaded processes due to async signal safety (since memory is allocated
before the child calls `execve`), as well as there just being a lot of fixturing
to do.

## Chrome DevTools

Chrome DevTools speaks JSON over WebSockets to the "browser" and has a [specified
protocol][cdp]. Some folks [wrote a Rust library][chromiumoxide-cdp] with
generated types for the protocol based on the interface definitions from the
Chrome team.

The interesting part of Clipper doing this is that it is uncommonly acting as a
DevTools Protocol server, which chromiumoxide, the library it uses for the type
definitions, is not designed for, so that goes on the fork list too, but in a
much more minor way than `h2` or `rustls`. The DevTools server is custom,
accepting HTTP events from the interception system via a `Listener`
implementation and converting them to appropriate DevTools protocol events for
network requests.

[cdp]: https://chromedevtools.github.io/devtools-protocol/
[chromiumoxide-cdp]: https://docs.rs/chromiumoxide_cdp/latest/chromiumoxide_cdp/

# Conclusion

I hope that Clipper is a useful tool in your toolbox; I look forward to using
it for my own debugging. This is probably the largest project I have ever taken
on alone, and it has been really nice to work on quietly over the past few
months.

Be aware that this is a single person project when filing bugs or submitting
code :)

Packaging has not yet been done, but will be done soon enough.

You can see the documentation of how to use it [on the repo][repo].

## Thanks

- [puck] for helping me fix various hard to debug Linux and Rust issues as well
  as encouraging me to just write my own implementations of things
- [edef] for getting mad at https debugging with me

[puck]: https://twitter.com/puckipedia
[edef]: https://twitter.com/edefic
