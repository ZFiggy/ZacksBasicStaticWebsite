# Sunday Arcade

A buildless, unofficial NFL fan arcade: 32 teams, five game types, team selection, local records, and optional shared fan/team leaderboards. Deployable files live in `public/`; the optional Firebase aggregation backend lives in `functions/`.

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
- The three football game types use illustrated runner, quarterback, kicker, and defender roles, team settings, and gameplay variants. Shared engines remain, but team identity should extend beyond names and color swaps.
- Flight and crowd search use compact headers, collapsible controls help, and full-width arena panels. Crowd search preserves all original scenes, targets, and saved progress.
- Light/dark themes, touch/keyboard controls, reduced-motion support, local records, badges, and team switching are supported. The scoreboard's `.team-leaderboard-link` panel has its own dark-theme styling in `teams.css`.

## Source map

Paths below are relative to `public/` unless prefixed with `tools/`, `tests/`, or `functions/`.

| Area | Files |
| --- | --- |
| Team chooser | `choose.html`, `scripts/choose.js` |
| Home / game lobby | `index.html`, `scripts/home.js`, `games.html`, `scripts/games.js` |
| Team identities / storage / scoring | `scripts/teams-data.js`, `scripts/teams.js` |
| Shared shell and appearance | `scripts/team-ui.js`, `scripts/theme.js`, `style.css`, `teams.css` |
| Game viewport sizing and instructions | `game-screen.css`, `search-flight.css`, `scripts/game-screen.js` |
| Names, cards, photo credits, image drawing | `scripts/game-personality.js` |
| Team gameplay rules | `scripts/team-rules.js` |
| Featured character art and illustrated settings | `scripts/character-art.js`; canvas scenery: `scripts/team-art.js` |
| Animated football roster | `scripts/player-roster.js` + `scripts/player-motion.js`: named real-player supporting cast and animated featured runners, quarterbacks, and kickers; loaded only by the three football games |
| Touchdown Rush / flight / field goals | `game.html` + `scripts/game.js`; `barkley.html` + `scripts/barkley.js`; `kick.html` + `scripts/kick.js` |
| Crowd search | `jalen.html`, `scripts/jalen.js`, `scripts/photo-scenes.js` |
| Passing Drive (legacy playbook engine retained) | `playbook.html`, `scripts/playbook.js`, `scripts/playbook-data.js` |
| Records, badges, continue links | `scripts/arcade.js` |
| Click scoreboard / visit counter | `counter.html`, `scripts/counter.js`, `scripts/main.js` |
| Fan/team rankings and opt-in publishing | `leaders.html`, `scripts/league-board.js`, `scripts/league-sync.js` |
| Backend validation and totals | `firestore.rules`, `firestore.indexes.json`, `functions/index.js`, `functions/aggregate.js` |

Initialization order matters: team core → generated data → game-personality → rules → character art where used → page UI/engine → game-screen layout. Check the affected HTML before moving scripts.

## Touchdown Rush

`game.html` combines the old Field Run and Blitz Escape into a horizontal football chase. The field uses the page width; phones have a larger, horizontally scrolling view that follows the runner, plus a Full field overview toggle. Drag to scout ahead. Hold arrows/WASD or the touch buttons to run, Space/Wait spends one turn, and P pauses. Collect the football before entering the right end zone. Stationary rivals block tiles. Moving defenders chase the runner’s new position along shortest paths around those blockers, with a second move on burst turns. Friendly teammates prevent chasers entering their tile and its four orthogonal neighbors. The outlined green tiles mark that protection explicitly; diagonals are excluded. A tackle requires exact tile contact, either by stepping onto a chaser or being reached during its response. Adjacent tiles do not cause tackles. Standing rivals use a square marker and only block movement; pursuing rivals use an exclamation marker. Every immediate move and Wait has a prediction computed by the same `step` simulation: SAFE, SHIELDED, TACKLE, BLOCKED, SCORE, or NO STEPS. Field destination markers and an explicit two-move burst banner mirror those predictions. SAFE describes the next turn only. Turnover messages distinguish contact, chase/burst contact, and possession lost when the step allowance expires.

`public/scripts/touchdown-rules.js` owns generation, the chase simulation, and A* route verification. Search tracks position, possession, every defender’s position, and burst cadence, with an admissible distance estimate so the verified route provides a shortest-route star target. Generation uses bounded retries and a verified fallback. Each accepted field has a complete legal winning route and a small step allowance beyond it. Difficulty increases through more blockers, more pursuing defenders, more frequent bursts, and less spare allowance, reaching expert pressure at level 12. Coach hint searches from the actual current state within the remaining allowance. A poor route can still lose; a bounded hint search can also fail to find a route. Retry reproduces the same seed.

Each unused step earns 100 bonus points on top of 600 touchdown points. Matching the shortest route earns three stars, finishing within two additional steps earns two, and other legal touchdowns earn one. Every coach hint costs 250 points and caps the award at one star. The scoreboard shows the shrinking step bonus and best drive score. Losing triggers a strip/recovery and animated rival return around the blockers to the left end zone. The runner falls, the defender carries the ball, and the game announces the defensive touchdown before offering a retry. Skip return and Retry field interrupt safely; reduced-motion mode uses short held poses instead of a moving return.

Team-scoped `touchdownRushProgress` saves level/seed, `touchdownRushBest` saves the highest level cleared, `touchdownRushPointsBest` saves the best drive points, and each touchdown increments the existing `fieldRunWins` record. Completing a level saves the next round immediately to prevent duplicate wins on reload. Old `playbook.html?game=blitz` links redirect to this game with team selection retained. The lobby has five games: Touchdown Rush, Passing Drive, field goals, flight, and crowd search. Goal-Line Shove, Route Recall, Pin Punt, and Signal Cipher are retired; their old URLs redirect to the team lobby. The fan scoreboard remains available alongside the five games. Retired game records remain in browser storage but no longer contribute arcade points.

## Passing Drive

`playbook.html?game=pocket` now combines Pocket Read's quarterback decisions, Route Recall's route concepts, and live defensive pursuit. Call Slants, Flood, or Cross; snap with Space, move the quarterback with arrows/WASD or held touch buttons, and throw with 1–3 or by tapping a receiver. Bullet passes are fast and vulnerable to underneath coverage; lobs clear underneath defenders but give coverage time to close. The user controls the receiver after a catch. Each down chooses a seeded defensive look: press man, off man, Cover 2, Cover 3, man blitz, or robber. Front width, defender cushion, safety depth, and the number of rushers vary. Two blockers can delay two rushers for 2.4 seconds; overloads can leave a third rusher free. Zone defenders guard space; split safeties track their own halves. Each route concept varies depth, width, release spacing, and direction. Audibles preserve the defensive look and the underlying variation for that down. The quarterback stays behind the line of scrimmage while passing. Q / Tuck & run switches to a quarterback scramble and closes passing for that snap. T / Throw away consumes a down without losing yards. Hold Shift / Sprint while moving for a 26% speed burst. Each play has about 1.8 seconds of total burst, with no recovery until the next down. The visible energy bar shows the remaining budget. Receivers jog at 6.5 yards/second, quarterbacks at 5.4, and pursuit closes at 7.15. A receiver burst can briefly create separation; a quarterback cannot outrun pursuit in the open field. P pauses; hiding or leaving the tab pauses the play.

Three possessions start at the own 25. Four downs gain ten yards, first downs reset the series, and touchdowns score six points. Sacks lose field position; incompletions consume a down; interceptions, safeties, and failed fourth downs end a possession. Unfinished drives save between plays in team-scoped `passingDrive-v1`; an interrupted live snap restarts from its previous checkpoint. `passingPointsBest` stores the best points total, while `playbook-pocket-best` retains completion records and existing leaderboard/badge compatibility, including historical Pocket Read records. The arcade offers five games.

Passing Drive uses a full-width field with controls in a separate right-hand console on wide screens. At tablet and phone widths, controls stack beneath the field. The canvas no longer shrinks to a viewport-height formula. Field Goals groups wind, aim, and trajectory above the meter and primary kick button; Pause, New round, and Demo share a secondary row below the distance-labeled kick history. Each five-kick round assigns left, middle, and right hash situations, with a visible change on every attempt. Hash positions are fixed for the attempt. The formation shifts vertically, and the setup panel names the assigned hash. Kicker/holder labels and a team-color field key explain the formation; protection buttons identify the far, middle, and near lanes. Off-center kicks require aim compensation; shorter kicks have sharper hash angles, while long kicks have smaller angular openings. The geometry uses the NFL 18-foot-6-inch hash spacing and upright width, with clearance for the ball. Aim for wind & hash suggests compensation for the selected arc. The live range estimate distinguishes short power from enough distance, and the single power meter shows enough range for the current arc and air conditions. After power is locked, steer the white aiming dot horizontally with Left/Right, A/D, or held touch buttons and release while it is in the green zone above the posts; there is no accuracy timing bar. Pause freezes the meter and rush without using a kick. On phones the setup hides during active kicks, and the field scrolls into view so the release controls fit beside the action. Its fixed camera and uprights make the 25/33/40/47/55-yard progression visible: the kicker, ball, and both lines move back together, with distance shown in the console. Manual aim adjustment expands on demand. Passing Drive participates in the shared device-pixel-density canvas sizing so the larger field and character art render sharply on high-density displays.

Passing Drive uses the shared five-step animated demo in `scripts/game-demo.js`. The first gameplay input offers Show demo / Skip demo; `How to play · Demo` reopens it. The browser-wide `sundayArcade.demo.passing-drive` choice is independent of rushing and kicking demos and persists across team changes. Replaying during a live snap pauses the passing game; close the demo and choose Resume to continue. Demo animations do not spend attempts or change scores, and reduced-motion preferences start the walkthrough paused.

`scripts/passing-rules.js` owns DOM-independent drive transitions; `scripts/passing.js` owns the real-time game, controls, and canvas. Every completed play emits `football:play-result` with the before/after drive state and the play result. These are foundations for a later combined run/pass/kick game; the three games do not yet share a live drive or transfer possessions between pages. Existing rushing and kicking engines remain independent.

The three football games use `scripts/player-motion.js` for named team receivers, linemen, holders, cornerbacks, safeties, and rushers. Eight new `roster-0.png` through `roster-7.png` atlases add 128 illustrated supporting sprites based on real 2024 team players, with names, jersey numbers, and roster sources in `assets/characters/expanded-roster.json`. This is a season-based supporting cast alongside the established featured stars, not a live roster service. After updating the authoritative roster JSON, run `node tools/build-player-roster.mjs`; `--check` verifies that browser identities match it. Four `motion-core-0.png` through `motion-core-3.png` atlases add 64 standing quarterback/kicker sprites. Their card art remains unchanged. Eight six-column `actions-*.png` atlases supply 192 drawn quarterback windup/release/follow-through and kicker backswing/contact/follow-through frames. Eight `run-cycle-*.png` atlases supply 128 four-frame featured-player run poses. The renderer draws complete bodies and uses one shared crop per animation group to keep head size and planted feet stable. Supporting players retain their own complete art with subtle footwork. Passing includes a windup before ball release; kicking shows an approach, plant, strike, and follow-through before flight. Running, blocking, throwing, catching, and kicking use separate poses; reduced-motion mode suppresses gait motion. Live status has dedicated space adjacent to the field so it does not cover players. Passing routes remain visible during the read, with an explicit play-result panel after the whistle; rushing adds a short touchdown confetti animation.

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

The subsequent naturalness review inspected all 155 replacements against the original photographs and flagged 87 for refinement. Thirty received new built-in image_gen edits for body connection, candid pose, head scale, caps, shade or foreground occlusion; 57 received only user-authorized local blur filters. Eight of the new AI repairs also received a small local blur adjustment. Filters preserve the existing AI integration and target rectangle; they never paste, move or resize a face. All 87 refinements were visually reviewed before activation as `*-ai-v2-*.jpg`; the other 68 rounds retain their accepted v1 images. Full-head targets were checked against each new AI output. The original Eagles crowd photos remain unchanged. Search references now show complete ESPN head-and-shoulders portraits instead of neck-cropped cutouts; the Eagles reference uses `real-players/eagles.png` from `https://a.espncdn.com/i/headshots/nfl/players/full/4040715.png` (ESPN, Jalen Hurts).

`tools/ai-search-naturalness-audit.json` records findings and resolutions; `tools/ai-search-repairs/` retains executed AI prompts, raw output paths, filter settings and reviewed targets. `tools/prepare-search-repairs.py` packages edits and makes contextual review boards. `tools/match-search-focus.py` applies the explicitly authorized blur adjustments; `--ai SIGMA KEY` starts from the new AI repair rather than its older v1 image. Filter-only settings are in `tools/ai-search-focus-settings.json`. Review every staged result before using the `accept` command, then activate and rebuild search metadata. Do not rerun the legacy compositor over these edits.

With `tools/real-search-requirements.txt` installed in a Python virtual environment, `python tools/prepare-real-search.py verify` checks original source hashes, portrait inputs, image integrity and size, bounded targets, reviewed AI output hashes, and localized insertions in the remaining legacy composites. `tools/review-ai-search.py TEAM` prepares candidate target review sheets using OpenCV YuNet and SFace models; these are proposals that require visual review. The old `render` command cannot recreate AI edits and refuses to overwrite them.

Known limitation: the builder's `assets/game-covers/manifest.json` still lists legacy cover selections. Visible cards are chosen by `scripts/game-personality.js`; that function is authoritative. Touchdown Rush, Passing Drive, and Field Goals use the complete AI-rendered play scenes in the original chunky 3D sprite style in `assets/game-covers/sprite-plays-v1/`, with one three-row atlas per team (rushing, passing, kicking). Each panel redraws the characters in football action from an oblique sideline view and uses a different field location, background, and lighting. Sources, panel order, and image hashes are recorded in that directory's `manifest.json`; exact final generation briefs and receipts are in `tools/ai-sprite-play-covers/standardized/`. The original NFC East character sheet is the style master for every team, so non-NFC-East characters keep the same exaggerated heads, compact bodies, and cartoon materials. Visible-faced offensive players are helmetless; back-facing offense without visible facial features and all defenders wear helmets. These illustrations do not depict actual games. The original character atlases remain the gameplay assets. `node tests/play-covers-browser.mjs` checks all 96 cover panels and responsive home/lobby rendering and writes contact sheets to `/private/tmp/ai-play-covers-*.jpg` for visual review. `node tools/build-play-cover-map.mjs` updates the browser crop map from the reviewed manifest and verifies image hashes. The builder does not regenerate these PNGs. Do not run regeneration just to inspect the site.

Older generated scenes, rotating-object photo-hunt manifests, SVG previews, mascot sheets, and sprite revisions remain archived on disk. They are not necessarily active. `scripts/team-search.js` is not loaded by the current search page; the old documented `photos=0` alternate is not wired up. Avoid reviving these accidentally.

Eagles progress uses `jalenProgress` version 3. Non-Eagles progress uses `photoSearchProgress` with the active manifest's version (currently 8). Both contribute to the team-scoped `jalenCleared` completion record. Scene/target changes should bump the relevant version while preserving best records unless a reset is requested.

## Records and scoring

Records use `nfl:<teamId>:<key>`; switching teams preserves each club's progress. Original unscoped Eagles records migrate once without deleting them. Blocked storage falls back to an in-memory session. Internal links retain team IDs; return paths are restricted to local pages.

Each activity contributes `min(maxPoints, round(rawRecord * maxPoints / target))` arcade points. Add the six rounded contributions for a maximum of 1,000 per fan, per team. Partial progress earns credit; retired games contribute nothing. Targets and record keys are defined in `scripts/teams.js` and shared by the home page and leaderboard clients:

| Activity | Saved record | Full-point target | Arcade points |
| --- | --- | --- | --- |
| Touchdown Rush | `touchdownRushBest` | 10 levels cleared | 200 |
| Flight | `barkleyBest` | 25 points in one flight | 200 |
| Passing Drive | `passingPointsBest` | 18 points across three drives | 200 |
| Field goals | `fieldGoalBest` | 15 points in one round | 100 |
| Crowd search | `jalenCleared` | 100 search points (20 per scene, five scenes) | 100 |
| Fan scoreboard | `clickCount` | 200 touchdowns (1,400 clicks) | 200 |

Rush uses the highest level cleared, so replaying a cleared field does not add progress. Search keeps its scene-based best record; its displayed points are scenes × 20. Scoreboard credit includes clicks toward the next touchdown. Bests can exceed the targets while arcade contributions remain capped.

Shared records use `scoringVersion: 2`, five active game records, and six contribution scores (including `scoreboard`, calculated from `clicks`). On the next successful sync, legacy published records retain flight, search, kick and click progress. Historical Rush wins and passing completions cannot be converted into cleared levels or game points; current browser bests supply those records instead. Stored legacy retired records are not restored or scored. New Firestore rules must be deployed alongside hosting for version 2 writes; existing published totals migrate as fans sync, so a code change alone does not recalculate every historical public entry.

Touchdown Rush replaces Field Run and Blitz Escape for all teams. Other rules vary by team: gust/approach variants; pump fakes, deep reads or called receivers; power/moving snap windows; reverse/mirror/rotation/pair audibles; punt surface/air effects; and distinct/repeating/six-choice ciphers. Treat `team-rules.js` plus the engine as authoritative, rather than assuming every team shares identical rules.

Field Goals now uses a different division rival from Touchdown Rush for each team. Set aim and choose Drive, Balanced, or High arc before snapping; read and protect the announced rushing lane, lock power, then steer and release before the defensive rush arrives. Five attempts grow from 25 to 55 yards, with shifting crosswinds, headwinds/tailwinds, and changing rush lanes. Matching protection buys 0.75 seconds; the release countdown includes the 820ms kick windup. Higher arcs improve block clearance but reduce distance, and wind affects high arcs more. Three points per make and the existing team-scoped best out of 15 remain compatible with rankings. Physics and rival selection live in `public/scripts/kick-rules.js`; rendering and controls live in `kick.js` and `kick.css`.

## Verification

Touchdown Rush uses twenty five-yard turf columns, two ten-yard end zones, and a field width of 53⅓ yards. Its yard lines, numbers, and one-yard hashes use NFL dimensions: the inside edges of the hashes are 70′9″ from the sidelines, and each hash is two feet long. See the [NFL field markings](https://operations.nfl.com/the-rules/nfl-rulebook). The eleven movement rows approximate five-yard tiles across the field; painted hashes are independent of the movement grid. Touchdowns occur on entry into the end zone.

The Rush generator verifies routes using the same pursuit simulation as gameplay. Blocker/defender counts rise and bursts accelerate through level 12; spare steps decrease to two. Higher levels retain that pressure cap. A bounded fallback uses a finite family of solved layouts at the same pressure settings. `node tests/touchdown-rules.mjs` covers generated routes, fallback routes, boundaries, difficulty settings, and scoring.

All five games share their navigation labels and order from `teamArcade.games`. `scripts/game-view.js` and `game-view.css` provide fullscreen with controls and live game information, plus a viewport fallback when native fullscreen is unavailable. Exit full screen or Escape restores the ordinary view without resetting the game. `node tests/game-view-browser.mjs` checks navigation and fullscreen across teams, screen sizes, and themes.

For documentation-only edits, check the changed text, links, and `git diff --check`; game tests are unnecessary. For code changes, syntax-check the affected files with `node --check` and verify actual browser behavior.

`node tests/arcade-points.mjs` verifies scoring math and team isolation. `node tests/arcade-points-browser.mjs` verifies all team home dashboards, search points, and responsive layouts. Add `--sync` with Auth/Firestore emulators running to verify publication, background sync, and restoration.

Browser scripts require a static server on **8000**, dedicated Chrome with DevTools on **9224**, and Node with native `WebSocket`. They do not start those services. Start Chrome in a separate terminal from the static server, then run tests in another terminal:

```sh
'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' --headless --disable-gpu --remote-debugging-port=9224 --user-data-dir=/private/tmp/sunday-arcade-qa about:blank
```

```sh
node tests/passing-rules.mjs
node tests/passing-browser.mjs
node tests/football-refinements-browser.mjs
node tests/roster-gameplay-browser.mjs
node tests/kick-rules.mjs
node tests/kick-browser.mjs
node tests/touchdown-rules.mjs
node tests/touchdown-browser.mjs
node tests/team-identity-browser.mjs
node tests/photographic-search-browser.mjs
```

The current regression checks all homes, 160 search rounds, consistent identities, character loading, team mechanics, Touchdown Rush scoring, cipher feedback, photo sizing, responsive layouts, and dark mode. `--search-only` checks homes/search. Older `personality-browser.mjs`, `game-screen-browser.mjs`, `visual-regressions-browser.mjs`, and `nfl-browser.mjs` may contain assertions about superseded artwork/modes; inspect those assertions before interpreting failures.

Visually review new photo targets against the final pictures: tests clicking metadata coordinates cannot establish that the right face is there or that the hunt is hard. Check new character sheets for real alpha transparency, correct role cells, readable size, and label overlap. Last local character validation found transparent corners and substantial empty alpha in all eight sheets.

## Shared leaderboard backend

Publishing is opt-in with a Firebase anonymous identity. Flight rankings also require a public nickname. A visitor can own one record per team; local games remain usable when shared services are unavailable. Browser-originated scores make this a casual leaderboard, not a cheat-proof competition.

- `leagueFans/{uid}_{teamId}`: owner-published team/game records and normalized totals.
- `teamStandings/{teamId}`: server-maintained raw scoreboard click totals across all published fans; the main leaderboard ranks teams by `clicks`. Arcade point aggregates remain stored for compatibility.
- `leagueContributions/{uid}_{teamId}`: private aggregation ledger preventing duplicate contributions.
- Flappy pages embed a separate top-25 board from `leagueFans`, ordered by raw `records.bird`, showing nickname, represented team, and flight points. The desktop board occupies the space beside the field; narrow screens place it below the game.
- Existing `clickLeaders` and `barkleyLeaders` data/rules remain intact as legacy data; active pages use the team-aware records.

`functions/aggregate.js` applies transactional point and click deltas from current fan state and the ledger; duplicate/out-of-order events must not double count. Rules validate ownership, fixed keys, bounded integers, monotonic records, normalization, timestamps, and bounded reads. Clients cannot write team totals.

After separately authorized deployment, existing records need a one-time click backfill. `node functions/backfill-clicks.cjs PROJECT_ID --apply` uses the Admin SDK’s normal credentials and never loads repository environment files. It initializes missing team click totals, then reapplies existing fan contributions; reruns are idempotent. Do not run it against production without authorization. A new fan update also backfills that fan’s clicks automatically.

`node tests/field-layout-rankings-browser.mjs` checks responsive layouts, both football utility rows, B toggling, fullscreen, and aspect-preserving end-zone art for all 32 teams. `node tests/scoreboard-flight-browser.mjs` verifies publishing/restoration and the separate boards against the local Auth/Firestore emulators (no Functions trigger required). The existing league rules suite also checks click-only updates, duplicate events, legacy contribution backfill, and removals.

Passing Drive and Touchdown Rush share a **Controls & scoring** / **Full screen** utility row below the field. Instructions use control/action pairs and separate rules/scoring lists. In Passing Drive, **B** switches Bullet/Lob before the throw; the touch button remains available. End-zone branding faces midfield with uniform artwork scaling; sideline yard numbers face the field’s interior.

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

### Current passing and kicking rosters

`node tools/update-rosters.mjs` fetches public ESPN active rosters and depth charts for all 32 teams, validates position pools and jersey numbers, and updates `public/assets/characters/current-rosters.json` and its browser companion `scripts/current-rosters.js`. `node tools/update-rosters.mjs --check` validates the saved snapshot without network access. No API key or frontend network fetch is needed. `--in-season` skips March–July.

Passing Drive and Field Goals use these snapshots for jersey numbers, names, and distinct on-field assignments. Players on injured reserve, suspended lists, or practice squads are excluded. Depth-chart ordering takes priority when supplied; missing slots use roster ordering, with WRs preferred for routes. This is a weekly roster snapshot, not a live game-day availability report. `tools/roster-role-overrides.json` records sourced, reviewed role preferences; preferences apply only while the player remains active and position-eligible. Holders default to the team's punter; the Eagles' Braden Mann assignment is checked against their official depth chart. Other teams' holder assignments are inferred, not individually confirmed.

`.github/workflows/weekly-rosters.yml` proposes a roster update pull request every Tuesday from August through February, and can be run manually in GitHub Actions. It becomes available after these files are pushed to the default branch. The repository must permit Actions to create pull requests. It does not merge or deploy updates; the published site changes only through the usual separately authorized release. A failed fetch or incomplete team leaves the previous snapshot intact.

Passing and kicking now render jointed canvas athletes in `scripts/football-players.js`, with connected limbs, readable current numbers, and separate throw, catch, interception, contact, blocking, holder, jumping, and kick poses. The original Eagles search and Flappy artwork are unchanged. Eagles end-zone logo source: https://a.espncdn.com/i/teamlogos/nfl/500/phi.png (ESPN team logo; Philadelphia Eagles trademark, unofficial fan use).

### Individualized football sprites

Passing Drive and Field Goals use illustrated player-specific heads on one shared canvas skeleton. Faces, hair, headbands, and facial hair are generated from the credited player portraits in `tools/player-likenesses/queue.json`. All 544 current on-field identities (17 per team) have separate artwork, indexed by stable roster ID. The jersey retains its current number. Passing receivers carry color-matched 1–3 key badges that follow their routes and can be tapped to throw; completion and interception messages identify the catcher by name and jersey number. Other floating names and position labels are omitted. Height and weight affect body proportions, with smaller portrait heads, padded silhouettes, and wrist-tape variations. A shared articulated rig keeps arm and leg lengths fixed. Running steps advance with distance traveled, route corners are rounded, and receivers keep striding as they gather the catch. Paired linemen share a contact plane and sustain hand/weight shifts until a rusher sheds the block. Kicking uses a snap/reception, placement, approach, plant, strike at 820ms, follow-through, and landing sequence. Supporting players continue animating throughout flight, and ball contact uses the same foot/hand geometry as the drawn athletes. Shared end-zone painting lives in `scripts/football-field.js`.

Original generated head atlases are in `public/assets/characters/likenesses/heads-00.png` through `heads-15.png`. `manifest.json` stores source rectangles, sampled skin colors, and portrait credits. `tools/player-likenesses/generation.json` records the built-in image-generation prompt and reference order. Atlas indexing reads and validates alpha transparency without repainting the artwork. Re-downloadable portrait references and reference contact sheets are ignored by Git; source URLs, preparation code, prompts, queue, and final game artwork are retained.

Run `node tools/check-player-likenesses.mjs` to verify that every on-field roster slot has the correct individualized asset and that browser metadata agrees with the source manifest. Weekly roster checks now include this gate: trades involving an already illustrated player keep that player's face, but a newly featured player requires reviewed cartoon art before the roster update passes. No other player's face is substituted. To prepare references for a new roster, use `node tools/prepare-player-likenesses.mjs`; it writes missing identities to `tools/player-likenesses/pending-queue.json` and preserves the accepted queue. Pass `pending-queue.json` to `prepare-references.py` to create new reference sheets. Append new reviewed artwork and manifest entries rather than overwriting accepted faces or IDs. The manifest indexing helper uses Python with Pillow, NumPy, and OpenCV; this is artwork tooling only, with no frontend dependency or build step.

`node tests/football-animation-browser.mjs` checks all 544 loaded likenesses, unique identities, quarterback jersey rendering, paired tackles, interception possession, finite end zones, kick contact, and defensive block contact. It uses the same preview and Chrome prerequisites as the other browser tests.

`node tests/football-motion-browser.mjs` checks constant limb lengths across interpolated poses, receiver badge tracking and targeting, named catches and interceptions, paired protection, pause, moving kick support, and rendered foot/ball and block contact. It saves pose and gameplay sequence sheets under `/private/tmp/football-*.png` for visual review, using the same preview and Chrome prerequisites.

The shared end-zone renderer now uses locally cached team logos and actual wordmark silhouettes for the other 31 teams, with team-specific paint families and Bengals stripe patterns. The accepted Eagles treatment is preserved. These are representative home-field-inspired designs, not exact season-by-season stadium replicas. Artwork provenance is recorded in `public/assets/field-branding/credits.json`; `node tools/prepare-field-branding.mjs` refreshes the assets from ESPN and the [nflverse wordmark archive](https://github.com/nflverse/nflverse-pbp/tree/master/wordmarks). Paint references include the [Bengals' field description](https://www.bengals.com/news/bengals-fashion-change-727230), [49ers red end-zone photos](https://www.49ers.com/photos/gameday-ready-49ers-red-end-zones-are-back-divisional-playoffs-san-francisco-levis-stadium), and [Steelers gold end zones](https://www.steelers.com/news/steelers-to-wear-color-rush-uniforms-vs-ne).

Animation mechanics use a consistent throwing arm and the opposite lead foot, with a planted lead foot and weight transfer through release. Kicking uses one striking leg through backswing, contact and recovery, with the opposite foot planted through contact. The renderer tapers muscle and fabric shapes around fixed joints instead of outlining each bone as a pipe. Mechanics references: [USA Football footwork and weight transfer](https://blogs.usafootball.com/blog/1283/U.S.%20National%20Team%20Regionals%3A%20The%20Journey%20to%20International%20Bowl%202019), [USA Football follow-through](https://blogs.usafootball.com/blog/5528/how-to-frame-your-quarterback-for-success), and [Northwestern's field-goal technique](https://www.northwestern.edu/magazine/fall2015/campuslife/how-to-kick-a-field-goal.html). The motion browser check verifies the planted feet, same-leg kick, live steering, pause, all field-branding assets, and produces a 32-team end-zone review sheet.

Running arm poses keep elbows below the shoulders and preserve a relaxed bend through each stride. Sleeves overlap the torso, and continuous shading across limb segments softens shoulder, elbow, and knee joins. The motion browser check also verifies arm continuity across a full stride at several movement speeds.
