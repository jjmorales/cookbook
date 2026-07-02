# Your cookbook

A personal recipe book that uses JSON files in this repo as its database,
hosted for free on GitHub Pages. Ingredient tips auto-link inside any
recipe that uses that ingredient.

## Structure

```
cookbook/
├── index.html          Home / recipe library — fetches data/recipes.json
├── recipe.html          Single recipe view — reads ?id= from the URL,
│                         renders ingredients/steps/notes, auto-links tips
├── add-recipe.html      Form for adding a new recipe (+ tag chips,
│                         fuzzy ingredient-tip suggestions, image upload)
├── manifest.webmanifest PWA config — name, icons, standalone display
├── service-worker.js    Offline app-shell caching, required for installability
│
├── css/
│   └── base.css         Shared design tokens, fonts, buttons, form fields
│
├── js/
│   └── tips-engine.js   Shared matching logic: exact tip linking (recipe.html)
│                         + fuzzy typo detection (add-recipe.html)
│
├── data/
│   ├── recipes.json     Your recipes — the actual "database"
│   └── tips.json        Your ingredient tips library
│
├── images/
│   └── recipes/         Uploaded recipe photos (fried-rice.jpg, etc.)
│
└── icons/                App icons for the home-screen install
    ├── icon-192.png      (not included — add your own)
    ├── icon-512.png
    └── icon-maskable-512.png
```

## Why this shape

- **`data/` is the database.** `index.html`, `recipe.html`, and
  `add-recipe.html` all read from `recipes.json` / `tips.json` via `fetch()`
  at runtime — nothing is hardcoded into the pages anymore. Editing those
  two files (by hand, or later through the GitHub Contents API once the
  write flow is built) is the entire "update the app" action.
- **`css/base.css` and `js/tips-engine.js` are shared once, not copy-pasted
  three times.** Recolor the whole app by editing the `:root` variables in
  one file. Change how fuzzy matching works in one place and both the
  recipe view and the add-recipe form pick it up.
- **Every internal link is relative** (`recipe.html`, `./css/base.css`,
  not `/recipe.html`), which matters because GitHub Pages project sites
  are served from a subpath (`yourusername.github.io/cookbook/`), not the
  domain root.

## Setup

1. Create a new repo (any name — it does **not** need to be
   `yourusername.github.io`, that name is reserved for your one personal
   user site).
2. Push everything in this folder to it.
3. Repo Settings → Pages → set the source branch. It'll deploy to
   `yourusername.github.io/<repo-name>/`.
4. Add real icon files to `icons/` (192px, 512px, and a maskable 512px
   variant) so "Add to Home Screen" shows something other than a blank tile.

## Known gaps — next steps

- **Saving is not wired yet.** The "Save recipe" button in `add-recipe.html`
  currently just logs the assembled JSON to the console. Writing it back to
  `data/recipes.json` for real needs the GitHub Contents API + a way to
  authenticate your own writes (a personal access token or a small serverless
  proxy) — that's the next piece to build.
- **Editing an existing recipe** isn't prefilled yet. `recipe.html` links
  its Edit button to `add-recipe.html?id=...`, but the form doesn't yet read
  that param and populate itself — needs the same data-loading treatment
  `recipe.html` already has.
- **Cook's notes are session-only.** Notes you add on a recipe page live in
  memory until the page reloads, since they're not written back to
  `recipes.json` yet — same underlying gap as saving recipes.
- **Tips library page** doesn't exist yet — `index.html` links to
  `tips.html`, which still needs to be built (a place to view/add/edit
  entries in `data/tips.json` directly, the counterpart to `add-recipe.html`).
