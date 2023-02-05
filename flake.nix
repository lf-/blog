{
  description = "Example Haskell flake showing overrides and adding stuff to the dev shell";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    # zola = {
    #   url = "github:lf-/zola/tree-painter";
    #   flake = false;
    # };
  };

  nixConfig.allow-import-from-derivation = true; # cabal2nix uses IFD

  outputs = { self, nixpkgs, flake-utils }:
    let
      ghcVer = "ghc924";
      makeHaskellOverlay = overlay: final: prev: {
        haskell = prev.haskell // {
          packages = prev.haskell.packages // {
            ${ghcVer} = prev.haskell.packages."${ghcVer}".override (oldArgs: {
              overrides =
                prev.lib.composeExtensions (oldArgs.overrides or (_: _: { }))
                  (overlay prev);
            });
          };
        };
      };

      out = system:
        let
          pkgs = import nixpkgs {
            inherit system;
            # zola not yet buildable with nix due to tree-painter using
            # submodules and cargo being absolutely AWFUL at submodules
            overlays = [ self.overlays.default ];
            config.allowBroken = true;
          };

        in
        {
          packages = rec {
          };

          checks = {
          };

          # for debugging
          # inherit pkgs;

          devShells.default =
            let haskellPackages = pkgs.haskell.packages.${ghcVer};
            in
            haskellPackages.shellFor {
              packages = p: [ ];
              withHoogle = true;
              buildInputs = with haskellPackages; [
                haskell-language-server
                fourmolu
                ghcid
                cabal-install
              ] ++ (with pkgs; [
                sqlite
              ]);
              # Change the prompt to show that you are in a devShell
              # shellHook = "export PS1='\\e[1;34mdev > \\e[0m'";
            };
        };
    in
    flake-utils.lib.eachDefaultSystem out // {
      # this stuff is *not* per-system
      overlays = {
        # zola = final: prev: {
        #   zola = prev.zola.overrideAttrs (old: {
        #     src = zola;
        #     cargoSha256 = prev.lib.fakeHash;
        #   });
        # };
        default = makeHaskellOverlay (prev: hfinal: hprev:
          let hlib = prev.haskell.lib; in
          {
            # sample = hprev.callCabal2nix "sample" ./. { };

            # here's how to do hacks to the package set
            # don't run the test suite
            # fast-tags = hlib.dontCheck hprev.fast-tags;
            #
            # don't check version bounds
            # friendly = hlib.doJailbreak hprev.friendly;
          });
      };
    };
}
