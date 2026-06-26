# Homebrew formula for curl-snap.
#
# This is the source-of-truth copy. On each release, copy it into the tap repo
# (imatson9119/homebrew-tap) as Formula/curl-snap.rb with the url + sha256
# updated for the new version. See RELEASING.md.

class CurlSnap < Formula
  desc "Render a curl request and response as a clean, shareable image"
  homepage "https://github.com/imatson9119/curl-snap"
  url "https://registry.npmjs.org/curl-snap/-/curl-snap-2.5.0.tgz"
  sha256 "6993d5d4d77839eccd5a7a498b71cdcd5e17e908b333edf05042abcc8262fb59"
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
