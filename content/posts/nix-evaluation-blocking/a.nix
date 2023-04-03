let
  pkgs = import <nixpkgs> { };
  wait = n: builtins.readFile (pkgs.runCommand "delay" { } ''
    sleep ${toString n}

    echo $((${toString n} * 5)) > $out
  '');

in
pkgs.stdenv.mkDerivation {
  name = "blah";
  dontUnpack = true;
  doInstall = false;
  dontConfigure = true;
  buildPhase = ''
    echo ${wait 1}
    echo ${wait 2}
    echo ${wait 3}
    touch $out
  '';
  doBuild = true;
}
