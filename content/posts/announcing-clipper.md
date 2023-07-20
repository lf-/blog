+++
date = "2023-06-24"
draft = true
path = "/blog/announcing-clipper"
tags = ["clipper", "rust"]
title = "Announcing Clipper: TLS-transparent HTTP debugging for native apps"
+++

<!-- FIXME: wire_blahaj.jpg -->

Sometimes, I get jealous of web developers for having real network debugging
tools for watching HTTP traffic. Other times, I decide I can have nice things
too and spend a few weeks writing a tool.

A while ago I was debugging an issue with the Rust OpenTelemetry library and it
was immensely frustrated by not being able to get the actual requests out of
it. Eventually it yielded when I forked `h2` to add some logging that would be
exceptionally inadmissible in production. This is (probably) not the fault of
either rust-opentelemetry or the HTTP library that the observability system was
not observable, but it sure was frustrating.

Perhaps HTTP libraries should have a standard interface for dumping the raw
requests they perform, but this is going to be filtered through what the
library *thought* it did, rather than necessarily what it actually did. Plus,
there's hundreds of HTTP libraries, so the experience would be undoubtedly
quite variable.

What if there *was* one tool that was universal and could read any HTTP traffic
with no configuration, regardless of the app? What if debugging a modern native
app's HTTP traffic (HTTP3 coming soon) could be (almost) as easy as opening dev
tools in a browser?

If only modern computers had a [Clipper chip] and you happened to be the NSA so
you could just decrypt everything. Thankfully that is not the case. I suppose
the next best thing is to have code execution, a binary patching library, and
insufficient fear of `LD_PRELOAD`.

[Clipper chip]: https://en.wikipedia.org/wiki/Clipper_chip

# What is this thing?

Clipper is a suite of tools for doing TLS-transparent HTTP interception. It
supports:
* Unprivileged packet capture that also catches keys, storing to PCAPNG files.
* Attaching Chrome DevTools to unmodified native processes and viewing HTTP
  activity.
* Viewing PCAPNG files in Chrome DevTools.
* Extracting keys from unmodified applications.

## Wire shark doo doo doo doo doo doo

<!-- FIXME: tls added and removed here slide -->

But it's encrypted! Sadly, "TLS added and removed here" is an architecture of
the past, and for good reason. However, what if we had the session keys and
decrypted the TLS so we could read it?

<!-- FIXME: link -->
It turns out that Wireshark can actually do this, if you have the keys already.
However, getting the keys is the hard part.

<!-- FIXME: link to SSLKEYLOGFILE spec -->
Also, it turns out that we *did* collectively standardize getting the keys out
of TLS, and practically every TLS implementation implements it. Specifically,
there is a standard format called `SSLKEYLOGFILE`, originally implemented in
Mozilla NSS, for logging the decryption keys from TLS libraries.

Cool, so we're done? Well, as much as it is implemented in the TLS libraries,
code changes to client code are required to actually use it. This is probably
for good reason, since it does break TLS:

- `curl` gates it behind a compile flag that is off by default. Not sure about
  libcurl.
- NSS gates it behind a compile flag which is off by default.
- Firefox only enables the NSS flag on nightly or other dev builds.
- rustls requires you set a special field on the ClientSettings and
  ServerSettings structures, which downstream users do not do by default.
- Go `crypto/tls` requires a similar method to rustls.
- OpenSSL requires you call `SSL_CTX_set_keylog_callback` when initializing it.
- Chromium implements the `SSLKEYLOGFILE` environment variable by default, yay.

  <!-- FIXME: link -->

  Alarmingly, there is a bug report of this feature being abused by antivirus
  vendors to do TLS decryption, leading the Chromium developers to remove the
  "your traffic is being intercepted" banner. So perhaps everyone else removing
  it was a good idea.

## Fiddler2, OWASP ZAP, mitmproxy

These are all fine tools and perhaps better suited to this use case. However,
in order to use any of these proxies, one needs to execute an actual
woman-in-the-middle attack, which has Consequences:

- Proxy support is required
- Support for adding trusted CAs is required
- Key pinning must be disabled
- It's *possible* that certain HTTP library compatibility bugs may be concealed
  by virtue of the proxy decoding and reencoding the data.

I would like to look at the *actual* traffic and not put anything relevant in
the data plane to the greatest extent possible.

# What the hell crimes did you do to achieve *that*, jade

Glad you asked. Numerous!

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
to anything from a new network namespace and *host* root would be required to
attach virtual interfaces to the host network stack. Fortunately, again, the
missing pieces were built for rootless containers: `slirp4netns` is a userspace
NAT daemon that NATs a network namespace onto the host network, creating a
`tap` interface with internet access inside the namespace.

As for getting the keys, either you can patch the binary at compile time
(boring, may require patching dependencies), or you can patch the binary at
runtime (fun, indistinguishable from malware behaviour). Since I want a magical
user experience, runtime patching it is.

<!-- FIXME: link -->
Some absolute sickos at [mirrord] made a system which allows a local process on
a developer computer to interact with the network as if it is on another
machine in a staging environment. This was achieved by using the excellent
[Frida] GUM Rust bindings, which allow hooking arbitrary code in executables,
along with `LD_PRELOAD` to get their code running inside processes.

[Frida]: https://frida.re

Clipper also uses Frida GUM. The actual patches to extract keys aren't much:
- In OpenSSL, hook `SSL_new` to first call `SSL_CTX_set_keylog_callback` on the
  passed in context.
- In rustls, they use vtable dispatch over a field set in the client/server
  settings structure. This seems like a pain in the ass, so we instead hook the
  no-op key log functions to not be no-ops.
- In Go `crypto/tls` they use a similar mechanism to rustls and we do the same
  thing.

Once we have the keys, we can add universal `SSLKEYLOGFILE` support, or send
the keys over a socket to the capturing Clipper instance. Both of these are
implemented.

