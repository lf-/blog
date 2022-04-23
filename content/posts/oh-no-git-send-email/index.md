+++
date = "2022-04-22"
draft = false
path = "/blog/oh-no-git-send-email"
tags = ["git", "tools"]
title = "Oh no, `git send-email`"
+++

Say you have to contribute to some boomer project that doesn't believe in
GitHub or GitLab or Gitea or <...> which would allow for just pushing some
changes and filing a pull request. Instead, they want an *email*. Gross.

For those who are unfamiliar with the email-patch infrastructure, git is
*extremely* picky about emails being the exact format it likes and not getting
modified at all by the client. This means that in practice, you need to send
your patch emails using `git send-email` as your email client.

The patch-emailing features of git are some of its most infamous for poor
usability, which is saying something, because git as a whole is known for being
hard to use.

Theoretically, <https://git-send-email.io/> (by someone who made their own git
source hosting service that strangely uses emails to submit patches) will tell
you how to set it up. Well, except if `git send-email` has other ideas: it
would not send through my email provider for reasons that must have been a bug:
I seem to recall it was something to do with either a TLS or SMTP
implementation being broken.

I ended up needing to use a separate *Mail Transfer Agent* (SMTP-speak for
"SMTP client") and plumb it into git. For this, I used `msmtp`.

First, store your SMTP email password in the system keyring:

```
# on KDE
$ kwallet-query -w user@example.com kdewallet -f mail

# on GNOME/other things supporting freedesktop secrets
$ secret-tool store --label=msmtp host smtp.migadu.com service smtp user myuser@example.com

# on macOS
$ security add-internet-password -s smtp.migadu.com -r smtp -a myuser@example.com -w
```

I use KDE, so this setup uses the KDE wallet to store the password. If you use
macOS, GNOME or the future version of KDE that supports the freedesktop secrets
system, **remove the `passwordeval` line from the sample config here** as
`msmtp` can get the password from your keyring by itself.

Then write a `msmtp` configuration file:

{% codesample(desc="`~/.msmtprc`") %}
# Used to identify which account you are using in the msmtp command line
account myaccountname

# Tunneled-TLS email configuration. Probably correct for most modern servers,
# but check your email provider documentation. This is correct for migadu.

host smtp.migadu.com
port 465
tls on
tls_starttls off
auth on
user user@example.com

# From address on the envelope. Probably your email, but not necessarily
# (note that this is distinct from the "from" address in the message body that
# will be shown to recipients. it needs to match the address subscribed to the
# mailing list)
from listsubscriber@example.com

# Use kwallet-query to get the password because kwallet does not support the
# freedesktop secrets protocol
# NOTE!! If you are on macOS or GNOME or the future version of KDE that
# supports freedesktop secrets, delete the following line!
passwordeval kwallet-query -r user@example.com kdewallet -f mail
{% end %}

Then configure git (I keep this in `~/.gitconfig` as I don't really want to
check it in for spam reasons, whereas most of my git config is checked in and
stored at `~/.config/git/config`):

{% codesample(desc="`~/.gitconfig`") %}
[sendemail]
    sendmailcmd = /usr/bin/msmtp
    smtpserveroption = -a
    smtpserveroption = myaccountname
    confirm = always

    # don't send yourself emails
    suppresscc = self
{% end %}

Finally, you can send an email:

```
/tmp/nya » git init
Initialized empty Git repository in /tmp/nya/.git/

/tmp/nya - [main] » echo nyaa > README.md
/tmp/nya - [main●] » git add -A
/tmp/nya - [main●] » git commit -m 'initial commit'
[main (root-commit) 5e2e44d] initial commit
 1 file changed, 1 insertion(+)
 create mode 100644 README.md

/tmp/nya - [main] » echo nyaaaaaaaaaaaaaaaaaaaaa >> README.md

/tmp/nya - [main●] » git commit -am 'more nya'
[main 3df1f2d] more nya
 1 file changed, 1 insertion(+)

# NOTE: you probably want to use --compose to write a message to include with
# your patch. You can also use --dry-run to do a dry run.
/tmp/nya - [main] » git send-email --to='somepoorsoul@example.com' --from=message-from@example.com HEAD^

/tmp/jade/jKCO7nnORw/0001-more-nya.patch
(mbox) Adding cc: Jade Lovelace <commitauthor@example.com> from line 'From: Jade Lovelace <commitauthor@example.com>'

From: message-from@example.com
To: somepoorsoul@example.com
Cc: Jade Lovelace <commitauthor@example.com>
Subject: [PATCH] more nya
Date: Fri, 22 Apr 2022 20:45:30 -0700
Message-Id: <20220423034529.3057172-1-message-from@example.com>
X-Mailer: git-send-email 2.35.2
MIME-Version: 1.0
Content-Transfer-Encoding: 8bit

Send this email? ([y]es|[n]o|[e]dit|[q]uit|[a]ll): y
OK. Log says:
Sendmail: /usr/bin/msmtp -a message-from@example.com -i somepoorsoul@example.com commitauthor@example.com
From: message-from@example.com
To: somepoorsoul@example.com
Cc: Jade Lovelace <commitauthor@example.com>
Subject: [PATCH] more nya
Date: Fri, 22 Apr 2022 20:45:30 -0700
Message-Id: <20220423034529.3057172-1-message-from@example.com>
X-Mailer: git-send-email 2.35.2
MIME-Version: 1.0
Content-Transfer-Encoding: 8bit

Result: OK
```

And, yes, it was received:

{% image(name="received.png", colocated=true) %}
Screenshot of the email sent by git in an email client.

It shows the patch as you'd see with the output of format-patch.
{% end %}

See? That was ~~sooooo easy~~ very hard for no reason.
