# Zack's Eagles fan arcade

Buildless HTML, CSS, and JavaScript served from `public/`. The site includes a local click counter with touchdown replays, Field Run, a harder Field Goal Challenge with crosswinds, Where’s Jalen?, Barkley Bird, saved appearance preferences, and a Firebase-backed visitor leaderboard.

## Local preview

```sh
python3 -m http.server 8000 --directory public
```

Open `http://localhost:8000/`. Counter totals and appearance preferences use browser storage. No build or package installation is required.

## Shared click leaderboard

The scoreboard page contains a top-25 leaderboard and an optional public nickname form. Firebase Anonymous Authentication identifies each browser profile; Firestore stores one entry per authenticated browser. Nicknames are not unique usernames. Clearing site data or using a different device can create another identity. Historical visitors cannot be reconstructed from browser-local totals; a visitor's existing total is imported when they join.

The existing Firebase project's public web configuration is in `public/scripts/firebase-config.js`. `leaderboardEnabled` is intentionally `false` until the backend is activated. The page clearly shows this state and continues counting locally.

To activate, after approval for the production changes:

1. In Firebase project `zacksbasicstaticwebsite`, create a default Cloud Firestore database in production mode and select its location. This project's Firestore API was disabled when inspected.
2. Enable **Authentication → Sign-in method → Anonymous**. Do not enable automatic anonymous-account cleanup if returning visitors should keep their identity indefinitely.
3. Deploy the provided Firestore rules and index configuration:

   ```sh
   firebase deploy --only firestore:rules,firestore:indexes --project zacksbasicstaticwebsite
   ```

4. Set `leaderboardEnabled = true` in `public/scripts/firebase-config.js`.
5. Deploy the website with explicit authorization:

   ```sh
   firebase deploy --only hosting --project zacksbasicstaticwebsite
   ```

The board subscribes to the top 25 scores. Joined visitors' clicks sync at most once every five seconds while clicking, or immediately with **Sync score now**. Database transactions preserve the higher existing score. A returning identity restores a higher shared total without replaying old touchdown animations. Local counting continues if the shared service is unavailable. Unsent local clicks are retried on reconnection or the next visit.

Rules allow each authenticated identity to create/update only its own entry, enforce names and safe nonnegative integer totals, prevent lowering a published total, and limit public queries to 25 entries. The app uses text nodes for names. These rules protect entry ownership, but the counts originate in the browser: this is a casual fan leaderboard, not a cheat-proof competition. Strong anti-cheat enforcement would require server-side click accounting. Users can also create multiple browser identities.

## Leaderboard development and rules checks

Use Firebase CLI and Java 21 or newer. The demo project prevents emulator tests from reaching production.

```sh
firebase emulators:start --only auth,firestore --project demo-eagles-leaderboard
```

In another terminal:

```sh
node tests/leaderboard-rules.mjs
```

Open `http://localhost:8000/counter.html?emulator=1` to connect to the local Auth emulator at port 9099 and Firestore emulator at port 8080. Emulator mode is accepted only on `localhost` and `127.0.0.1`, and uses project `demo-eagles-leaderboard`. Use two separate browser profiles to test rankings, tied scores, returning identities, and updates. Emulator test entries are not real visitors and never appear in production.

## Checks

```sh
node --check public/scripts/main.js
node --check public/scripts/theme.js
node --check public/scripts/counter.js
node --check public/scripts/leaderboard.js
node --check public/scripts/game.js
node --check public/scripts/kick.js
node --check public/scripts/games.js
```

Verify all pages in light/dark mode at phone and desktop widths. Check local counter persistence, every seventh-click touchdown, both games, field boundaries and collectibles, and leaderboard errors with the network disconnected. Player photo credits are in `public/assets/credits.txt` and linked on the site.

## New arcade games

- `jalen.html`: Where’s Jalen? has five edited real crowd photos, with smaller, more naturally blended appearances. Outfits and expressions vary; use his face and optional clothing clues. Scenes are fixed so hit areas match the final photographs. Use mouse/touch, 1–3× zoom/pan, or a keyboard crosshair and Enter.
- `barkley.html`: Barkley Bird uses Saquon’s photo and jersey number 26. Tap, click Flap, or use Space/Up while the canvas is focused. Gravity, obstacle and ground collisions, increasing speed, shrinking gaps, pause-on-hidden, restart, and a saved `barkleyBest` are included.
- Field goals now start with a 16% aiming window and faster meter; the window shrinks to 6.8% by the last kick. Crosswinds shift the aim point each attempt. The displayed green zone already accounts for wind.

### Barkley Bird global leaderboard

The game uses the same optional nickname and anonymous-browser identity as the click leaderboard, but stores a separate best score in `barkleyLeaders/{uid}`. It shares `leaderboardEnabled` and the production activation requirements above. Scores never decrease; each browser can edit only its own entry. The included emulator rules tests also cover this collection. Scores are client-reported and intended for a casual fan game.

For local multiplayer leaderboard testing, visit `http://localhost:8000/barkley.html?emulator=1` in separate browser profiles while the Auth and Firestore emulators run. No production database is used. Existing click totals and Field Run are preserved.

## Photo search and nickname entry update

Where’s Jalen? now uses five AI-edited real Eagles crowd photographs in `public/assets/search-level-1-v2.jpg` through `search-level-5-v2.jpg`. Each scene has a manually checked normalized target rectangle, photo loading/retry handling, 1–3× zoom, quadrant hints, and a keyboard crosshair (arrows, Shift for fine movement, Enter to guess). The game discloses the edits and links to the original fan gallery. The earlier vector crowd drawing is no longer used. These photo scenes are fixed so hit areas match the edited people; replay does not randomly relocate Jalen.

Barkley Bird now uses `public/assets/barkley-flight.png`, a transparent winged #26 character, with layered stadium scenery, broadcast scoring, dimensional obstacles, and updated page/card styling. Generated asset prompts and sources are saved in `public/assets/generated-assets.json` and `credits.txt`.

Leaderboard nickname inputs are always editable, even if Firebase setup or loading fails. A valid nickname saves as `fanNickname` locally and is reused on both leaderboard pages. With shared storage disabled, the submit button explicitly says **Save nickname on this browser**, and the response makes clear that the score has not been published. When Firebase is active, the same form joins the real shared board. No fake global entries are created.

## Fan locker and arcade polish

The homepage now has a **fan locker** showing the saved nickname, local click total, Barkley Bird best, field-goal best, and Jalen photos cleared. A validated last-game link appears both in the hero and locker. The main Games navigation opens the standalone `games.html` arcade lobby. It has its own featured game panel, four game cards, category filters, saved records, and a validated shortcut back to the last game played. All game pages link back to this lobby.

Five badges reflect actual saved milestones: seven clicks, a Field Run win, nine field-goal points, all five Jalen photos, and five Barkley Bird gaps. Field Run records each win once, even if the finished scene redraws. Existing records count toward badges. Notifications only appear for milestones reached during play; the homepage also shows progress toward locked badges. Records remain browser-local.

Where’s Jalen? now stores the current photo, found state, and wrong guesses in `jalenProgress` (version 3). Returning to a finished photo keeps the Next button usable; replay starts a new search while retaining the highest photo completion in `jalenCleared`. Invalid saved data falls back to the first photo. The progress strip shows the current search's five steps.

Barkley Bird has a Pause/Resume button and a P-key shortcut while the canvas is focused. Resume preserves velocity; choosing Flap while paused resumes with a flap. Switching tabs still pauses automatically. Field Run, Field Goals and Barkley Bird have **Expand game** controls when the native Fullscreen API is available. The expanded field includes its controls and an exit button; keyboard focus moves into the canvas.

`public/scripts/arcade.js` handles the locker, badges, continue links, and expanded views. Include it in syntax checks:

```sh
node --check public/scripts/arcade.js
```

Verified in Chrome: badge milestones; one-count-per-win; locker values and nickname; saved photo progress, completed-photo reload and replay; pause/resume/P; native fullscreen; all six pages in light/dark at widths 1440, 1024, 768, 390 and 320; malformed stored data and blocked browser storage. Production Firebase activation and deployment remain separate steps.

## Immediate flap input and harder photo round

Barkley Bird now handles Space/Up on `keydown` from the canvas, Flap button, or page background. It prevents the native delayed Space-on-button click on key release and ignores auto-repeat, other controls, nickname fields, and browser shortcut modifiers. A flap sets velocity to -360 px/s, applies an immediate 2 px lift, and redraws immediately; gravity is 1100 px/s² for a crisper response with similar jump height. Pause and pointer input are preserved.

The current Jalen round uses `search-level-1-v2.jpg` through `search-level-5-v2.jpg`, with calm/smiling real reference photographs, natural-size figures deeper in the crowd, different clothing, and matching focus/occlusion. Hint one gives only clothing information; hint two optionally outlines an area. The face reference is `jalen-reference.jpg`. The revised target rectangles were checked against the final images. The old headband clue no longer applies.

Saved progress is version 3 because all five photo locations changed. Older version-2 rounds restart at the first new photo; previous earned records and badges are retained. New version-3 progress still resumes normally. Current generated assets, exact built-in image_gen prompts, and refinements are recorded in `public/assets/search-hard-prompts.json`; original photo credits are in `credits.txt`.
