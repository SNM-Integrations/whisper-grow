# Mobile App Setup Guide

Your app has been converted to a native mobile app using Capacitor. This allows proper background recording with native permissions.

## Current Status
The app is configured for hot-reload development. When you open it on your phone, it will connect directly to the Lovable sandbox.

## Testing on Physical Device

### Step 1: Export to GitHub
1. Click "Export to Github" button in Lovable
2. Git pull the project to your local machine

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Add Native Platforms
```bash
# For Android
npx cap add android

# For iOS (Mac with Xcode required)
npx cap add ios
```

### Step 4: Update Native Dependencies
```bash
# For Android
npx cap update android

# For iOS
npx cap update ios
```

### Step 5: Build the Web Assets
```bash
npm run build
```

### Step 6: Sync to Native Platform
```bash
npx cap sync
```

### Step 7: Run on Device/Emulator
```bash
# For Android
npx cap run android

# For iOS (requires Mac + Xcode)
npx cap run ios
```

## Background Recording
The native app will request microphone permissions and can record audio even when:
- The app is in the background
- The screen is off
- You switch to other apps

The recording will continue until you press the stop button.

## Important Notes
- **Android**: Requires Android Studio installed
- **iOS**: Requires Mac with Xcode installed
- After each `git pull`, run `npx cap sync` to update the native platforms
- The app currently uses hot-reload, so it needs internet connection to work

## For Production Build
When ready to publish, update `capacitor.config.ts`:
1. Remove or comment out the `server` section
2. Run `npm run build`
3. Run `npx cap sync`
4. Build release versions through Android Studio / Xcode
