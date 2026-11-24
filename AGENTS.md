# Repository Guidelines

## Interacting with the User

The user is a student and may make incorrect claims or assumptions. Prioritize accuracy and understanding over agreement.

- Always assess factual claims and technical assumptions before relying on them. Check repository code, reproducible behavior, or authoritative documentation as appropriate; use current sources for information that may have changed.
- Correct mistakes directly and respectfully. Explain what is incorrect, why, and what the accurate statement is, using a small example when helpful.
- Distinguish verified facts, assumptions, and uncertainty. If a claim cannot be verified, say so instead of presenting it as true.
- Do not agree merely to be encouraging. Also acknowledge when the user's reasoning is correct, with a brief explanation when useful.
- Use clear, student-friendly language, define unfamiliar terms, and explain the reasoning behind important changes. Avoid condescension or unnecessary detail.
- Treat preferences as preferences, rather than factual claims to challenge. Ask for clarification when ambiguity materially affects the work.

## Project Map: Start Here

This is **Sunday Arcade**: a buildless static NFL fan arcade with 32 teams and ten game types, served from `public/`. Optional Firebase aggregation lives in `functions/` (its own package/lockfile). There is no frontend package manifest or build step. See README sections for details; avoid reading giant generated data files wholesale.

| Task | Start with |
| --- | --- |
| Team selection, URLs, scoped records, point targets | `public/scripts/teams.js`, `teams-data.js`, `choose.js` |
| Home, lobby, shared page personalization | `public/scripts/home.js`, `games.js`, `team-ui.js` |
| Theme/layout, viewport fitting | `public/style.css`, `teams.css`, `game-screen.css`, `scripts/game-screen.js` |
| Game titles, covers, photo credits | `public/scripts/game-personality.js` |
| Playable characters | `public/scripts/character-art.js`, `public/assets/characters/manifest.json` |
| Per-team gameplay variants | `public/scripts/team-rules.js` and the relevant game engine |
| Field run / flight / kicks / search | `public/scripts/game.js`, `barkley.js`, `kick.js`, `jalen.js` respectively |
| Pocket, shove, recall, punt, blitz, signal | `public/scripts/playbook.js`, `playbook-data.js` |
| Shared rankings and aggregation | `public/scripts/league-board.js`, `league-sync.js`, `functions/aggregate.js`, `firestore.rules` |

Grouped bare filenames in the map share the preceding file's directory; asset paths below are relative to `public/`.

Script order matters: team data/core → photo/personality data → game-personality → team rules → character art where used → UI/engine → game-screen layout. Read the affected HTML's actual script order before changing initialization.

### Current user preferences and asset sources

- Front photos must have equal landscape frames and no visible watermarks. `assets/team-photos/clean-selection.json` selects front photos; hero credits appear outside the images.
- Each non-Eagles search follows **one named person across all five crowded team-related photos**, with a face reference and high visual difficulty. Active source: `assets/photo-search/consistent-crowd-scenes.json`; images: `assets/photo-search/rounds/`. Do not restore the rotating-person/object hunt or unrelated markets/stations/fairs.
- Keep the selected real crowd photographs and recent players (joined the featured team in 2015 or later). The user requests **AI editing to integrate each player naturally as a whole person**, matching the original Where's Jalen scenes and difficulty; pasted photographic face cutouts are rejected. Preserve the real backgrounds, fit bodies/poses/lighting/occlusion to the scene, and visually review each final target. Original source/placement records are in `tools/real-search-placements.json`; portrait sources and verified team seasons are in `assets/photo-search/real-player-sources.json`. Keep sources and credits. Use `node tools/build-game-art.mjs --search-only` for search metadata, then visually inspect the final insertions and run both search browser checks. The conventional compositor is a legacy input/review tool and must not overwrite accepted AI edits.
- The user explicitly authorized precise local Python blur filters for focus-only corrections. Keep AI editing for body/pose repairs; filters must not paste, move or resize faces. Naturalness audit and accepted repairs: `tools/ai-search-naturalness-audit.json`, `tools/ai-search-repairs/`. `match-search-focus.py --ai SIGMA KEY` preserves the newly generated AI repair while adjusting focus; its ordinary mode starts from v1 and must not overwrite a newer body/pose repair. Active v2 refinements use progress version 11; keep the original Eagles assets unchanged.
- Preserve the original Eagles Jalen search and Flappy Bird gameplay/art unless the user requests changes. Eagles search uses the five `search-level-*-v2.jpg` files and target rectangles in `jalen.js`.
- Other games should feature recognizable team-specific characters and settings, beyond renamed/recolored templates. `assets/characters/cast-0.png` through `cast-7.png` contain four roles per team; runtime mapping is in `character-art.js`, card mapping in `game-personality.js`. Keep team ordering and four-column/four-row atlas coordinates aligned. Prompts: `tools/character-art-prompts.json`.
- `personality-data.js` and `photo-scenes.js` are generated browser data. `tools/build-game-art.mjs` merges older manifests, then applies clean selection and consistent-crowd overrides. Update authoritative JSON inputs for lasting changes. Its generated cover manifest still describes legacy covers; **runtime `game-personality.js` is authoritative for character-based cards**. Do not blindly regenerate assets or trust an older manifest as active.
- Legacy photos, sprites, manifests, and scripts remain on disk. Existence does not mean they are active. `team-search.js` is not loaded by the current search page; `photos=0` is not currently a wired alternate mode.

## Build, Test, and Development Commands

- `python3 -m http.server 8000 --directory public`: local preview. Use `choose.html` or a direct URL such as `playbook.html?team=bears&game=pocket`.
- `node --check <changed-script.js>`: syntax check; no frontend dependency installation required.
- `node tests/team-identity-browser.mjs`: current cross-team regression (characters, 160 search rounds, gameplay variants, layouts, dark mode, photo sizing). `--search-only` limits it to homes/search.
- Browser checks require the static server on **8000**, a dedicated Chrome DevTools endpoint on **9224**, and Node with native `WebSocket`. They do not launch those services. Consult README before older browser suites; some assertions describe superseded artwork/modes.
- `node tests/league-rules.mjs`: requires Auth/Firestore emulators for `demo-eagles-leaderboard`, with the Functions trigger stopped. `tests/league-browser.mjs` instead needs Auth, Firestore, and Functions. See README setup.
- Hosting publishes `public/`. Deployment of hosting, rules, indexes, functions, or billing changes requires separate explicit authorization. Local verification does not establish production state.

## Coding Style & Naming Conventions

Use four-space indentation in HTML, CSS, and JavaScript. Follow the existing JavaScript style: semicolons, single-quoted strings, PascalCase class names, and camelCase methods and variables. Use lowercase page and script filenames. Preserve existing DOM IDs or update their HTML, CSS, and JavaScript references together.

There is no configured formatter or linter. Keep changes focused and avoid adding tooling for small edits.

## Testing Guidelines

Use checks appropriate to the change; documentation-only edits do not require game/browser tests. The project has standalone Node/CDP scripts in `tests/`, without a frontend test framework or coverage target. Syntax checks alone do not validate browser behavior.

For gameplay/UI changes, verify the affected team variants, keyboard/touch controls, boundaries, collection/win/restart behavior, saved progress, light/dark themes, responsive layouts, and browser console. Character assets need real alpha transparency and correct atlas cells; photo targets need visual review against the final images, not only tests clicking metadata coordinates. Do not shrink hit boxes arbitrarily to claim a visual difficulty improvement.

## Commit & Pull Request Guidelines

### Private environment file: agent access prohibited

- The repository-root `.env.local` is reserved for credentials entered directly by the user. Agents must not read, open, print, search, copy, upload, or otherwise inspect its contents. Do not source it, load it into a tool or subprocess, or expose its values through logs, diffs, screenshots, or commands.
- Apply the same restriction to real `.env` and `.env.*` credential files. Sanitized `.env.example` and `.env.sample` templates are excluded from this restriction and must never contain real secrets.
- Exclude private environment files from repository-wide content searches and file-reading tools. Metadata-only checks of existence, permissions, Git ignore status, and tracked status are allowed without reading contents.
- Keep `.env.local` outside `public/`, ignored by Git, and restricted to owner read/write permissions (`0600`). Never stage or force-add it. Never weaken secret-scanning hooks or exceptions to include its contents.
- These are agent instructions, not an operating-system access boundary. Git ignore rules prevent ordinary accidental staging but can be overridden by force-add; they do not protect already tracked files. This file is storage only and does not automatically configure the website or a backend.

Never add private API keys, passwords, access tokens, service account credentials, or private keys to tracked files or to `public/`. A secret placed in `public/` is exposed by hosting even if Git ignores it. Environment variables embedded into browser JavaScript are also public.

The existing Firebase browser API key in `public/scripts/firebase-config.js` is intentionally public and may remain committed, provided it stays restricted to Firebase services. This exception does not apply to other Google API keys or newly added credentials. Do not broaden `.gitleaks.toml` exceptions or bypass the secret-scanning hooks to silence a new finding; investigate it first. Keep the repository's commit and push hooks enabled with `git config --local core.hooksPath .githooks`.

Existing commits use short descriptive subjects, such as `Changes to BasicStaticWebsite`; no strict commit convention is established. Prefer specific, action-oriented subjects describing the change.

Pull requests should explain the affected behavior and validation performed, link relevant issues when available, and include screenshots for visual changes. Keep unrelated changes separate. Do not commit credentials or private configuration values.
