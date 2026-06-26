# Homebrew formula for curl-snap.
#
# This is the source-of-truth copy. On each release, copy it into the tap repo
# (imatson9119/homebrew-tap) as Formula/curl-snap.rb with the url + sha256
# updated for the new version. See RELEASING.md.

class CurlSnap < Formula
  desc "Render a curl request and response as a clean, shareable image"
  homepage "https://github.com/imatson9119/curl-snap"
  url "https://registry.npmjs.org/curl-snap/-/curl-snap-2.5.1.tgz"
  sha256 "3a3c172762b18e1ecb293e65ff8029aa0b030f31153d5111874f6f757c0efc8c"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    assert_match "curl-snap #{version}", shell_output("#{bin}/curl-snap --version")
  end
end
