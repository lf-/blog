# Nix

A very nice package management system with some confusing command syntax.

## Investigate a derivation

[nix-diff](https://github.com/Gabriel439/nix-diff) can be used to find why
derivations are different.

```
nix-diff /nix/store/...-a.drv /nix/store/...-b.drv
```

Find the derivation for a given nix store path:

```
nix-store -q --deriver /nix/store/...-name-0.0.0
```

Dump a derivation as JSON:

```
nix show-derivation /nix/store/...-a.drv
```

Find why a derivation has a dependency:

```
nix why-depends -a -f default.nix 'attrnameHere' 'theDepAttrName'
```

