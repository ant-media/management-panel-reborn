{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  packages = with pkgs; [
    nodejs_24
    pnpm
    git
    zip
  ];

  shellHook = ''
    echo "ams-admin-panel dev shell"
    echo "  node: $(node --version)"
    echo "  pnpm: $(pnpm --version)"
  '';
}
