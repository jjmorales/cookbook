/*
  Writes data/*.json back to this repo via the GitHub Contents API.
  Loaded as a plain script (no bundler) — exposes window.GitHubStore.

  Auth: a fine-grained GitHub personal access token, pasted once and kept
  in this browser's localStorage (GITHUB_TOKEN_STORAGE_KEY). It never
  touches the repo itself. See README "Wiring up saving" for how to
  create one.
*/
(function () {

  const TOKEN_STORAGE_KEY = 'cookbook_github_token';
  const OWNER_STORAGE_KEY = 'cookbook_github_owner';
  const REPO_STORAGE_KEY = 'cookbook_github_repo';
  const BRANCH_STORAGE_KEY = 'cookbook_github_branch';
  const VIEW_ONLY_STORAGE_KEY = 'cookbook_view_only';

  function getToken() {
    return localStorage.getItem(TOKEN_STORAGE_KEY) || '';
  }

  function setToken(token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token.trim());
    localStorage.removeItem(VIEW_ONLY_STORAGE_KEY);
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }

  function isViewOnly() {
    return localStorage.getItem(VIEW_ONLY_STORAGE_KEY) === '1' && !getToken();
  }

  function setViewOnly() {
    localStorage.setItem(VIEW_ONLY_STORAGE_KEY, '1');
  }

  function exitViewOnly() {
    localStorage.removeItem(VIEW_ONLY_STORAGE_KEY);
  }

  // owner/repo default to guessing from the current GitHub Pages URL
  // (https://<owner>.github.io/<repo>/...) but can be overridden, which
  // matters when running the app from a custom domain.
  function guessOwnerRepo() {
    const host = location.hostname; // "<owner>.github.io"
    const owner = host.endsWith('.github.io') ? host.replace('.github.io', '') : '';
    const pathParts = location.pathname.split('/').filter(Boolean);
    const repo = pathParts[0] || '';
    return { owner, repo };
  }

  function getConfig() {
    const guess = guessOwnerRepo();
    return {
      owner: localStorage.getItem(OWNER_STORAGE_KEY) || guess.owner,
      repo: localStorage.getItem(REPO_STORAGE_KEY) || guess.repo,
      branch: localStorage.getItem(BRANCH_STORAGE_KEY) || 'main'
    };
  }

  function setConfig({ owner, repo, branch }) {
    if (owner) localStorage.setItem(OWNER_STORAGE_KEY, owner.trim());
    if (repo) localStorage.setItem(REPO_STORAGE_KEY, repo.trim());
    if (branch) localStorage.setItem(BRANCH_STORAGE_KEY, branch.trim());
  }

  function isConfigured() {
    const { owner, repo } = getConfig();
    return Boolean(getToken() && owner && repo);
  }

  // Prompts for a token (and owner/repo/branch, if not already guessed
  // correctly) using plain browser prompts — good enough for a
  // single-user personal tool with no build step.
  function ensureConfigured() {
    if (isViewOnly()) {
      throw new Error('You’re in view-only mode. Reload and enter a token to make changes.');
    }
    if (!getToken()) {
      const token = window.prompt(
        'Paste your GitHub personal access token (repo contents: read & write).\n' +
        'Stored only in this browser (localStorage), never committed.'
      );
      if (!token) throw new Error('A GitHub token is required to save.');
      setToken(token);
    }
    const { owner, repo, branch } = getConfig();
    if (!owner || !repo) {
      const ownerInput = window.prompt('GitHub username/org that owns this repo:', owner || '');
      const repoInput = window.prompt('Repo name:', repo || '');
      if (!ownerInput || !repoInput) throw new Error('Repo owner and name are required to save.');
      setConfig({ owner: ownerInput, repo: repoInput, branch });
    }
  }

  const MODAL_STYLE_ID = 'github-store-modal-style';
  const MODAL_CSS = `
    .ghs-overlay { position: fixed; inset: 0; background: rgba(42, 38, 34, 0.55); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
    .ghs-modal { background: var(--card, #F6F0E2); border: 1px solid var(--border, #DCD2B8); border-radius: 8px; max-width: 380px; width: 100%; padding: 26px 24px; font-family: 'Inter', sans-serif; box-shadow: 0 12px 32px rgba(42, 38, 34, 0.3); }
    .ghs-modal h2 { font-family: 'Fraunces', serif; font-weight: 600; font-size: 20px; color: var(--basil, #2C3B2E); margin: 0 0 10px; }
    .ghs-modal p { font-size: 13.5px; line-height: 1.55; color: var(--muted, #7A756A); margin: 0 0 18px; }
    .ghs-modal input { width: 100%; box-sizing: border-box; background: #fff; border: 1px solid var(--border, #DCD2B8); border-radius: 4px; padding: 10px 12px; font-size: 14px; margin-bottom: 14px; }
    .ghs-modal .ghs-actions { display: flex; flex-direction: column; gap: 8px; }
    .ghs-modal button { font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 500; padding: 10px 16px; border-radius: 4px; cursor: pointer; }
    .ghs-modal .ghs-save { background: var(--basil, #2C3B2E); color: var(--card, #F6F0E2); border: none; }
    .ghs-modal .ghs-save:hover { background: var(--basil-soft, #435946); }
    .ghs-modal .ghs-view-only { background: none; border: 1px solid var(--border, #DCD2B8); color: var(--basil-soft, #435946); }
    .ghs-modal .ghs-view-only:hover { border-color: var(--basil-soft, #435946); }
    .ghs-modal .ghs-error { color: var(--danger, #A3402A); font-size: 12.5px; margin: -8px 0 14px; display: none; }
    .ghs-modal .ghs-error.show { display: block; }
    .ghs-modal .ghs-confirm-danger { background: var(--danger, #A3402A); color: #fff; border: none; }
    .ghs-modal .ghs-confirm-danger:hover { background: #832f21; }
    .ghs-modal .ghs-confirm-cancel { background: none; border: 1px solid var(--border, #DCD2B8); color: var(--basil-soft, #435946); }
    .ghs-modal .ghs-confirm-cancel:hover { border-color: var(--basil-soft, #435946); }
  `;

  function injectModalStyles() {
    if (document.getElementById(MODAL_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = MODAL_STYLE_ID;
    style.textContent = MODAL_CSS;
    document.head.appendChild(style);
  }

  // Shows a one-time, whole-site access modal: paste a token to enable
  // saving, or continue in view-only mode (no token stored, no writes
  // possible). Resolves once a choice is made; never rejects.
  function promptForAccess() {
    return new Promise(resolve => {
      injectModalStyles();

      const overlay = document.createElement('div');
      overlay.className = 'ghs-overlay';
      overlay.innerHTML = `
        <div class="ghs-modal" role="dialog" aria-modal="true" aria-labelledby="ghsTitle">
          <h2 id="ghsTitle">Enable saving?</h2>
          <p>Paste a GitHub personal access token to save recipes and notes back to this repo. It's stored only in this browser. Skip this to browse in view-only mode instead.</p>
          <input type="password" placeholder="GitHub personal access token" autocomplete="off" id="ghsTokenInput">
          <p class="ghs-error" id="ghsError">A token is required, or choose view only.</p>
          <div class="ghs-actions">
            <button type="button" class="ghs-save" id="ghsSaveBtn">Save token</button>
            <button type="button" class="ghs-view-only" id="ghsViewOnlyBtn">Continue in view only</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const input = overlay.querySelector('#ghsTokenInput');
      const error = overlay.querySelector('#ghsError');
      input.focus();

      function close() {
        overlay.remove();
      }

      overlay.querySelector('#ghsSaveBtn').addEventListener('click', () => {
        const token = input.value.trim();
        if (!token) { error.classList.add('show'); return; }
        setToken(token);
        close();
        resolve('token');
      });

      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') overlay.querySelector('#ghsSaveBtn').click();
      });

      overlay.querySelector('#ghsViewOnlyBtn').addEventListener('click', () => {
        setViewOnly();
        close();
        resolve('view-only');
      });
    });
  }

  // Call once per page load, before any GitHub-writing controls render.
  // No-ops (resolves immediately) if a token is already stored or the
  // visitor already chose view-only mode previously.
  async function ensureAccessChoice() {
    if (getToken() || isViewOnly()) return isViewOnly() ? 'view-only' : 'token';
    return promptForAccess();
  }

  async function githubRequest(path, options = {}) {
    const res = await fetch(`https://api.github.com${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${getToken()}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(options.headers || {})
      }
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(`GitHub API ${res.status}: ${body.message || res.statusText}`);
    }
    return res.json();
  }

  function utf8ToBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  function base64ToUtf8(str) {
    return decodeURIComponent(escape(atob(str)));
  }

  // Reads a JSON file from the repo and returns { data, sha }. The sha is
  // required to overwrite the file without clobbering someone else's edit.
  async function readJsonFile(filePath) {
    ensureConfigured();
    const { owner, repo, branch } = getConfig();
    const result = await githubRequest(
      `/repos/${owner}/${repo}/contents/${filePath}?ref=${encodeURIComponent(branch)}`
    );
    return { data: JSON.parse(base64ToUtf8(result.content)), sha: result.sha };
  }

  // Writes a JSON value back to filePath. Always re-fetches the current
  // sha immediately before writing so two saves in a row don't race.
  // GitHub's Contents API can briefly serve a stale sha right after a
  // commit (read-after-write lag), which surfaces as a 409 on the PUT.
  // On a 409, re-fetch the sha and retry once before giving up.
  async function writeJsonFile(filePath, value, commitMessage, _retried = false) {
    ensureConfigured();
    const { owner, repo, branch } = getConfig();
    let sha;
    try {
      const current = await githubRequest(
        `/repos/${owner}/${repo}/contents/${filePath}?ref=${encodeURIComponent(branch)}`
      );
      sha = current.sha;
    } catch (err) {
      sha = undefined; // file doesn't exist yet
    }

    const body = {
      message: commitMessage || `Update ${filePath}`,
      content: utf8ToBase64(JSON.stringify(value, null, 2) + '\n'),
      branch
    };
    if (sha) body.sha = sha;

    try {
      return await githubRequest(`/repos/${owner}/${repo}/contents/${filePath}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch (err) {
      if (!_retried && /GitHub API 409/.test(err.message)) {
        return writeJsonFile(filePath, value, commitMessage, true);
      }
      throw err;
    }
  }

  // Generic styled confirm dialog (replaces native confirm()). Resolves
  // true if the user confirms, false if they cancel or dismiss.
  function confirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false }) {
    return new Promise(resolve => {
      injectModalStyles();

      const overlay = document.createElement('div');
      overlay.className = 'ghs-overlay';
      overlay.innerHTML = `
        <div class="ghs-modal" role="alertdialog" aria-modal="true" aria-labelledby="ghsConfirmTitle">
          <h2 id="ghsConfirmTitle">${title}</h2>
          <p>${message}</p>
          <div class="ghs-actions">
            <button type="button" class="${danger ? 'ghs-confirm-danger' : 'ghs-save'}" id="ghsConfirmOk">${confirmLabel}</button>
            <button type="button" class="ghs-confirm-cancel" id="ghsConfirmCancel">${cancelLabel}</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      function close(result) {
        overlay.remove();
        resolve(result);
      }

      overlay.querySelector('#ghsConfirmOk').addEventListener('click', () => close(true));
      overlay.querySelector('#ghsConfirmCancel').addEventListener('click', () => close(false));
      overlay.addEventListener('click', e => { if (e.target === overlay) close(false); });
      document.addEventListener('keydown', function onKey(e) {
        if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); close(false); }
      });

      overlay.querySelector('#ghsConfirmOk').focus();
    });
  }

  window.GitHubStore = {
    getToken, setToken, clearToken,
    isViewOnly, setViewOnly, exitViewOnly,
    getConfig, setConfig,
    isConfigured, ensureConfigured,
    ensureAccessChoice,
    readJsonFile, writeJsonFile,
    confirmDialog
  };
})();
