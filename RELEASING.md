# Releasing

curl-snap ships to two places: **npm** (the primary channel) and the **Homebrew
tap** (a thin wrapper that installs the npm package). npm is the source of truth;
the formula just points at the published tarball.

## 1. Cut the version

```sh
# bump "version" in package.json, add a CHANGELOG entry, commit
npm version <patch|minor|major>   # tags the commit too
```

## 2. Publish to npm

```sh
npm login        # first time only
npm publish      # runs against the "files" allowlist in package.json
```

Sanity check it: `npm install -g curl-snap && curl-snap --version`.

## 3. Update the Homebrew formula

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

## 4. Tag the GitHub release

`npm version` already created the git tag; push it and cut a release:

```sh
git push && git push --tags
gh release create "v${VERSION}" --title "v${VERSION}" --notes-from-tag
```

## Why this split?

curl-snap is a Node CLI, so `npm install -g` is the natural distribution path and
needs no release ceremony beyond `npm publish`. The Homebrew tap exists for people
who'd rather `brew install` everything — the formula just `depends_on "node"` and
installs the same npm tarball, so the two channels never drift.
