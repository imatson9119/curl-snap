# Homebrew formula for curl-snap.
#
# This is the source-of-truth copy. On each release, copy it into the tap repo
# (imatson9119/homebrew-tap) as Formula/curl-snap.rb with the url + sha256
# updated for the new version. See RELEASING.md.

class CurlSnap < Formula
  desc "Turn a curl request into a polished PNG for PR evidence"
  homepage "https://github.com/imatson9119/curl-snap"
  url "https://registry.npmjs.org/curl-snap/-/curl-snap-1.0.0.tgz"
  sha256 "REPLACE_WITH_TARBALL_SHA256"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  def caveats
    <<~EOS
      curl-snap renders cards with a headless browser, so you'll need Chrome,
      Chromium, Edge, or Brave installed. It will not download one for you.
      If you don't have one yet:
        brew install --cask google-chrome
    EOS
  end

  test do
    assert_match "curl-snap #{version}", shell_output("#{bin}/curl-snap --version")
  end
end
