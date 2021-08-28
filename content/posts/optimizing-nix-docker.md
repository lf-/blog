+++
date = "2021-08-19"
draft = false
path = "/blog/optimizing-nix-docker"
tags = ["nix", "docker"]
title = "Optimizing Nix Docker images"
+++

nixpkgs has good built in support for building Docker images, but there is a
*significant* amount of nuance to using it effectively and making small images.

It is very easy to accidentally put more stuff in than you want, and this post
will document how to Not Do That. A useful companion to this post is the source
code to the nixpkgs Docker module, at [`pkgs/build-support/docker/default.nix`].

The way that Docker images are produced in nixpkgs is that they are built from
scratch using standard tools. They may include Nix store paths or not, and they
may also have certain derivations copied to the root of the filesystem as
specified in `contents`. Only Nix store paths that are in the files in the
image will be in the output.

[`pkgs/build-support/docker/default.nix`]: https://github.com/nixos/nixpkgs/blob/05fe22074652500ce257af4d12d1131dad412c3c/pkgs/build-support/docker/default.nix#L558

## A normal Docker image script

This is a sample Nix script for a Docker image, cleaned up from the
Carnap sources, with some comments about things to watch out for.

```nix
{ }:
  let inherit (import ./default.nix {}) app nixpkgs;

      dockerEntrypoint = nixpkgs.writeScriptBin "entrypoint.sh" ''
        #!${nixpkgs.runtimeShell}
        exec ${app.out}/bin/myapp
      '';
  in nixpkgs.dockerTools.buildImage {
    name = "MyServer";
    tag = "latest";

    # everything in this is *copied* to the root of the image
    contents = [
      dockerEntrypoint
      nixpkgs.coreutils
      nixpkgs.runtimeShellPackage
    ];

    # run unprivileged with the current directory as the root of the image
    extraCommands = ''
      #!${nixpkgs.runtimeShell}
      mkdir -p data
    '';

    # Docker settings
    config = {
      Cmd = [ "entrypoint.sh" ];
      WorkingDir = "/data";
      ExposedPorts = {
        "3000" = {};
      };
      Volumes = {
        "/data" = {};
      };
    }
  }
```

## Looking for problems

### Look at the image with `dive`

There is a nice tool called [`dive`] for investigating the size of Docker
images.

To use it, import the Docker image to your daemon with `docker image load -i
./result`, then use [`dive`] to look at it by running `dive your-image-name`.

### Extract it and poke at it the usual way

Since Nix-built images are often a single layer, `dive` may be more fancy than
necessary, and it may be more convenient to just extract the image with `tar`
and poke at it with `du`, `ncdu`, etc.

[`dive`]: https://github.com/wagoodman/dive

## Mistakes

I had a 300MB Docker image that decompressed to 1GB or so. This presented
significant deployment headaches due to the sheer time to deal with this. This
is admittedly partially the size of the Haskell binaries in it, but it is not
the only factor in this.

### Putting files in `contents` that should not be

Nix does not work the same way with dependencies as other systems: you can
refer to dependencies that are not explicitly declared and it will figure it
out. In a normal derivation, you can put something like `${pkgs.bash}/bin/bash`
into a build script and it will just work: it will pull in the dependency as
expected. If you put it in `buildInputs` or `nativeBuildInputs`, then it will
go in the `PATH` and appear to build tools.

If the store paths end up in the outputs of the build, then they will show up
as runtime dependencies.

See the [nixpkgs manual section 6.3] for more details on this.

The same idea applies to the Docker tools: you can just reference things in
build scripts or otherwise, and as long as they are paths in the Nix store (as
in, they are from a Nix expression or Nix path expression), they will just
work.

If you put things in `contents`, they will get `rsync`ed to the root of the
output image, which, if they are also in the closure due to references in
build scripts or otherwise, you will get them duplicated. Just removing the
big package from `contents` and only referencing it by interpolating it in
build scripts saved about 50% on image size.

[nixpkgs manual section 6.3]: https://nixos.org/manual/nixpkgs/stable/#ssec-stdenv-dependencies

### Unnecessary packages in the closure

It's possible to accidentally get packages that were not intended to be in the
closure, into the closure. This can happen due to odd build scripts, stuff in
`nix-support`, compilers including paths for no reason, and other reasons. If
you know that the paths are in fact superfluous, they can be removed so the
references are no longer there.

You can find where the paths are coming from with `nix why-depends` as below.

If you are using `buildImage` rather than `buildLayeredImage`, the contents of
the image is available at `passthru.layer` on the `buildImage` derivation.

#### `nix why-depends`

After finding the bad package, it's possible to use `nix why-depends` to diagnose
the exact cause path:

```
nix why-depends $(nix-build docker.nix -A passthru.layer) /nix/store/xxxxxxx-bad
```

#### Looking at dependency trees manually

To look at the dependency tree or graph of a store path that has an unexpected
subtree:

For a tree view, use `nix-store --query --tree ./result`, where `./result` is
either the *built* Nix store path for the biggest subtree in your image or a
symlink to it.

For smaller dependency graphs, a graph can be used: `nix-store --query --tree
./result | dot -Tsvg -o deps.svg`, then look at `deps.svg` in an image viewer.

#### Fixing unexpected runtime dependencies

You can then tell Nix that some paths are not supposed to be there by putting
the offending package in [`disallowedReferences`] on your problem derivation.

Nix will throw an error on the next build that there are references that should
not be there, and where they are. You can remove these in a post-install script
using `nixpkgs.removeReferencesTo` (put it in `nativeBuildInputs` as usual;
it's also in Haskell derivations by default):

```nix
pkgs.stdenv.mkDerivation {
    # ...
    nativeBuildInputs = with pkgs; [ removeReferencesTo ];
    postInstall = with pkgs; ''
        remove-references-to -t ${badPkg1} -t ${badPkg2} $out/bin/your-program
    '';
}
```


[`remove-references-to`]: https://github.com/nixos/nixpkgs/blob/f067102afec850febd148fef827acdc6e759a59d/pkgs/build-support/remove-references-to/remove-references-to.sh

[`disallowedReferences`]: https://nixos.org/manual/nix/stable/#sec-advanced-attributes


