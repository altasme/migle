# Android release signing (for the release-bundle CI workflow)

`.github/workflows/android-release-bundle.yml` builds the signed `.aab`
you upload to Play Console. It's manual-trigger only (Actions tab ->
"Android release bundle" -> Run workflow) since it needs your upload
keystore as a secret, unlike the debug workflow which runs on every push.

## Two different keys - don't mix them up

- **The debug key** (`android/debug.keystore`, committed to this repo) -
  signs debug/sideload builds only. Never used for anything uploaded to
  Play Console.
- **The upload key** (what this doc is about) - the key *you* sign the
  `.aab` with before uploading it to Play Console. Once Play App Signing
  is enrolled, Google re-signs the app with its own App Signing key for
  distribution to users, but Play still needs every upload signed with
  your consistent upload key first, to prove it's really coming from you.

**If Mingle has ever been uploaded to Play Console before, an upload key
already exists and is registered there.** Use that exact keystore file -
generating a new one and using it here will not match what Play Console
expects, and uploads will be rejected. If you're not sure, check Play
Console -> Setup -> App integrity, or check wherever the original
keystore was saved when the app was first set up.

**Only generate a brand new one if this is genuinely the first-ever
release build for this app:**

```bash
keytool -genkeypair -v \
  -keystore mingle-release.keystore \
  -alias mingle-upload \
  -keyalg RSA -keysize 4096 -validity 10000 \
  -dname "CN=Mingle, O=<your org/name>, C=US"
```

Store the resulting `mingle-release.keystore` file and the passwords you
set somewhere durable and private (a password manager, not this repo) -
losing it means losing the ability to update the app under the same
upload key.

## Repo secrets to add

Settings -> Secrets and variables -> Actions -> New repository secret:

| Secret | Value |
|---|---|
| `ANDROID_RELEASE_KEYSTORE_BASE64` | `base64 -w0 mingle-release.keystore` (Linux) or `base64 -i mingle-release.keystore \| pbcopy` (macOS) - the whole base64 blob, no line breaks |
| `ANDROID_RELEASE_STORE_PASSWORD` | the keystore password |
| `ANDROID_RELEASE_KEY_ALIAS` | the key alias (`mingle-upload` in the example above) |
| `ANDROID_RELEASE_KEY_PASSWORD` | the key password (often the same as the store password) |

These are read by `android/app/build.gradle`'s `release` signingConfig,
which only activates when `RELEASE_STORE_FILE` is passed as a Gradle
property - locally that's harmless to leave unset (you just get an
unsigned release build), in CI the workflow passes it from these secrets.

## What's still missing before this produces something uploadable

- **`versionCode` / `versionName` are hardcoded to `1` / `"1.0"`** in
  `android/app/build.gradle`. Play Console rejects a re-upload with a
  `versionCode` it's already seen - bump this by hand before each real
  release until there's an actual versioning scheme decided.
