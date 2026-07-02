/*
  Registers the service worker on every page and surfaces a small banner
  when a new version has installed and is waiting to take over, with a
  button to activate it immediately instead of waiting for the usual
  two-reload dance service workers normally require.
*/
(function () {
  if (!('serviceWorker' in navigator)) return;

  const BANNER_STYLE_ID = 'sw-update-style';
  const BANNER_CSS = `
    .sw-update-banner { position: fixed; left: 50%; bottom: 20px; transform: translateX(-50%); z-index: 2000; display: flex; align-items: center; gap: 14px; background: var(--basil, #2C3B2E); color: var(--card, #F6F0E2); border-radius: 8px; padding: 12px 16px; box-shadow: 0 8px 24px rgba(42, 38, 34, 0.35); font-family: 'Inter', sans-serif; font-size: 13.5px; max-width: calc(100vw - 40px); }
    .sw-update-banner button { font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 500; padding: 7px 14px; border-radius: 4px; cursor: pointer; flex-shrink: 0; white-space: nowrap; }
    .sw-update-banner .sw-refresh { background: var(--mustard, #E8A93B); color: var(--basil, #2C3B2E); border: none; }
    .sw-update-banner .sw-refresh:hover { background: #f0b752; }
    .sw-update-banner .sw-dismiss { background: none; border: none; color: var(--card, #F6F0E2); opacity: 0.7; font-size: 16px; line-height: 1; padding: 4px; }
    .sw-update-banner .sw-dismiss:hover { opacity: 1; }
  `;

  function injectStyles() {
    if (document.getElementById(BANNER_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = BANNER_STYLE_ID;
    style.textContent = BANNER_CSS;
    document.head.appendChild(style);
  }

  function showUpdateBanner(onRefresh) {
    injectStyles();
    if (document.querySelector('.sw-update-banner')) return;

    const banner = document.createElement('div');
    banner.className = 'sw-update-banner';
    banner.innerHTML = `
      <span>A new version of the cookbook is available.</span>
      <button type="button" class="sw-refresh">Update now</button>
      <button type="button" class="sw-dismiss" aria-label="Dismiss">&times;</button>
    `;
    document.body.appendChild(banner);

    banner.querySelector('.sw-refresh').addEventListener('click', onRefresh);
    banner.querySelector('.sw-dismiss').addEventListener('click', () => banner.remove());
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').then(registration => {
      // A worker already sitting in "waiting" (installed while no tab
      // controlled by it was active to activate it yet).
      if (registration.waiting) showUpdateBanner(() => activate(registration));

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner(() => activate(registration));
          }
        });
      });
    }).catch(err => {
      console.warn('Service worker registration failed:', err.message);
    });

    // Once the new worker takes control, reload so this tab runs the
    // fresh HTML/JS instead of whatever it already has in memory.
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  });

  function activate(registration) {
    if (!registration.waiting) return;
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
})();
