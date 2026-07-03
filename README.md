# Your cookbook

A personal recipe book that uses JSON files in this repo as its database,
hosted for free on GitHub Pages. It's a installable PWA with offline
support, ingredient tips that auto-link inside any recipe that uses them,
a distraction-free "cook mode," and per-recipe notes you add after cooking.

There's no backend, no build step, and no framework — every page is
static HTML with a `<script>` tag, and saving works by writing straight to
this repo through the GitHub Contents API from your browser.

## Features

- **Recipe library** (`index.html`) — searchable, filterable grid of
  recipe cards.
- **Recipe view** (`recipe.html`) — ingredients and steps with
  auto-linked ingredient tips (hover/press-and-hold to preview, click to
  jump), a cook's-notes log, and a **cook mode** toggle (larger text,
  fullscreen, keeps the screen awake via the Wake Lock API).
- **Add / edit recipe** (`add-recipe.html`) — tag chips with presets,
  dynamic ingredient/step rows, live fuzzy-match suggestions ("Did you
  mean *scallion*?") against your tips library, drag-and-drop image
  upload, delete with confirmation.
- **Tips library** (`tips.html`) — view, search, add, edit, and delete
  the ingredient tips that power auto-linking everywhere else.
- **View-only mode** — anyone visiting the site without a token can
  browse everything; every write control (add/edit/delete recipe, notes,
  tips) is hidden or disabled.
- **PWA** — installable to a home screen/dock, offline app-shell caching
  via a service worker, with an "update available" banner when a new
  version deploys.

## Structure

```
cookbook/
├── index.html            Recipe library — search, tag filters, grid of cards
├── recipe.html            Single recipe view — ingredients/steps, auto-linked
│                           tips, cook's notes, cook mode
├── add-recipe.html        Add/edit form — tag chips, ingredient/step rows,
│                           fuzzy tip suggestions, image upload, delete
├── tips.html               Tips library — search, add/edit/delete tip entries
├── manifest.webmanifest   PWA config — name, icons, standalone display
├── service-worker.js      Offline app-shell caching, required for installability
│
├── css/
│   └── base.css           Shared design tokens, fonts, buttons, form fields
│                           (each page also layers page-specific styles)
│
├── js/
│   ├── tips-engine.js     Shared data loading + tip matching: exact linking
│   │                       (recipe.html) and fuzzy typo detection (add-recipe.html)
│   ├── github-store.js    Auth (token/view-only), GitHub Contents API read/write,
│   │                       styled confirm dialogs — powers every save/delete
│   └── sw-update.js       Registers the service worker, shows an "update
│                           available" banner and reloads once a new version activates
│
├── data/
│   ├── recipes.json       Your recipes — the actual "database"
│   └── tips.json           Your ingredient tips library
│
├── images/recipes/         Recipe photos referenced by recipes.json's `image` field
│
└── icons/                  App icons for install / home screen
    ├── icon-192.png
    ├── icon-256.png
    ├── icon-512.png
    └── icon-1024.png
```

## Architecture

**Data flow.** `data/recipes.json` and `data/tips.json` are the entire
database. Every page fetches them at runtime with a plain
`fetch('data/*.json', { cache: 'no-store' })` — nothing is hardcoded into
the HTML. There's no server: reads hit the static files GitHub Pages
serves for free, and writes go straight from the browser to the
[GitHub Contents API](https://docs.github.com/en/rest/repos/contents)
using a personal access token stored in `localStorage`. Every save is a
real git commit ("Add recipe: …", "Update notes: …", "Delete tip: …"), so
the site rebuilds and redeploys a minute or so after each change.

**Auth / view-only mode** (`js/github-store.js`). The first time you open
any page, a modal asks you to paste a GitHub token (enables saving) or
continue in view-only mode. That choice is remembered in `localStorage`
(`cookbook_github_token` / `cookbook_view_only`). In view-only mode,
`document.body` gets a `view-only` class that CSS uses to hide every
write affordance — edit/delete buttons, note/tip forms, the "+ Add"
tiles — and `add-recipe.html` refuses to render its form at all. Every
write (`readJsonFile`/`writeJsonFile`) re-fetches the file's current
`sha` immediately before writing (retrying once on a 409, since GitHub's
Contents API can briefly serve a stale sha right after a commit), so two
saves in a row don't clobber each other.

**Ingredient tips** (`js/tips-engine.js`). `tips.json` is a map of
slug → `{ label, aliases, note }`. It's flattened into an alias index
once per page load. `recipe.html` uses exact, word-boundary alias
matching to wrap ingredient/step text in clickable, hoverable spans that
preview the tip and jump to a per-recipe tips index. `add-recipe.html`
uses the same index plus Levenshtein distance to flag likely typos
("close to a tip you have saved but won't link as typed") with a
one-click fix.

**Shared code, not copy-paste.** `css/base.css` and the three `js/`
modules are loaded as plain `<script>`/`<link>` tags on every page — no
bundler, no build step. Recolor the app by editing the `:root` variables
in one place; change tip-matching or auth logic once and every page picks
it up.

**Relative links everywhere.** Every internal link and asset path is
relative (`recipe.html`, `./css/base.css`, not `/recipe.html`), because
GitHub Pages project sites are served from a subpath
(`yourusername.github.io/cookbook/`), not the domain root.

**Offline / PWA.** `service-worker.js` precaches the app shell (HTML
pages, `base.css`, `tips-engine.js`, `sw-update.js`, the manifest) with a
cache-first strategy, and uses network-first-with-cache-fallback for
everything else (so `data/*.json` and images stay fresh when online but
still work offline from whatever was last fetched). `js/sw-update.js`
registers the worker on every page and shows an "update available"
banner instead of making you reload twice, which service workers
normally require.

## Working on it locally

There's no build step, so you don't strictly need a dev server — but
`fetch()` calls to `data/*.json` will fail if you just open the HTML
files with `file://`. Serve the folder over HTTP instead:

```bash
# from the repo root, any static server works, e.g.:
npx serve .
# or
python -m http.server 8000
```

Then open `http://localhost:8000/index.html`. A couple of things behave
differently locally vs. on GitHub Pages:

- **Saving still writes to the real repo.** `js/github-store.js` talks to
  `api.github.com` regardless of where the page is served from, and
  guesses `owner`/`repo` from the URL (which won't work on `localhost` —
  you'll be prompted to enter them manually the first time you save).
  There's no "local-only" write mode; if you paste in a token, saves are
  real commits.
- **The service worker** will register against `localhost` and can cache
  stale files while you're iterating. Use your browser's devtools to
  unregister it or hard-reload (bypass cache) while developing.
- To test **view-only mode** without a token, choose "Continue in view
  only" in the access modal, or run
  `localStorage.setItem('cookbook_view_only', '1')` in the console.

No linter, formatter, or test suite is configured — this is a small
hand-written static site, so changes are verified by loading the pages
and clicking through them.

## Setup (deploying your own copy)

1. Create a new repo (any name — it does **not** need to be
   `yourusername.github.io`, that name is reserved for your one personal
   user site).
2. Push everything in this folder to it.
3. Repo Settings → Pages → set the source branch. It'll deploy to
   `yourusername.github.io/<repo-name>/`.
4. Add real icon files to `icons/` (192px, 256px, 512px, 1024px) if you
   want something other than the defaults for "Add to Home Screen."

## Wiring up GitHub Contents API (enabling saves)

`js/github-store.js` writes `data/recipes.json` and `data/tips.json`
straight from the browser using the GitHub Contents API. There's no
server involved — your browser calls `api.github.com` directly with a
personal access token you create once and it stores in `localStorage`
(never committed, never leaves your browser except to call the GitHub
API).

### 1. Create a fine-grained personal access token

1. Go to [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new).
2. Give it a name like `cookbook-write`.
3. Set an expiration (90 days is a reasonable default — you'll just
   generate a new one when it lapses).
4. Under **Repository access**, choose **Only select repositories** and
   pick this cookbook repo.
5. Under **Permissions → Repository permissions**, set **Contents** to
   **Read and write**. Nothing else is needed.
6. Click **Generate token** and copy it — GitHub only shows it once.

### 2. Paste it into the app

The first time you open the site, a modal will prompt you to paste a
token (or continue in view-only mode instead). Paste the token in — it's
saved in that browser's `localStorage` under the key
`cookbook_github_token`, so you only do this once per browser/device.

- To use a different token later, or if you revoked the old one, clear it
  via your browser devtools console: `localStorage.removeItem('cookbook_github_token')`
  and you'll see the access modal again on next load.
- Because the token lives in `localStorage`, treat any browser it's saved
  in as able to write to your repo. Don't paste it into a shared/public
  computer, and prefer a short expiration.
- If the app can't guess your GitHub username or repo name from the URL
  (e.g. a custom domain, or local development), it'll prompt for those
  too — stored alongside the token.

### 3. Save

Saves commit directly to the branch configured in `js/github-store.js`
(defaults to `main`). Each save is a real commit — "Add recipe: …",
"Update recipe: …", "Update notes: …", "Add tip: …" — so your GitHub
Pages site rebuilds and redeploys automatically a minute or so after
each save.
