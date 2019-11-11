+++
author = "lf"
categories = ["nftables", "linux"]
date = 2016-03-07T00:33:40Z
description = ""
draft = false
path = "/blog/nftables-redirect-not-working-fix"
tags = ["nftables", "linux"]
title = "nftables: redirect not working + fix"

+++

Recently, I made the somewhat-rash decision to switch to nftables from ufw-managed iptables on this VPS.

It's been a fun ride. The man page doesn't even document the redirect feature. It doesn't even acknowledge its existence, nor what it really does.

That's irrelevant however, because it does the same thing as the `REDIRECT` target in iptables, documented in the `iptables-extensions` man page. This allows the functionality of redirect in nftables to be inferred as "change destination address to localhost, and change the destination port to the one specified after `to`".

I, however, was a bit too dense to go looking through there and didn't read the wiki too well about redirection. I figured "hey, just need to put redirect at the start of the chain hooked into nat prerouting to enable it, then add a rule specifically redirecting the port". Later, I wondered why it wasn't working. After some tcpdump, copious quantities of counters *everywhere*, and netcat instances, I figured that out.

Note that you need to allow the packets with `dport 11113` in your filter. Your filter table will *never* see any packets on port 113 unless something has gone horribly wrong, as all of them will have `dport` changed to 11113 in the `nat` table. If, for some reason, you want to drop these, you probably can do it in a chain with `type mangle hook prerouting priority 0`, but I have no idea why you would want to do that.

Here's the functional config:

    table ip nat {
      chain prerouting {
        type nat hook prerouting priority 0;
        tcp dport 113 counter redirect to 11113
      }

      chain postrouting {
        type nat hook postrouting priority 0;
      }
    }

    table ip6 nat {
      chain prerouting {
        type nat hook prerouting priority 0;
        tcp dport 113 counter redirect to 11113
      }

      chain postrouting {
        type nat hook postrouting priority 0;
      }
    }

