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
├── tips.html            Tips library — view/search/add/edit/delete
│                         entries in data/tips.json directly
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

## Wiring up GitHub Contents API

`js/github-store.js` writes `data/recipes.json` straight from the browser
using the [GitHub Contents API](https://docs.github.com/en/rest/repos/contents).
It's used by the "Save recipe" button in `add-recipe.html` and by
"Add note" / note deletion in `recipe.html`. There's no server involved —
your browser calls `api.github.com` directly with a personal access token
you create once and it stores in `localStorage` (never committed, never
leaves your browser except to call the GitHub API).

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

The first time you click "Save recipe" or "Add note", the app will prompt
you for the token (and, if it can't guess them from the URL, your GitHub
username and repo name). Paste the token in — it's saved in that browser's
`localStorage` under the key `cookbook_github_token`, so you only do this
once per browser/device.

- To use a different token later, or if you revoked the old one, clear it
  via your browser devtools console: `localStorage.removeItem('cookbook_github_token')`
  and you'll be prompted again on the next save.
- Because the token lives in `localStorage`, treat any browser it's saved
  in as able to write to your repo. Don't paste it into a shared/public
  computer, and prefer a short expiration.

### 3. Save

Saves commit directly to the branch configured in `js/github-store.js`
(defaults to `main`). Each save is a real commit — "Add recipe: …",
"Update recipe: …", "Update notes: …" — so your GitHub Pages site rebuilds
and redeploys automatically a minute or so after each save.
