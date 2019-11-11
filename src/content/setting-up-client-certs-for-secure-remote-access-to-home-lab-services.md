+++
author = "lf"
categories = ["homelab", "nginx", "tls"]
date = 2016-10-13T06:27:13Z
description = ""
draft = false
path = "/blog/setting-up-client-certs-for-secure-remote-access-to-home-lab-services"
tags = ["homelab", "nginx", "tls"]
title = "Setting up client certs for secure remote access to home lab services"

+++

Because I have some masochistic tendencies at times, I decided that it was a *totally good idea*™ to set up client certificate authentication to secure remote access to my lab services such as Grafana or Guacamole.

Unsurprisingly, since it's a rather uncommonly used finicky authentication method, there were problems. There were quite a few.

I'm writing this post mostly just for myself if I ever do this again, because it felt like it took too long to accomplish.

First, the list of requirements:

* Should allow access without certs on the local network

* Should use nginx

The latter was pretty easy, since I'm most familiar with nginx, however the former was rather interesting. I realized that, to implement this, I need to set verification as optional, then enforce it manually. This meant modifying the back ends (meaning maintaining patches, nope!) or doing it within nginx.

One issue is that nginx has if statements that are rather strange, presumably due to simplistic grammar while parsing the configuration. There is no way to do an and statement without hacks. The hack that I chose to use was some variable concatenation (which cannot be done in a single line on the if statement, it must be in its own separate if statement). Here's how I enforce certs from non-LAN hosts:

    if ( $ssl_client_verify != "SUCCESS" ) {
        set $clientfail "F";
    }
    if ( $client_loc = "OUT" ) {
        set $clientfail "${clientfail}F";
    }
    if ( $clientfail = "FF" ) {
        return 401;
    }

`$client_loc` is defined in a geo block:

    geo $client_loc {
        default OUT;
        10.10.0.0/16 IN;
        10.11.0.0/16 IN;
    }

But defining `ssl_client_certificate` and setting up the clients would be too easy. In setting this up, I learned that nginx has an error message: "The SSL certificate error". Yes. That's an error message. It's so bad that it could be written by Microsoft. Fortunately, it's very simple to just write an `error_log logs/debug.log debug` and get some slightly less cryptic details.

The big thing that tripped me up with the server setup was that `ssl_verify_depth` is set by default such that with a Root→Intermediate→Client hierarchy, clients fail to be verified. Set it to something like 3 and it will work.

Next, for the certificate setup:

The server directive `ssl_client_certificate` needs to point to a chain certificate file, or else it will fail with an error that suggests problems with the server certificate (thankfully).

The clients (for now, Chrome on Linux), need a pkcs12 file with some chain like stuff in it. Generate one with something like:

    openssl pkcs12 -in client-chain.cert.pem -out client.pfx -inkey client.key.pem -export

where `client-chain.cert.pem` is a full chain from client to root CA and `client.key.pem` is a key file.

The other issue with the clients was that they didn't trust my CA that was imported as part of the pfx file to authenticate servers. This was quickly solved with a trip to the CA tab in the Chrome cert settings.

The client certs used in this were from my CA and have the Client Authentication property enabled.

