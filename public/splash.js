// Plan 115: the loading splash and the saved light/dark choice, before the app file arrives.
// An external file because the Content-Security-Policy (worker/securityHeaders.ts) allows no inline
// scripts. index.html loads it in <head>, before the stylesheet. Plain ES5; every step is guarded:
// if anything here fails the page still works (a CSS rule in index.html hides the splash once #root has content).
(function () {
  // The saved choice (key "theme", see src/theme/themePreference.ts) on <html> before the first paint.
  try {
    var saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved);
    }
  } catch {
    // storage or the DOM is not available: the page works without the splash
  }

  function start() {
    var splash = document.getElementById('splash');
    var root = document.getElementById('root');
    if (!splash || !root) return;
    // The logo fades in when it has loaded; its space is already kept. If it fails it stays empty.
    var img = document.getElementById('splash-img');
    if (img) {
      if (img.complete && img.naturalWidth > 0) img.className = 'sp-on';
      else
        img.addEventListener('load', function () {
          img.className = 'sp-on';
        });
    }
    var gone = false;
    var observer = null;
    function remove() {
      if (splash.parentNode) splash.parentNode.removeChild(splash);
    }
    // The first screen is in #root: fade the splash out and take it away.
    function hide() {
      if (gone) return;
      gone = true;
      if (observer) observer.disconnect();
      var still =
        window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (still) return remove();
      splash.className = 'sp-out';
      splash.addEventListener('animationend', function (e) {
        if (e.target === splash) remove();
      });
      setTimeout(remove, 400);
    }
    if (root.firstChild) return hide();
    if (typeof MutationObserver === 'function') {
      observer = new MutationObserver(function () {
        if (root.firstChild) hide();
      });
      observer.observe(root, { childList: true });
    }
  }

  try {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
  } catch {
    // storage or the DOM is not available: the page works without the splash
  }
})();
