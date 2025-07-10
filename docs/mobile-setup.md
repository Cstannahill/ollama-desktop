# Mobile Setup

Install the platform SDKs before building:

- Android Studio with NDK
- Xcode with command line tools

Build commands:
```bash
# Android
pnpm tauri android dev  # live reload
pnpm tauri android build --apk --target aarch64
# iOS
pnpm tauri ios dev
pnpm tauri ios build
```
