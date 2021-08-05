+++
date = "2021-06-09"
draft = false
path = "/blog/tpm-ssh"
tags = ["tpm", "linux"]
title = "Using a TPM 2.0 to secure ssh keys"
+++

A while ago I [read a tweet][bullying tweet] that reminded me I felt guilty
about the state of my ssh key security and wanted to do something about it,
eventually. Well, my watch reads "eventually", so let's do it.

My workstation is a modern AMD system, which has a firmware based TPM 2.0
implementation available "for free", which sounded pretty nice, so let's use
it.

This guide is partially [sourced from this docs page][ssh.md].

Required packages:

### Arch Linux names

* `tpm2-tools`
* `tpm2-tss`
* `tpm2-pkcs11`
* `tpm2-abrmd`

### Ubuntu names (21.04+)

* `tpm2-tools`
* `tpm2-abrmd`
* `libtpm2-pkcs11-tools`
* `libtpm2-pkcs11-1`

---

Before doing anything with this, reboot into BIOS and enable (if needed) and
clear the TPM. Mine at least had decided that someone was dictionary attacking
it. Not sure how it got that idea, but clearing it reset that flag.

Boot back into your system and enable and start `tpm2-abrmd.service`. This
provides a D-Bus interface that applications can talk to for access to the tpm.

You also need to be in the `tss` group for the tpm stuff to initialize:

```
sudo usermod -a -G tss $USER
```

Groups are only updated when you log in, so either logout and log back in
again, or do `su - $USER` to create a new login shell

---

Next, provision tss2/fapi (no I don't know what this is either. it complains on
every usage that fapi is uninitialized if you don't, even though it is unused
per the docs):

Try doing `tss2_provision`. This might fail with something to do with key size.
If that happens, you'll have to set `"profile_name": "P_RSA2048SHA256",` in
`/etc/tpm2-tss/fapi-config.json` from its default of some ECC.

There may also be complaints about EK certificates being unknown or similar,
which I have failed to figure out how to deal with properly, but you can at
least suppress the error by setting `"ek_cert_less": "yes"` in the same file.

---

Once you have the fapi set up, you can follow the [ssh configuration
guide][ssh.md], which I will summarize with real invocations.

```
# initialize pkcs11 store in ~/.tpm2_pkcs11
tpm2_ptool init

# NOTE: the following two commands have secrets in them. consider prefixing
# them with a space in order to avoid them getting into a history file

# add a token. the `userpin` here is the one you type in to log into stuff
# the sopin is the supervisor pin, which is a backup pin. you can stuff that
# into a password manager or write it down or something.
tpm2_ptool addtoken --pid 1 --label sshtok --sopin [SUPERVISOR PIN] \
    --userpin [USER PIN]
```

From here, there are two pathways: you can generate the key on the TPM and have
it never leave (which is cool and good except when it gets wiped by being
looked at funny/a BIOS update), *or*, you can generate it and then import it,
retaining a backup offline.

I did the former and then did a BIOS update and lost my key. It was extremely
funny because it was very expected. If you want to do that, this is how:

```
# add a key on that token. the key label will show up next to the key when you
# pull it out using ssh-keygen. see notes below for why it's rsa2048/ecc256
# suggested despite others being supported.
tpm2_ptool addkey --algorithm [rsa2048 or ecc256] --label sshtok \
    --key-label [KEY LABEL] --userpin [USER PIN]
```

If you want to generate a key and import it instead (note that obviously the
actual key material *did* touch your system. threat model, etc):

```
# make a working dir
umask 077 && mkdir /tmp/crypto && cd /tmp/crypto

# generate an ssh key. put a passphrase on this.
# you could also use ecdsa or something else assuming the tpm supports it.
ssh-keygen -t rsa -b 2048 -f tpm_rsa

# go back it up somewhere offline

# now, decrypt the one here into a format the tpm tools understand
# indeed, set the password to nothing
ssh-keygen -f tpm_rsa -mPEM -ep

# import it into the tpm
tpm2_ptool import --label sshtok --key-label my-ssh-key --userpin [USER PIN] \
    --privkey /tmp/crypto/tpm_rsa --algorithm rsa

# important! destroy the cleartext key
shred -zu tpm_rsa
rm -rf /tmp/crypto
```

After doing either of these, you're in the same place and can proceed.

```
# Use this if you're on Arch Linux
TPM2_PKCS11_SO=/usr/lib/pkcs11/libtpm2_pkcs11.so

# Use this if you're on Ubuntu
# note: $(gcc -dumpmachine) returns something like x86_64-linux-gnu
TPM2_PKCS11_SO=/usr/lib/$(gcc -dumpmachine)/libtpm2_pkcs11.so.1

# pull out the public keys to stdout. idk put them somewhere i guess. you can
# do this again later, it will give you the same output
ssh-keygen -D $TPM2_PKCS11_SO

# if you want, you can use ssh-agent to remember your PIN for this session
pgrep -u $UID ssh-agent || eval `ssh-agent`
ssh-add -s $TPM2_PKCS11_SO

# add your ssh key to some remote hosts' authorized_keys

# add the pkcs11 module to ssh_config on your client
cat <(echo "PKCS11Provider $TPM2_PKCS11_SO") ~/.ssh/config \
    | tee ~/.ssh/config

# try it!!!
ssh yourhost
```

Some notes:

On my system, `rsa2048` and `ecc256` seem to work as algorithms. Notably,
`ecc384` does not work when you actually try to log into a computer with it:

```
WARNING:esys:src/tss2-esys/api/Esys_Sign.c:311:Esys_Sign_Finish() Received TPM Error
ERROR:esys:src/tss2-esys/api/Esys_Sign.c:105:Esys_Sign() Esys Finish ErrorCode (0x000001d5)
ERROR: Esys_Sign: tpm:parameter(1):structure is the wrong size
```

---


If you want to grab all the repos, here's the invocation I used to clone all of
them for `rg`'ing:

```
gh repo list --json nameWithOwner \
    --template '{{range .}}{{.nameWithOwner}}{{"\n"}}{{end}}' tpm2-software \
    | xargs -i -- git clone 'https://github.com/{}'
```

If you're having an unfortunate day and are running into a suspected bug, there
are `-git` versions of all of these on the AUR, which you can build with
symbols.

---

Error messages with the TPM stuff are not extremely googleable. If you want
help, check out the [gitter for the tpm2-software tools][gitter], and perhaps
the source code.

---

Thanks to [Rain](https://twitter.com/sunshowers6) for their feedback on this post.

[ssh.md]: https://github.com/tpm2-software/tpm2-pkcs11/blob/master/docs/SSH.md
[bullying tweet]: https://twitter.com/a_hoverbear/status/1394475693413568514
[gitter]: https://gitter.im/tpm2-software/community
