# Repository Guidelines

## Interacting with the User

The user is a student and may make incorrect claims or assumptions. Prioritize accuracy and understanding over agreement.

- Always assess factual claims and technical assumptions before relying on them. Check repository code, reproducible behavior, or authoritative documentation as appropriate; use current sources for information that may have changed.
- Correct mistakes directly and respectfully. Explain what is incorrect, why, and what the accurate statement is, using a small example when helpful.
- Distinguish verified facts, assumptions, and uncertainty. If a claim cannot be verified, say so instead of presenting it as true.
- Do not agree merely to be encouraging. Also acknowledge when the user's reasoning is correct, with a brief explanation when useful.
- Use clear, student-friendly language, define unfamiliar terms, and explain the reasoning behind important changes. Avoid condescension or unnecessary detail.
- Treat preferences as preferences, rather than factual claims to challenge. Ask for clarification when ambiguity materially affects the work.

## Project Structure & Module Organization

This repository is a small static website served from `public/`.

- `public/index.html`: landing page with content sections and a visit counter.
- `public/game.html`: canvas game page.
- `public/style.css`: styles used by the landing page.
- `public/scripts/main.js`: visit counter backed by browser local storage.
- `public/scripts/game.js`: canvas rendering, keyboard input, collisions, and scoring.
- `firebase.json` and `.firebaserc`: Firebase Hosting configuration and project selection.

Keep deployable pages, scripts, styles, and future assets inside `public/`. There is currently no test directory or package manifest.

## Build, Test, and Development Commands

No compilation or dependency installation is required.

- `python3 -m http.server 8000 --directory public`: serve locally; open `http://localhost:8000/` or `/game.html`.
- `node --check public/scripts/main.js`: check counter script syntax.
- `node --check public/scripts/game.js`: check game script syntax.
- `firebase emulators:start --only hosting`: preview Firebase Hosting behavior when the Firebase CLI is installed and configured.

Hosting publishes `public/` and rewrites unmatched paths to `/index.html`. Treat deployment as a separate, explicitly authorized action.

## Coding Style & Naming Conventions

Use four-space indentation in HTML, CSS, and JavaScript. Follow the existing JavaScript style: semicolons, single-quoted strings, PascalCase class names, and camelCase methods and variables. Use lowercase page and script filenames. Preserve existing DOM IDs or update their HTML, CSS, and JavaScript references together.

There is no configured formatter or linter. Keep changes focused and avoid adding tooling for small edits.

## Testing Guidelines

No automated test framework or coverage target is configured. Run both syntax checks and manually verify affected pages in a browser. Check counter persistence after reload, keyboard movement, canvas boundaries, collisions with every collectible, and behavior after all collectibles are removed. Inspect the browser console for errors. Syntax checks alone do not validate browser behavior.

## Commit & Pull Request Guidelines

Never add private API keys, passwords, access tokens, service account credentials, or private keys to tracked files or to `public/`. A secret placed in `public/` is exposed by hosting even if Git ignores it. Environment variables embedded into browser JavaScript are also public.

The existing Firebase browser API key in `public/scripts/firebase-config.js` is intentionally public and may remain committed, provided it stays restricted to Firebase services. This exception does not apply to other Google API keys or newly added credentials. Do not broaden `.gitleaks.toml` exceptions or bypass the secret-scanning hooks to silence a new finding; investigate it first. Keep the repository's commit and push hooks enabled with `git config --local core.hooksPath .githooks`.

Existing commits use short descriptive subjects, such as `Changes to BasicStaticWebsite`; no strict commit convention is established. Prefer specific, action-oriented subjects describing the change.

Pull requests should explain the affected behavior and validation performed, link relevant issues when available, and include screenshots for visual changes. Keep unrelated changes separate. Do not commit credentials or private configuration values.
