/*
  Shared tip-matching engine.
  Loaded as a plain script (no bundler) — exposes window.TipsEngine.
  Consumed by: recipe.html (auto-linking) and add-recipe.html (fuzzy suggestions).
*/
(function () {

  async function loadTips() {
    const res = await fetch('data/tips.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Could not load tips.json');
    return res.json();
  }

  async function loadRecipes() {
    const res = await fetch('data/recipes.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Could not load recipes.json');
    const recipes = await res.json();
    // Patch in any local edits/deletes still propagating through GitHub
    // Pages' rebuild, so they don't flicker back into view.
    return window.GitHubStore ? window.GitHubStore.applyPendingChanges(recipes) : recipes;
  }

  // Flattens { key: { label, aliases: [...] } } into a lookup list.
  function buildAliasIndex(tipsObj) {
    const list = [];
    Object.entries(tipsObj).forEach(([key, tip]) => {
      tip.aliases.forEach(alias => list.push({ key, label: tip.label, alias }));
    });
    return list;
  }

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  // Shared id/key generator: "Green Onion!" -> "green-onion". Falls back to
  // fallback when the input has no alphanumeric characters left.
  function slugify(text, fallback = 'item') {
    return text.trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || fallback;
  }

  // Finds the first exact, word-boundary alias match anywhere in the text.
  function findExactTip(text, aliasIndex) {
    const lower = text.toLowerCase();
    for (const entry of aliasIndex) {
      const re = new RegExp('\\b' + escapeRegex(entry.alias) + '\\b', 'i');
      if (re.test(lower)) return entry;
    }
    return null;
  }

  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    return dp[m][n];
  }

  // Used by the add-recipe form: exact match -> 'exact', close typo -> 'fuzzy', else 'none'.
  function analyzeIngredientText(raw, aliasIndex) {
    const norm = raw.toLowerCase().trim();
    if (!norm) return { type: 'empty' };

    const exact = findExactTip(norm, aliasIndex);
    if (exact) return { type: 'exact', label: exact.label };

    const words = norm.split(/[,\s]+/).filter(Boolean);
    let best = null;
    for (const { key, label, alias } of aliasIndex) {
      const aliasWords = alias.split(' ');
      for (let i = 0; i <= words.length - aliasWords.length; i++) {
        const candidate = words.slice(i, i + aliasWords.length).join(' ');
        if (!candidate) continue;
        const dist = levenshtein(candidate, alias);
        const threshold = Math.max(1, Math.round(alias.length * 0.3));
        if (dist > 0 && dist <= threshold) {
          if (!best || dist < best.dist) best = { key, label, alias, candidate, dist };
        }
      }
    }
    return best ? { type: 'fuzzy', ...best } : { type: 'none' };
  }

  // Used by the recipe view: wraps any alias match in a clickable/hoverable span.
  function renderLinkedText(text, aliasIndex, tipsObj) {
    const match = findExactTip(text, aliasIndex);
    if (!match) return escapeHtml(text);

    const re = new RegExp('(' + escapeRegex(match.alias) + ')', 'i');
    const parts = text.split(re);
    const note = tipsObj[match.key] ? tipsObj[match.key].note : '';

    return parts.map(part => {
      if (re.test(part) && part.toLowerCase() === match.alias.toLowerCase()) {
        return `<span class="has-tip" tabindex="0" role="button"
          data-tip="${match.key}"
          aria-label="${escapeHtml(match.label)}: view tip">${escapeHtml(part)}<span class="peek">${escapeHtml(note)}</span></span>`;
      }
      return escapeHtml(part);
    }).join('');
  }

  // Matches a leading numeric quantity at the start of a qty string, allowing
  // whole numbers, decimals, simple fractions ("1/2"), and mixed numbers
  // ("1 1/2"), so it can be scaled for a different serving size.
  const LEADING_QTY_RE = /^\s*(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.\d+|\d+)/;

  function parseLeadingQty(str) {
    const match = LEADING_QTY_RE.exec(str);
    if (!match) return null;
    const token = match[1];
    let value;
    if (token.includes(' ')) {
      const [whole, frac] = token.split(' ');
      const [n, d] = frac.split('/').map(Number);
      value = Number(whole) + n / d;
    } else if (token.includes('/')) {
      const [n, d] = token.split('/').map(Number);
      value = n / d;
    } else {
      value = Number(token);
    }
    return { value, rest: str.slice(match[0].length) };
  }

  // Formats a scaled numeric quantity, using simple fractions for common
  // eighths so ingredient lists still read naturally (e.g. "0.5" -> "1/2").
  function formatQty(value) {
    const rounded = Math.round(value * 8) / 8;
    const whole = Math.floor(rounded);
    const frac = rounded - whole;
    const eighths = Math.round(frac * 8);

    const fractionMap = { 1: '1/8', 2: '1/4', 3: '3/8', 4: '1/2', 5: '5/8', 6: '3/4', 7: '7/8' };
    const fracStr = fractionMap[eighths] || '';

    if (!whole && fracStr) return fracStr;
    if (whole && fracStr) return `${whole} ${fracStr}`;
    return String(whole || rounded);
  }

  // Scales the leading numeric amount in a qty string ("2 cups" -> "3 cups"
  // at 1.5x). Quantities with no parseable leading number (e.g. "a pinch")
  // are returned unchanged.
  function scaleQty(qty, factor) {
    if (!qty || factor === 1) return qty;
    const parsed = parseLeadingQty(qty);
    if (!parsed) return qty;
    return formatQty(parsed.value * factor) + parsed.rest;
  }

  window.TipsEngine = {
    loadTips,
    loadRecipes,
    buildAliasIndex,
    findExactTip,
    analyzeIngredientText,
    renderLinkedText,
    escapeHtml,
    levenshtein,
    slugify,
    scaleQty
  };
})();
