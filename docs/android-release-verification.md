# Android release artifact and device verification

## Current evidence boundary

This repository provides **verification tooling**, not a signed production build or a device-test result. Preparing this script, a successful JavaScript export, Expo dependency checks, EAS authentication, and passing synthetic unit tests do not establish that a release AAB builds, signs, installs, or runs.

At preparation time, no release AAB, local Android SDK/`adb`/`sdkmanager`, or connected test device was supplied, and production configuration was incomplete. No production build, upload, installation, Google login, Play Integrity attestation, or account deletion was performed by this work. Complete the configuration/build prerequisites through the existing release process before using the commands below.

The verifier inspects the **actual supplied artifact**, independently of `app.json`: package `com.nustudent.expenzo`, target SDK at least 36, explicitly chosen release version and ABI set, backup disabled, and production debugging disabled. Expo 57 / React Native 0.86.3 dependency versions alone are not evidence of native compatibility.

## Operator-supplied inputs

Prepare these locally; the script performs no downloads, global installs, signing, builds, provider operations, or deployments:

1. The genuine, signed release `.aab` from the intended build. Keep its build identifier, source revision and build log alongside the final SHA-256.
2. A local official [Google bundletool release](https://github.com/google/bundletool/releases), obtained through your approved tool-provisioning process. Record the release URL/version and independently verified checksum/provenance. The report records its SHA-256; a locally computed hash by itself does **not** prove publisher provenance.
3. Explicit paths to `java`, `jarsigner`, and `keytool` in a supported local JDK (17+ recommended; follow your bundletool version's requirements). Supply real JDK binaries rather than an OS launcher that installs Java. Use current JDK security algorithm policy; do not weaken it to make verification pass.
4. The **public upload certificate**, PEM or DER, and its independently recorded SHA-256 fingerprint from the app's approved signing record / Play Console App signing page. Never supply a private key, signing keystore, password, `.env`, or service-account file. The upload certificate signs the AAB; Play's **app-signing certificate** identifies APKs delivered to devices and may be different.
5. The expected version code, literal version name, and exact ABI set agreed for this release. Obtain the version code from the release/build record, including EAS remote versioning if used. Do not discover these values from the artifact and automatically declare them approved.

The existing installed Expo dependency tree supplies `@xmldom/xmldom` for XML parsing. If it is unavailable, the check fails; there is no regex-only fallback and no automatic installation.

## Run the static artifact gate

Set the following shell variables to real, approved local values. No certificate fingerprints, version codes or paths in this document are production defaults. `EXPECTED_ABIS` is a comma-separated exact set drawn from `arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64`; it must include `arm64-v8a`.

```sh
node scripts/verify-android-release.cjs \
  --aab "$AAB" \
  --bundletool "$BUNDLETOOL_JAR" \
  --java "$JAVA_HOME/bin/java" \
  --jarsigner "$JAVA_HOME/bin/jarsigner" \
  --keytool "$JAVA_HOME/bin/keytool" \
  --upload-cert "$UPLOAD_PUBLIC_CERT" \
  --upload-cert-sha256 "$UPLOAD_CERT_SHA256" \
  --expected-version-code "$EXPECTED_VERSION_CODE" \
  --expected-version-name "$EXPECTED_VERSION_NAME" \
  --expected-abis "$EXPECTED_ABIS"
```

Use `--help` to inspect the interface. A locally provisioned bundletool executable can instead be passed as `--bundletool-executable "$BUNDLETOOL"`, omitting `--bundletool` and `--java`. It must support the same official CLI and run in the script's minimal environment; the JAR/JDK form is preferred. Arguments use separate tokens, not `--flag=value` at this script's CLI.

On success stdout contains JSON identifying `scope: "static-aab-verification-only"`, the artifact SHA-256, upload-certificate fingerprint, tool hashes/version, per-module manifests, ABI/library inventory and static ELF results. It **always** reports `releaseReady: false` and outstanding APK/device gates. Retain stdout only after exit status 0, together with the actual command, UTC date, approved tool provenance and build record. Do not relabel this report as device or full-release certification.

Missing inputs/tools, nonzero tool exits, malformed/unsupported files, wrong identity or incomplete static evidence produce exit 1 with `FAILED/INCOMPLETE`; there is no success report or skip flag. Exit 0 means only the static gates below passed. It does not approve release or imply device testing.

### What the static gate establishes

- A bounded, regular AAB snapshot has consistent ZIP entries, sizes, CRCs and headers. Entries are inspected in memory without extracting their paths. The source hash must still match the verified snapshot afterward.
- `jarsigner -verify -strict -verbose -certs` succeeds with a temporary JKS truststore containing **only the supplied public upload certificate**, and the `expected-upload` alias is required. A separate `keytool -printcert -rfc -jarfile` check pins the exact signer **leaf**, because a jarsigner alias may also match a certificate farther up a chain. There must be exactly one signer. The script checks the certificate fingerprint/current validity and rejects the standard Android debug identity. The public-only store is removed afterward; no signing key is read or generated.
- Self-signed upload certificates are normal for Android. Trusting the explicitly pinned public certificate avoids an inappropriate public-CA requirement. The script does **not** ignore `jarsigner` exit code 4: that code can also mean expired/not-yet-valid certificates or disabled algorithms. Unsigned entries, alias mismatch and all other nonzero exits fail. An unsigned JAR's exit-0 output also fails. Network revocation checks are not enabled.
- Official bundletool `validate` succeeds; `dump manifest` is parsed for **every module manifest**, not just base. DTD/entity declarations, parser-recovery warnings, oversized/deep XML, unresolved required values and ambiguous structures fail.
- The base manifest has the exact package/version, target SDK >=36, and explicit `android:allowBackup="false"`. `android:debuggable` must be false or absent (Android's documented default is false). True/unresolved `testOnly` and forced `pageSizeCompat` are rejected. Feature modules cannot override these constraints or add blocked permissions.
- Camera, recording audio, broad/selected media access, external-storage management/read/write and overlay permissions are rejected, including `uses-permission-sdk-23`/`uses-permission-sdk-m` and declarations with `maxSdkVersion`.
- Native `.so` entries must be in a recognized module's `lib/<abi>/` directory and match the expected ABI set. Each shipped 32-bit library must have its same-module/name 64-bit counterpart. A React Native bundle with no native libraries fails.
- The built-in bounded ELF parser checks ELF class/machine, little-endian shared-object headers, program-table/segment bounds, power-of-two alignment and offset/virtual-address congruence. **Every** `PT_LOAD` in arm64-v8a/x86_64 must have `p_align >= 16384`; any `PT_GNU_RELRO` end address must also be 16 KB aligned. It uses integer-safe `BigInt` arithmetic. 32-bit libraries receive structural checks and are explicitly identified as outside the 64-bit 16 KB requirement.
- `bundletool dump config` must explicitly contain enabled `optimizations.uncompressNativeLibraries.alignment = PAGE_ALIGNMENT_16K`. This conservative gate does not accept compressed-native-library alternatives or implicit/default alignment. It establishes the bundle's packaging request, **not the resulting APK ZIP offsets**.

Conservative format bounds: 512 MiB AAB, 128 MiB per entry, 2 GiB total declared expanded data, 20,000 entries, compression ratio <=2000, 32 modules, 2 MiB XML/config dumps, and 180 seconds / 16 MiB captured output per process. ZIP64, multi-disk, encrypted entries, links/special files, non-ASCII or alternate Unicode ZIP paths, case-colliding names, hidden `.so` assets, ambiguous/gapped ZIP layouts and unknown ABI/ELF encodings fail as unsupported. These limits are intentional fail-closed scope, not evidence that a rejected larger/different-format artifact is inherently invalid. Review and test any required format expansion before changing the verifier.

The script does not prove source-to-artifact provenance, absence of all malicious code, native linking/runtime behavior, Google service provisioning, server deletion results, Play acceptance or Play policy compliance. Native alignment is necessary but cannot detect hard-coded 4 KB page-size assumptions in code.

## Required APK and 16 KB runtime evidence — not yet run

Use a dedicated authorized test environment and disposable test accounts. Record artifact hash, installed version, APK hashes/signing fingerprint, device model/serial alias, OS/API, CPU ABI, page size, installation source, timestamp, tester, result and a sanitized evidence location. Never record auth/App Check tokens, credentials or private account data.

1. Obtain the device-specific APKs produced from this exact AAB through the approved release-test workflow. For final Google login/App Check validation, install from an approved **Play test track** using the actual distribution signing certificate and app recognition/licensing configuration. Uploading/promoting a build remains a separate operator action.
2. For a separately authorized local runtime test, bundletool can generate and install APKs. Set `TEST_SIGNING_KEYSTORE` and `TEST_SIGNING_ALIAS` locally through the existing signing workflow; the following commands prompt in the terminal for passwords. Do not omit `--ks`: bundletool may otherwise silently use a debug key. A locally signed APK is not Play distribution/App Check evidence.

   ```sh
   "$JAVA_HOME/bin/java" -jar "$BUNDLETOOL_JAR" get-device-spec \
     --adb="$ANDROID_SDK_ROOT/platform-tools/adb" \
     --device-id="$SERIAL" --output="$DEVICE_SPEC_JSON"
   "$JAVA_HOME/bin/java" -jar "$BUNDLETOOL_JAR" build-apks \
     --bundle="$AAB" --output="$APK_SET" --device-spec="$DEVICE_SPEC_JSON" \
     --ks="$TEST_SIGNING_KEYSTORE" --ks-key-alias="$TEST_SIGNING_ALIAS"
   "$JAVA_HOME/bin/java" -jar "$BUNDLETOOL_JAR" extract-apks \
     --apks="$APK_SET" --device-spec="$DEVICE_SPEC_JSON" --output-dir="$APK_DIRECTORY"
   "$JAVA_HOME/bin/java" -jar "$BUNDLETOOL_JAR" install-apks \
     --apks="$APK_SET" --adb="$ANDROID_SDK_ROOT/platform-tools/adb" --device-id="$SERIAL"
   ```

3. Using Android SDK Build-Tools 35.0.0 or newer, run both commands on **each** generated/Play-delivered base and split APK (set `APK` to one actual file at a time). Record the signer fingerprint against the appropriate approved test/Play **app-signing** certificate, not blindly against the AAB upload certificate:

   ```sh
   "$BUILD_TOOLS/zipalign" -c -P 16 -v 4 "$APK"
   "$BUILD_TOOLS/apksigner" verify --verbose --print-certs "$APK"
   ```

4. On the selected real device or supported 16 KB Android emulator:

   ```sh
   "$ANDROID_SDK_ROOT/platform-tools/adb" -s "$SERIAL" shell getconf PAGE_SIZE
   "$ANDROID_SDK_ROOT/platform-tools/adb" -s "$SERIAL" shell getprop ro.build.version.sdk
   "$ANDROID_SDK_ROOT/platform-tools/adb" -s "$SERIAL" shell getprop ro.product.cpu.abilist
   "$ANDROID_SDK_ROOT/platform-tools/adb" -s "$SERIAL" shell dumpsys package com.nustudent.expenzo
   ```

   `PAGE_SIZE` must actually return **16384**. Match installed package/version and target SDK to the artifact. Disable the device's per-app **Run app with page size compat mode** setting where available and document the setting; no compatibility fallback or suppressed warning counts as native support. An emulator may prove runtime alignment but fail Play Integrity; that does not justify a debug App Check bypass.
5. Test cold launch, repeated force-stop/relaunch, background/foreground, navigation, local transaction/budget CRUD, profile photo selection/upload, network-backed operations, and sign-out on the 16 KB environment. Capture only sanitized relevant crashes/linker failures/ANRs and actual pass/fail results. Repeat the native scenarios on every shipped 64-bit ABI (arm64-v8a and x86_64 when present); keep a normal 4 KB regression device result separately. Do not infer runtime success from this script's ELF results.

## Google login, App Check and deletion scenarios — not yet run

- **Google login:** On the Play-delivered production-mode build, use separate disposable personal and company accounts. Tap **Continue with Google**, finish account selection, confirm the correct personal/company profile and persisted login after restart. Test cancellation, offline failure/recovery, sign-out and sign-in again, and wrong-account-type rejection. Verify the package plus distribution-certificate SHA-1/SHA-256 registrations through the existing authorized provisioning record; never substitute the upload certificate merely because the AAB signature passed.
- **Play Integrity App Check:** Confirm that a protected backend operation succeeds and correlate it with authorized server-side verification/metrics for the expected native Firebase app. UI-only success or a Google ID token is insufficient. In the approved test backend, verify missing/invalid App Check evidence is rejected and the app shows recoverable failure for offline/attestation failures, then retries successfully when recovered. Do not log tokens or enable a debug provider/debug-token bypass. A sideload or uncertified emulator may be rejected by production policy; use a recognized Play-installed build on an eligible device to complete the positive case.
- **Deletion confirmation:** Create disposable personal and company accounts with test transactions, budgets and profile images, and company/team data where supported. In account settings choose **Delete account**. Cancel once and enter incorrect confirmation text once; verify nothing is removed. Enter `delete` for the intentional destructive test.
- **Reauthentication:** Exercise a session old enough for the server's recent-login requirement. Verify **Verify & delete** asks for the current password or Google sign-in as appropriate. A wrong password/cancelled Google sign-in must retain the account; successful reauthentication must resume deletion.
- **Completed deletion:** Require the server-confirmed outcome, signed-out UI, and local finance/profile cache cleanup after app restart. Using the separately authorized backend inspection workflow, verify deletion of the disposable account's Auth identity and app-owned records/files, including company/team-related data applicable to that account. Confirm another account's data remains intact. The UI message alone is not backend-deletion proof.
- **Failure/retry:** Interrupt connectivity before/during deletion and test an approved server failure in the test environment. The UI must report an incomplete/retryable outcome, not falsely claim success. Reconnect and retry until the server confirms completion; check idempotence, partial-deletion recovery and isolation. Do not simulate failures against unrelated production users.

Keep these gates **unverified** until actual results tied to the artifact/distribution build are recorded. The tooling generates no device-attestation template with prefilled pass values.

## Tooling regression checks

```sh
node --test tests/android-release.test.cjs
node scripts/check-source.cjs
node scripts/verify-android-release.cjs --help
```

Tests use synthetic XML/ZIP/ELF/public-certificate fixtures and injected process runners. They exercise failure paths and orchestration, and deliberately are **not** real bundletool, signed-AAB or device verification. The production CLI has no fixture or bypass switch.

## Official references

- [Android: Support 16 KB page sizes](https://developer.android.com/guide/practices/page-sizes) — ELF LOAD/RELRO alignment, bundle packaging request, APK `zipalign`, runtime and compatibility-mode checks.
- [Android: bundletool](https://developer.android.com/tools/bundletool) — official distribution, APK generation/extraction/installation, signing defaults.
- [Android: Sign your app](https://developer.android.com/studio/publish/app-signing) — upload versus distribution signing certificates, self-signed Android signing identity.
- [Android: application manifest attributes](https://developer.android.com/guide/topics/manifest/application-element#debug) — omitted `debuggable` defaults to false.
- [Oracle JDK: jarsigner](https://docs.oracle.com/en/java/javase/21/docs/specs/man/jarsigner.html) — strict exit-code meanings, aliases, unsigned entries, certificate warnings.
