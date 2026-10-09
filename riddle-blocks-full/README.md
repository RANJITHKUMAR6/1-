# Riddle Blocks

A timed riddle word game. Read the riddle, fill the letter blocks, beat the 30-second clock. 200 levels in 10 tiers, hints, coins, streaks, a daily bonus, sound and haptics. Works fully offline.

## Run it on your computer

```bash
npm install
npm run build     # writes www/index.html (the app) and dist/artifact.html (single-page version)
npm test          # headless test of win, wrong answer, timeout, hints, skip, reset
```

Open `www/index.html` in any browser to play.

## Get the Android APK (no Android Studio needed)

1. Create an empty GitHub repository and push this folder to it.
2. Open the repository's **Actions** tab. The "Build Android APK" workflow runs on every push (or press **Run workflow**).
3. When it finishes, open the run and download the **riddle-blocks-debug-apk** artifact. Unzip it and install `app-debug.apk` on your phone (allow "install unknown apps" for your file manager or browser).

The workflow runs the tests, creates the Android project with Capacitor, generates the icons and splash screens from `assets/`, and builds with Java 21.

## Build locally with Android Studio instead

```bash
npm install
npm run build
npx cap add android
npm run android:assets
npx cap sync android
npx cap open android      # then Run, or Build > Build APK(s)
```

## Publish on Google Play

1. In `capacitor.config.json`, change `appId` to your own reverse-domain id (for example `com.yourname.riddleblocks`). It cannot be changed after release.
2. Create a Play Console developer account (one-time registration fee).
3. Create a signing key once and keep it safe:
   `keytool -genkey -v -keystore riddle-blocks.jks -alias riddle -keyalg RSA -keysize 2048 -validity 10000`
4. In Android Studio choose **Build > Generate Signed App Bundle** and select Android App Bundle (AAB). Upload the `.aab` to a Play Console internal test track first.
5. You will also need a store listing (screenshots, short and full description), a privacy policy URL, and the content rating and data-safety forms. The app collects no data and makes no network calls.

## Add or change levels

Edit `src/levels.js`. Each level is `['ANSWER', 'Riddle text']`. Rules the tests enforce: answers are unique, A-Z only, 3 to 11 letters. Add a name to `TIERS` for each new block of 20 levels.

## Project layout

| Path | What it is |
| --- | --- |
| `src/levels.js` | The 200 riddles and tier names |
| `src/game.js` | Game logic, timer, hints, coins, sound, haptics, saving |
| `src/style.css`, `src/body.html` | Look and markup |
| `src/fonts/` | Fredoka and Nunito (SIL Open Font License) embedded into the build |
| `scripts/build.js` | Bundles everything into `www/index.html` |
| `scripts/test.js` | Headless game test |
| `assets/` | Icon and splash source images |
| `.github/workflows/android.yml` | Cloud APK build |

Progress is stored on the device (localStorage) under the key `riddleBlocks.v2`.
