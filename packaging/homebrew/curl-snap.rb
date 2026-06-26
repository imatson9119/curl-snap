# Homebrew formula for curl-snap.
#
# This is the source-of-truth copy. On each release, copy it into the tap repo
# (imatson9119/homebrew-tap) as Formula/curl-snap.rb with the url + sha256
# updated for the new version. See RELEASING.md.

class CurlSnap < Formula
  desc "Render a curl request and response as a clean, shareable image"
  homepage "https://github.com/imatson9119/curl-snap"
  url "https://registry.npmjs.org/curl-snap/-/curl-snap-2.6.0.tgz"
  sha256 "1e847a3414b6e15576cdba6f1b05f56e0705f7f6a1aae5cfae10c552ca7ee05e"
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
