# Bennet (hackathon prototype)

Bennet was previously called NightSignal. Internal identifiers still use the old name on purpose, so that installed builds keep updating: slug `nightsignal`, URL scheme, bundle ID `ai.nightsignal.prototype`, storage keys, the `NightSignalSensors` native module and the Convex health check.

Experimental, phone-only pulse / breathing-movement sensing plus a clearly labelled **test-alert check-in demo**.

> **Not a medical device.** Bennet is not a heart-attack detector, cardiac-arrest detector, medical monitor or validated overnight safety product. Pulse and breathing cannot rule out a heart attack. The app never says "all clear", never infers arrest from a missing signal, and has no risk score. Nothing is clinically validated.

Stack: Expo SDK 58 + Expo Router + TypeScript (repository root), an Expo local Swift module (`modules/night-signal-sensors`, AVFoundation / Vision / CoreMotion), and Convex (`convex/`).

## Repository contents

- `src/`, `modules/`, `assets/`: the Bennet mobile app and native iPhone sensors.
- `convex/`: backend source, generated bindings, and backend tests.
- `scripts/`, `eas.json`, `app.json`: build and deployment configuration.
- [`demo/Bennet-demo.mp4`](demo/Bennet-demo.mp4): latest 66-second presentation demo, including the labelled face regions, audible cancellation countdown, simulated nearby-helper notification/map, and a closing $20 Whop payment prompt.
- [`demo/`](demo/README.md): the portable Python renderer, requirements, and the two original video clips needed to reproduce it.
- `docs/previews/`: app previews from development.
- `TEST-RESULTS.txt`, `BEDSIDE-TEST-REPORT.txt`: current and historical verification records.

The presentation video's nearby-helper push notification, route, and closing Whop payment prompt are **not implemented in the installed app**. The Whop screen is a design preview with no live checkout or charge. Convex still needs deployment, and live nearby-user discovery, location consent, push delivery, and responder routing remain future work. The demo renderer was created separately from the Capy-authored mobile app.

## How sponsor tools were used

- **Capy (AI coding agent):** wrote the whole app: the Expo Router UI and design system, the Swift sensor module, the signal-processing estimators, the Convex backend, and the tests. It also ran the checks, drove the Revyl builds and cloud-phone tests, and packaged the source.
- **Convex (backend):** `convex/schema.ts`, `convex/demo.ts`, `convex/health.ts` and `convex/lib/*` hold the backend: demo sessions, alerts and an event log, a server-scheduled countdown expiry (`ctx.scheduler.runAt`), session tokens checked against stored SHA-256 hashes, and reactive `onUpdate` subscriptions in `src/data/cloudRepository.ts`. It is verified with `convex-test` (8 tests). **Not deployed yet:** no deploy key has been authorized, so the app shows "Cloud sync: Unavailable" and uses a device-local store with the same transition rules (`convex/lib/demoMachine.ts`).
- **Revyl (mobile build and cloud devices):** remote macOS and Xcode builds of the Release simulator app (`scripts/revyl-ios-sim-build.sh`) and of an unsigned iphoneos compile check (`scripts/ios-device-compile-check.sh`). Revyl's cloud iPhone ran the end-to-end UI tests. Its cloud iPhones are simulators, so the camera, torch and TrueDepth paths can't run there.
- **Expo / EAS:** installs on a physical iPhone go through the EAS internal-distribution profile `device-internal`, built locally by the owner under project `@jacklias/nightsignal`.

## Feature status

Verified = exercised on a Revyl cloud iPhone 16 (iOS Simulator, Release build, JS bundled). Simulators have no camera, torch or TrueDepth hardware, so **every camera/depth feature is unverified until run on a physical Face ID iPhone.** Hardware is detected at runtime; nothing is assumed from the model name.

| Feature | Status |
| --- | --- |
| Redesigned UI (design system, line icons, sensor tile grid, Device & permissions panel, countdown ring, timeline History, How it works guide, reduced-motion aware decoration) | **Verified (simulator)** |
| Onboarding, LIVE SENSOR vs DEMONSTRATION modes, Monitor / Check-in / History tabs, a11y labels + testIDs | **Verified (simulator)** |
| Sensor availability + permission rows; camera/TrueDepth "Unavailable/Unsupported" on simulator | **Verified (simulator)** |
| Microphone level pipeline (AVAudioEngine tap → dBFS → trace), Stop, 30 s cap (all sessions; JS + native) | **Verified runs (simulator)**: the cloud mic is silent (-120 dBFS); real audio is unverified |
| Pause on background ("Monitoring paused: the app left the foreground") | **Verified (simulator, mic)** |
| Fingertip PPG (rear camera + torch 0.3, 30 s cap, finger/saturation/motion/periodicity/stability gating) | **Implemented, compiles; unverified on hardware** |
| Face rPPG (Vision face box → forehead + cheek ROI → POS → spectral peak with gating) | **Implemented, compiles; unverified on hardware** |
| TrueDepth breathing *movement* (chest ROI depth mean, experimental 20 s cadence window inside the 30 s session; movement, not airflow) | **Experimental, compiles; unverified on hardware** |
| Phone-on-chest CoreMotion view | **Deferred** (CoreMotion is used only as the PPG motion gate) |
| Bedside demo (Nightstand: simulated breathing; Propped up: + simulated face pulse), 30 s countdown, stop, summary, replay; deterministic, labelled SIMULATED, never touches sensors | **Implemented; checked in a web preview only** |
| Demo test alert: trigger → countdown → I'm okay / expiry → unacknowledged → acknowledge; simulated distress event | **Verified (simulator), device-local storage**, synthetic data only, nobody contacted |
| History persistence across relaunch, per-session tokens in Keychain | **Verified (simulator)** |
| Convex backend (schema, queries, mutations, scheduled server-side expiry, token-hash auth) | **Code + convex-test suite pass; NOT deployed.** The app shows **Cloud sync: Unavailable** until `health:status` answers from an authorized deploy |

Estimator unit tests use **synthetic, seeded signals** (`src/signal/__tests__/syntheticFixtures.ts`), not recordings of any person.

## Privacy and security model

- Raw camera frames, depth maps and audio buffers are reduced to a few numbers in Swift and discarded; nothing is uploaded.
- Only demonstration metadata (session label, alert states, timestamps) is ever sent to Convex.
- Each demo session gets a 256-bit random token (expo-crypto) stored in the iOS Keychain via SecureStore. The server stores only its SHA-256 hash and every query/mutation validates it; there are no list-all queries, so tables are not globally readable.
- Future real sensor-summary sync would require explicit opt-in and real auth; it is intentionally absent.

## Commands

```bash
npm install
npm run typecheck          # tsc --noEmit
npm test                   # vitest: estimator (synthetic signals), demo transitions, token authorization (convex-test)
npm run convex:codegen-offline   # regenerate convex/_generated without a deployment
bash scripts/revyl-ios-sim-build.sh   # macOS: Release iOS Simulator .app, JS bundled, ad-hoc signed (Keychain needs a signature)
```

## Install on your own iPhone (physical device)

A simulator `.app` cannot be installed on a phone, and Expo Go cannot load the custom Swift module. A physical install needs an Apple-signed build. The shortest supported path is **EAS internal distribution (ad hoc)**, configured in `eas.json` as the `device-internal` profile (Release, iphoneos, JS bundled, `EXPO_PUBLIC_CONVEX_URL` set).

Prerequisites, in order:

1. **Apple Developer Program membership active.** Renewal can take time to process. After renewal, Apple can take 24–72 h to process a newly registered device, so the first build that includes your phone may fail and need a rebuild.
2. **Expo account login:** `npx eas-cli@latest login` (interactive), or an `EXPO_TOKEN` access token. Then run `npx eas-cli@latest init`, which adds `owner` and `extra.eas.projectId` to `app.json`.
3. **Register the phone:** `npx eas-cli@latest device:create` prints a URL/QR code. Open it in Safari **on the iPhone** and install the profile; it sends the UDID to Expo.
4. **Enable Developer Mode** on the iPhone: Settings → Privacy & Security → Developer Mode (needed for ad hoc apps on iOS 16+).
5. **Build:** `npx eas-cli@latest build -p ios --profile device-internal`. During this interactive step you sign in to Apple yourself, and Expo creates or reuses the distribution certificate and the ad hoc provisioning profile that contains your UDID. This is the approval step for signing material.
6. The build page gives an **install link / QR code**. Open it on the registered iPhone to install.

Fallback for when you have a Mac and a USB cable: `npx expo prebuild -p ios`, open `ios/Bennet.xcworkspace` in Xcode (the generated project follows `expo.name`), choose your team under Signing & Capabilities, select the phone, set the scheme to Release, then Run.

`scripts/ios-device-compile-check.sh` proves the iphoneos Release build compiles with code signing disabled. Its output is **not installable**.

## Enabling cloud sync (next step)

1. Create a **development deploy key** for the existing `yc-consumer-hackathon` project in the Convex dashboard (Settings → Deploy keys) for deployment `kindly-retriever-868`.
2. Run `CONVEX_DEPLOY_KEY=... npx convex deploy` (or `npx convex dev --once` after `npx convex login`). This also replaces the offline-generated `convex/_generated`.
3. Relaunch the app: the Check-in tab flips to **Cloud sync: Connected** only after `health:status` answers from that deployment.

Set `EXPO_PUBLIC_CONVEX_URL` (see `.env.example`) at build time; the public URL is not a secret.
