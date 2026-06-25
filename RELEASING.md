# Releasing

curl-snap ships to two places: **npm** (the primary channel) and the **Homebrew
tap** (a thin wrapper that installs the npm package). npm is the source of truth;
the formula just points at the published tarball.

Most of the release is automated: a **version bump on `main` is the trigger**.
The [`release` workflow](.github/workflows/release.yml) watches for a change to
the `version` field in `package.json` and then tags `v<version>`, publishes to
npm, and cuts a GitHub Release with notes from the CHANGELOG. The only manual
step left is bumping the Homebrew tap (a separate repo).

> One-time setup: add an npm automation token as the repo secret `NPM_TOKEN`
> (Settings → Secrets and variables → Actions). `GITHUB_TOKEN` is provided
> automatically.

## 1. Cut the version

```sh
# bump "version" in package.json, move the CHANGELOG "Unreleased" notes under a
# new "## [x.y.z] - <date>" heading, commit
npm version <patch|minor|major> --no-git-tag-version
git commit -am "Release vX.Y.Z"
```

Open a PR and merge it to `main` (or push to `main` directly). On merge, the
`release` workflow tags the commit, runs `npm publish`, and creates the GitHub
Release — nothing else to do here.

Sanity check it once published: `npm install -g curl-snap && curl-snap --version`.

## 2. Update the Homebrew formula

Get the sha256 of the published tarball:

```sh
VERSION=$(node -p "require('./package.json').version")
curl -sL "https://registry.npmjs.org/curl-snap/-/curl-snap-${VERSION}.tgz" | shasum -a 256
```

Then, in [imatson9119/homebrew-tap](https://github.com/imatson9119/homebrew-tap),
copy `packaging/homebrew/curl-snap.rb` to `Formula/curl-snap.rb` and update:

- `url` → `https://registry.npmjs.org/curl-snap/-/curl-snap-${VERSION}.tgz`
- `sha256` → the value from above

Commit and push the tap. Verify:

```sh
brew tap imatson9119/tap
brew install curl-snap
curl-snap --version
```

The tap is the one repo the workflow can't reach, so this stays manual.

## Manual fallback

If the workflow is unavailable (or you need to re-cut a release), the steps it
automates are:

```sh
VERSION=$(node -p "require('./package.json').version")
npm publish --access public
gh release create "v${VERSION}" --title "v${VERSION}" --notes-from-tag
```

## Why this split?

curl-snap is a Node CLI, so `npm install -g` is the natural distribution path and
needs no release ceremony beyond `npm publish`. The Homebrew tap exists for people
who'd rather `brew install` everything — the formula just `depends_on "node"` and
installs the same npm tarball, so the two channels never drift.
