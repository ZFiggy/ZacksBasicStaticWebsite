# Sunday Arcade

A buildless, unofficial NFL fan arcade: 32 teams, ten game types, team selection, local records, and optional shared fan/team leaderboards. Deployable files live in `public/`; the optional Firebase aggregation backend lives in `functions/`.

## Quick start

```sh
python3 -m http.server 8000 --directory public
```

Open `http://localhost:8000/choose.html`. Direct links retain team selection, for example `index.html?team=cowboys` or `playbook.html?team=bears&game=pocket`. No frontend build or dependency installation is required.

## Current behavior and preferences

Local refresh checkpoint: **November 22, 2026**. The character/crowd refresh was checked locally across all 32 teams and 160 search rounds, including desktop/mobile layouts. This does not establish what is currently deployed.

- Front photos use equal landscape frames, clean source selections, and credits outside the home hero image. Bears and Broncos selections were replaced to avoid visible source marks.
- Non-Eagles search follows one named player in five real team crowd photographs. The current revision uses AI edits to integrate the player naturally into the selected real crowd photographs, following the original Eagles look. All 31 non-Eagles teams use five visually reviewed AI-integrated edits each (155 rounds). The original Eagles Jalen scenes are preserved. Every replacement player joined the featured team in 2015 or later. These are fictional appearances, disclosed beside each photo with crowd and portrait source links. Face references, clues, up to 6× zoom, keyboard controls, saving, and replay remain available.
- Preserve the original Eagles Jalen search and Flappy Bird gameplay/art unless requested otherwise. Eagles search still uses `search-level-1-v2.jpg` through `search-level-5-v2.jpg`; its target rectangles live in `jalen.js`. Eagles flight still uses `barkley-flight.png`.
- The other eight game types use illustrated runner, quarterback, kicker, and defender roles, team settings, and gameplay variants. Shared engines remain, but team identity should extend beyond names and color swaps.
- Light/dark themes, touch/keyboard controls, reduced-motion support, local records, badges, and team switching are supported. The scoreboard's `.team-leaderboard-link` panel has its own dark-theme styling in `teams.css`.

## Source map

Paths below are relative to `public/` unless prefixed with `tools/`, `tests/`, or `functions/`.

| Area | Files |
| --- | --- |
| Team chooser | `choose.html`, `scripts/choose.js` |
| Home / game lobby | `index.html`, `scripts/home.js`, `games.html`, `scripts/games.js` |
| Team identities / storage / scoring | `scripts/teams-data.js`, `scripts/teams.js` |
| Shared shell and appearance | `scripts/team-ui.js`, `scripts/theme.js`, `style.css`, `teams.css` |
| Game viewport sizing and instructions | `game-screen.css`, `scripts/game-screen.js` |
| Names, cards, photo credits, image drawing | `scripts/game-personality.js` |
| Team gameplay rules | `scripts/team-rules.js` |
| Four character roles and illustrated settings | `scripts/character-art.js`; canvas scenery: `scripts/team-art.js` |
| Field run / flight / field goals | `game.html` + `scripts/game.js`; `barkley.html` + `scripts/barkley.js`; `kick.html` + `scripts/kick.js` |
| Crowd search | `jalen.html`, `scripts/jalen.js`, `scripts/photo-scenes.js` |
| Six playbook games | `playbook.html`, `scripts/playbook.js`, `scripts/playbook-data.js` |
| Records, badges, continue links | `scripts/arcade.js` |
| Click scoreboard / visit counter | `counter.html`, `scripts/counter.js`, `scripts/main.js` |
| Fan/team rankings and opt-in publishing | `leaders.html`, `scripts/league-board.js`, `scripts/league-sync.js` |
| Backend validation and totals | `firestore.rules`, `firestore.indexes.json`, `functions/index.js`, `functions/aggregate.js` |

Initialization order matters: team core → generated data → game-personality → rules → character art where used → page UI/engine → game-screen layout. Check the affected HTML before moving scripts.

## Artwork and data precedence

Read small source manifests or query specific entries instead of dumping the large generated `personality-data.js` and `photo-scenes.js` files.

| Active input | Purpose |
| --- | --- |
| `assets/team-photos/clean-selection.json` | Clean team-picker/home photos; general photo provenance remains in `assets/team-photos/sources.json` |
| `assets/photo-search/consistent-crowd-scenes.json` | 31 teams × five crowd photo edits: one player identity, references, sources, full-head target rectangles; repaired sets use progress version 11 |
| `assets/photo-search/rounds/` | Active non-Eagles crowd photo edits |
| `assets/photo-search/real-sources/`, `real-players/` | Original crowd photos and photographic portrait/cutout inputs for reproducing the active composites |
| `assets/photo-search/real-player-sources.json` | Portrait attribution and checked team playing seasons for all 31 replacement players |
| `tools/real-search-placements.json`, `prepare-real-search.py` | Original selected photos, placement guides, source URLs, and legacy compositing helper; `render` refuses to overwrite accepted AI edits |
| `assets/characters/cast-0.png` … `cast-7.png` | Eight 4×4 atlases, four teams per sheet; columns: runner, quarterback, kicker, defender |
| `assets/characters/manifest.json` | 128 role mappings and character labels; runtime consumers also encode atlas ordering |
| `tools/character-art-prompts.json` | Built-in image-generation prompts, including the transparency correction |
| `assets/player-sprites/current-flight.json` | Current non-Eagles flight sprite selections |
| `assets/game-covers/<team>.png` | Illustrated settings used behind characters; Eagles sheet is 4×2, others 5×2 |
| `assets/game-covers/personality-sources.json` | Player identity/number/era input for generated browser data |
| `assets/credits.txt` | Existing photography and generated-art credits |

`node tools/build-game-art.mjs` validates inputs and rewrites `scripts/personality-data.js`, `scripts/photo-scenes.js`, and public artwork manifests. Its photo merge applies `consistent-crowd-scenes.json` **last**, overriding the older rotating-target and unrelated-scene datasets. It uses `clean-selection.json` for selection and hero photos. Update these inputs when making lasting changes.

For search-only changes, `node tools/build-game-art.mjs --search-only` validates the 31 player records and 155 rounds, then rewrites only `photo-scenes.js`. The selected original photos and players stay fixed. Built-in image_gen edits integrate the player’s head, neck, clothing, pose, lighting, and foreground occlusion. `tools/ai-search-receipts/` records each executed prompt and generated output; `tools/ai-search-pending.json` is empty after completion, with status recorded in `tools/ai-search-status.json`. `tools/ai-search-review.json` records visually selected full-head targets. `tools/adopt-ai-search.py` activates only teams with all five reviewed rounds. `tools/ai-search-edits.json` consolidates the generation receipts.

The subsequent naturalness review inspected all 155 replacements against the original photographs and flagged 87 for refinement. Thirty received new built-in image_gen edits for body connection, candid pose, head scale, caps, shade or foreground occlusion; 57 received only user-authorized local blur filters. Eight of the new AI repairs also received a small local blur adjustment. Filters preserve the existing AI integration and target rectangle; they never paste, move or resize a face. All 87 refinements were visually reviewed before activation as `*-ai-v2-*.jpg`; the other 68 rounds retain their accepted v1 images. Full-head targets were checked against each new AI output. The original Eagles photos and reference remain unchanged.

`tools/ai-search-naturalness-audit.json` records findings and resolutions; `tools/ai-search-repairs/` retains executed AI prompts, raw output paths, filter settings and reviewed targets. `tools/prepare-search-repairs.py` packages edits and makes contextual review boards. `tools/match-search-focus.py` applies the explicitly authorized blur adjustments; `--ai SIGMA KEY` starts from the new AI repair rather than its older v1 image. Filter-only settings are in `tools/ai-search-focus-settings.json`. Review every staged result before using the `accept` command, then activate and rebuild search metadata. Do not rerun the legacy compositor over these edits.

With `tools/real-search-requirements.txt` installed in a Python virtual environment, `python tools/prepare-real-search.py verify` checks original source hashes, portrait inputs, image integrity and size, bounded targets, reviewed AI output hashes, and localized insertions in the remaining legacy composites. `tools/review-ai-search.py TEAM` prepares candidate target review sheets using OpenCV YuNet and SFace models; these are proposals that require visual review. The old `render` command cannot recreate AI edits and refuses to overwrite them.

Known limitation: the builder's `assets/game-covers/manifest.json` still lists legacy cover selections. Runtime character-based cards are chosen by `scripts/game-personality.js`; that function is authoritative for the visible cards. The builder does not regenerate the character PNGs or their role manifest. Do not run regeneration just to inspect the site.

Older generated scenes, rotating-object photo-hunt manifests, SVG previews, mascot sheets, and sprite revisions remain archived on disk. They are not necessarily active. `scripts/team-search.js` is not loaded by the current search page; the old documented `photos=0` alternate is not wired up. Avoid reviving these accidentally.

Eagles progress uses `jalenProgress` version 3. Non-Eagles progress uses `photoSearchProgress` with the active manifest's version (currently 8). Both contribute to the team-scoped `jalenCleared` completion record. Scene/target changes should bump the relevant version while preserving best records unless a reset is requested.

## Records and scoring

Records use `nfl:<teamId>:<key>`; switching teams preserves each club's progress. Original unscoped Eagles records migrate once without deleting them. Blocked storage falls back to an in-memory session. Internal links retain team IDs; return paths are restricted to local pages.

Each game contributes `min(100, floor(rawRecord * 100 / target))` arcade points, for a maximum of 1,000. Fan clicks are ranked separately. Targets and record keys are defined in `scripts/teams.js`:

| Game ID | Engine / full-point target |
| --- | --- |
| `game` | Field run: 5 clears |
| `bird` | Flight: 20 gaps |
| `search` | Consistent-person crowd search: 5 scenes |
| `kick` | Field goals: 15 points |
| `pocket` | Passing: 10 completions |
| `shove` | Goal-line push: 5 touchdowns |
| `recall` | Route memory: 8 rounds |
| `punt` | Punting: 500 points |
| `blitz` | Turn-based escape: 3 fields |
| `signal` | Cipher: 1 call cracked |

Rules vary by team: return carries, ordered pickups, patrols or slippery turf; gust/approach variants; pump fakes, deep reads or called receivers; power/moving snap windows; reverse/mirror/rotation/pair audibles; punt surface/air effects; blitz keys/transformed fields; and distinct/repeating/six-choice ciphers. Treat `team-rules.js` plus the engine as authoritative, rather than assuming every team shares identical rules.

## Verification

For documentation-only edits, check the changed text, links, and `git diff --check`; game tests are unnecessary. For code changes, syntax-check the affected files with `node --check` and verify actual browser behavior.

Browser scripts require a static server on **8000**, dedicated Chrome with DevTools on **9224**, and Node with native `WebSocket`. They do not start those services. Start Chrome in a separate terminal from the static server, then run tests in another terminal:

```sh
'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' --headless --disable-gpu --remote-debugging-port=9224 --user-data-dir=/private/tmp/sunday-arcade-qa about:blank
```

```sh
node tests/team-identity-browser.mjs
node tests/photographic-search-browser.mjs
```

The current regression checks all homes, 160 search rounds, consistent identities, character loading, team mechanics, solvable blitz fields, cipher feedback, photo sizing, responsive layouts, and dark mode. `--search-only` checks homes/search. Older `personality-browser.mjs`, `game-screen-browser.mjs`, `visual-regressions-browser.mjs`, and `nfl-browser.mjs` may contain assertions about superseded artwork/modes; inspect those assertions before interpreting failures.

Visually review new photo targets against the final pictures: tests clicking metadata coordinates cannot establish that the right face is there or that the hunt is hard. Check new character sheets for real alpha transparency, correct role cells, readable size, and label overlap. Last local character validation found transparent corners and substantial empty alpha in all eight sheets.

## Shared leaderboard backend

Publishing is opt-in with a nickname and Firebase anonymous identity. A visitor can own one record per team; local games remain usable when shared services are unavailable. Browser-originated scores make this a casual leaderboard, not a cheat-proof competition.

- `leagueFans/{uid}_{teamId}`: owner-published team/game records and normalized totals.
- `teamStandings/{teamId}`: server-maintained aggregate across all published fans.
- `leagueContributions/{uid}_{teamId}`: private aggregation ledger preventing duplicate contributions.
- Existing `clickLeaders` and `barkleyLeaders` data/rules remain intact.

`functions/aggregate.js` applies transactional deltas from current fan state and the ledger; duplicate/out-of-order events must not double count. Rules validate ownership, fixed keys, bounded integers, monotonic records, normalization, timestamps, and bounded reads. Clients cannot write team totals.

Only the backend has npm dependencies; it declares Node 22. Install dependencies, start emulators in one terminal, and run tests in another:

```sh
npm ci --prefix functions --ignore-scripts
```

```sh
firebase emulators:start --only auth,firestore --project demo-eagles-leaderboard
```

```sh
node tests/league-rules.mjs
node tests/leaderboard-rules.mjs
```

Rules tests use Auth **9099** / Firestore **8080**. Keep the automatic Functions trigger stopped for `league-rules.mjs`, which drives aggregation directly. `tests/league-browser.mjs` instead requires Auth, Firestore, **and Functions** and uses the fixed demo project's fixtures. Use `leaders.html?team=eagles&emulator=1`; never point fixture-clearing tests at production. A stopped emulator causes connection-refused errors, not evidence of a gameplay regression.

Deployment of hosting, rules, indexes, functions, or billing changes is a separate, explicitly authorized action. Check `firebase.json` and `.firebaserc` before deploying; do not assume local changes are live.

## Credential safeguards

Follow `AGENTS.md`: agents must not read or load real `.env` / `.env.*` credential files, including root `.env.local`. Keep them outside `public/`, ignored, and owner-only (`0600`). Sanitized example/sample files are the exception. No credentials belong in tracked files or browser assets. The existing restricted Firebase browser key is intentionally public; this exception does not extend to other keys. Keep `.githooks` enabled and do not broaden secret-scanner exceptions.
