# Platforms

All platforms build from the same `src/`. Platform-specific behavior is limited to [`src/platform.ts`](../src/platform.ts) (see [architecture.md](architecture.md#platform-layer)).

| Platform | Develop | Build | Output | Tested |
|---|---|---|---|---|
| Web | `pnpm dev` | `pnpm build` | `dist/` | yes |
| Chrome / Edge extension | `pnpm dev:extension` | `pnpm build:extension` | `dist-extension/` | Edge 157, Chromium |
| Windows | `pnpm tauri dev` | `pnpm tauri build` | NSIS `.exe`, `.msi` | build and LAN sync |
| Android | `pnpm tauri android dev` | `pnpm tauri android build -- --apk` | `.apk` | Android 15 emulator |
| macOS, Linux | `pnpm tauri dev` | `pnpm tauri build` | `.dmg`/`.app`, `.deb`/`.AppImage` | not built |
| iOS | `pnpm tauri ios dev` | `pnpm tauri ios build` | `.ipa` | not built |

Every build needs `pnpm install` first. Run `pnpm test` before shipping.

## Web

```sh
pnpm dev       # Vite dev server on http://localhost:1420 (fixed port, used by Tauri too)
pnpm build     # tsc type check + production build into dist/
pnpm preview   # serve dist/ locally
```

`dist/` is a static site. Any static host works if it serves `index.html` for unknown paths (needed for `/b/<id>` links). The bundled LAN server does this:

```sh
pnpm serve:lan                         # http://127.0.0.1:4173
pnpm serve:lan 192.168.1.10 4174    # reachable from the local network
node server.mjs 0.0.0.0 4174              # all interfaces
```

The LAN server also relays sync traffic; see [sync.md](sync.md#wi-fi--lan-relay).

## Browser extension (Chrome, Edge)

```sh
pnpm build:extension    # one-off build into dist-extension/
pnpm dev:extension      # rebuild on every change
```

Load it: open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**, choose **Load unpacked** and select `dist-extension/`. After a rebuild press the reload button on the extension card.

How it is put together ([`scripts/build-extension.mjs`](../scripts/build-extension.mjs)):

- Vite builds the regular app with a relative base (`./`).
- [`extension/manifest.json`](../extension/manifest.json) (Manifest V3; `unlimitedStorage` keeps the browser from capping or evicting the extension's data, `downloads` lets automatic backups save to and prune `Downloads/kanbonk/backups`, and `key` pins the extension ID to `mocdkcnklkbfedhhpcbhljmiemaohemh`) and [`extension/background.js`](../extension/background.js) are copied next to it, plus icons from `src-tauri/icons/`.
- The toolbar button opens `index.html` in a tab or focuses the open one.
- Routes use the URL hash (`index.html#/b/<id>`) because extension pages have no server fallback.

The extension has its own storage; it syncs with other Kanbonk instances like any other device.

Chrome 137 and later ignore the `--load-extension` command-line switch, so automated tests load the extension in Chromium or Edge; in Chrome use **Load unpacked**.

## Desktop (Windows, macOS, Linux)

Install the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS (Rust, and on Windows the WebView2 runtime and the MSVC build tools).

```sh
pnpm tauri dev      # opens the app window against the Vite dev server
pnpm tauri build    # release build and installers
```

On Windows the installers are written to `src-tauri/target/release/bundle/nsis/Kanbonk_<version>_x64-setup.exe` and `.../msi/Kanbonk_<version>_x64_en-US.msi`. They are unsigned; Windows SmartScreen will warn until you sign them.

Tauri configuration: [`src-tauri/tauri.conf.json`](../src-tauri/tauri.conf.json). Rust plugins: `tauri-plugin-dialog` and `tauri-plugin-fs`, used by `saveFile()` for exports and backups. Permissions: [`src-tauri/capabilities/default.json`](../src-tauri/capabilities/default.json) grants `dialog:default`, `fs:default` and `fs:allow-write-file`; writing is limited to paths the user picks in a save dialog. Automatic backups go through the app's own commands in [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs) instead, which only write and delete `kanbonk-auto-*.zip` in `Documents/kanbonk/backups` or a folder the user chose.

## Android

Prerequisites:

- JDK 17 (e.g. Eclipse Temurin), with `JAVA_HOME` set;
- Android SDK with platform 35, build-tools and the NDK, with `ANDROID_HOME` and `NDK_HOME` set;
- Rust Android targets: `rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android`.

The Android project is generated in `src-tauri/gen/android` (`pnpm tauri android init` creates it if missing).

```sh
pnpm tauri android dev                                         # run on a connected device or emulator
pnpm tauri android build -- --debug --apk --target aarch64     # debug APK for phones (arm64)
pnpm tauri android build -- --debug --apk --target x86_64      # debug APK for the emulator
```

The APK is written to `src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk`. Install it with `adb install -r <apk>`.

Notes:

- When switching `--target`, delete the old APK first: Gradle updates the APK in place and leaves the removed library's space inside the file.
- Release builds need your own signing key; see [Tauri's Android signing guide](https://v2.tauri.app/distribute/sign/android/).
- To debug the WebView, find the app's process ID with `adb shell pidof com.khasky.kanbonk` and forward `localabstract:webview_devtools_remote_<pid>` to a local port; then open it in `chrome://inspect`.
- The Android WebView has no Web Share API, so sync bundles are saved through the system save dialog and shared from the Files app.

## iOS

Needs macOS with Xcode. Run `pnpm tauri ios init` once, then `pnpm tauri ios dev` or `pnpm tauri ios build`. iOS builds have not been made yet.
