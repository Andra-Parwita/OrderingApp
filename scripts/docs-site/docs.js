// Docs site behaviour: theme toggle, mobile menu, search over page text and headings.
(function () {
  // Keep the left menu where it was when a menu link loads the next page (each page is its own
  // file, so the browser would start the menu at the top again).
  var side = document.getElementById('side');
  if (side) {
    var saved = null;
    try {
      saved = sessionStorage.getItem('docs-side-scroll');
    } catch {
      /* private mode: start at the current page instead */
    }
    if (saved !== null) side.scrollTop = Number(saved) || 0;
    else {
      var here = side.querySelector('[aria-current="page"]');
      if (here) here.scrollIntoView({ block: 'center' });
    }
    window.addEventListener('pagehide', function () {
      try {
        sessionStorage.setItem('docs-side-scroll', String(side.scrollTop));
      } catch {
        /* not remembered */
      }
    });
  }
  var root = document.documentElement;
  var themeBtn = document.getElementById('theme-btn');
  function current() {
    if (root.dataset.theme) return root.dataset.theme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function label() {
    themeBtn.textContent = current() === 'dark' ? 'Light' : 'Dark';
  }
  label();
  themeBtn.addEventListener('click', function () {
    var next = current() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try {
      localStorage.setItem('docs-theme', next);
    } catch {
      /* private mode: the choice just is not remembered */
    }
    label();
    document.dispatchEvent(new Event('docs-theme'));
  });

  var menuBtn = document.getElementById('menu-btn');
  menuBtn.addEventListener('click', function () {
    var open = side.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', String(open));
  });

  var q = document.getElementById('q');
  var none = document.getElementById('none');
  var items = Array.prototype.slice.call(document.querySelectorAll('#menu li[data-file]'));
  var index = window.DOCS_INDEX || [];
  q.addEventListener('input', function () {
    var term = q.value.trim().toLowerCase();
    var shown = 0;
    items.forEach(function (li) {
      var entry = index.find(function (e) {
        return e.file === li.dataset.file;
      });
      var hits = li.querySelector('.hits');
      hits.textContent = '';
      var match =
        !term ||
        !entry ||
        entry.title.toLowerCase().indexOf(term) >= 0 ||
        entry.text.indexOf(term) >= 0;
      if (match && term && entry) {
        entry.headings
          .filter(function (h) {
            return h.text.toLowerCase().indexOf(term) >= 0;
          })
          .slice(0, 6)
          .forEach(function (h) {
            var li2 = document.createElement('li');
            var a = document.createElement('a');
            a.href = entry.file + '#' + h.id;
            a.textContent = h.text;
            li2.appendChild(a);
            hits.appendChild(li2);
          });
      }
      li.hidden = !match;
      if (match) shown++;
    });
    document.querySelectorAll('#menu section').forEach(function (s) {
      s.hidden = !s.querySelector('li[data-file]:not([hidden])');
    });
    none.hidden = shown > 0;
    // also filter the headings in this page's own contents list
    document.querySelectorAll('.toc li').forEach(function (li) {
      li.hidden = !!term && li.textContent.toLowerCase().indexOf(term) < 0;
    });
  });

  // Enlarge button + full-screen viewer for diagrams and images.
  function wrap(el) {
    var w = document.createElement('div');
    w.className = 'zoomable';
    el.parentNode.insertBefore(w, el);
    w.appendChild(el);
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'zoom-btn';
    b.textContent = '⤢';
    b.setAttribute('aria-label', el.tagName === 'IMG' ? 'Enlarge image' : 'Enlarge diagram');
    w.appendChild(b);
    b.addEventListener('click', function () {
      openZoom(el, b);
    });
    el.addEventListener('click', function () {
      openZoom(el, b);
    });
  }
  document.querySelectorAll('.doc .mermaid, .doc img').forEach(wrap);

  function openZoom(el, opener) {
    var node;
    var w;
    var h;
    if (el.tagName === 'IMG') {
      node = el.cloneNode();
      w = el.naturalWidth || el.width;
      h = el.naturalHeight || el.height;
    } else {
      var svg = el.querySelector('svg');
      if (!svg) return;
      node = svg.cloneNode(true);
      var vb = svg.viewBox && svg.viewBox.baseVal;
      var r = svg.getBoundingClientRect();
      w = vb && vb.width ? vb.width : r.width;
      h = vb && vb.height ? vb.height : r.height;
      node.removeAttribute('style');
    }
    node.setAttribute('width', w);
    node.setAttribute('height', h);
    var modal = document.createElement('div');
    modal.className = 'zoom-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Enlarged view');
    var bar = document.createElement('div');
    bar.className = 'zoom-bar';
    var stage = document.createElement('div');
    stage.className = 'zoom-stage';
    var content = document.createElement('div');
    content.className = 'zoom-content';
    content.appendChild(node);
    stage.appendChild(content);
    var btns = [];
    function mk(text, label, fn) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'zoom-btn';
      b.textContent = text;
      b.setAttribute('aria-label', label);
      b.addEventListener('click', fn);
      bar.appendChild(b);
      btns.push(b);
    }
    var k = 1;
    var x = 0;
    var y = 0;
    function apply() {
      content.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + k + ')';
    }
    function fit() {
      var sw = stage.clientWidth;
      var sh = stage.clientHeight;
      k = Math.min(sw / w, sh / h) * 0.96;
      x = (sw - w * k) / 2;
      y = (sh - h * k) / 2;
      apply();
    }
    function zoomAt(f, cx, cy) {
      var nk = Math.max(0.1, Math.min(12, k * f));
      x = cx - ((cx - x) * nk) / k;
      y = cy - ((cy - y) * nk) / k;
      k = nk;
      apply();
    }
    function mid(f) {
      zoomAt(f, stage.clientWidth / 2, stage.clientHeight / 2);
    }
    function close() {
      document.removeEventListener('keydown', onKey);
      modal.remove();
      opener.focus();
    }
    function onKey(e) {
      if (e.key === 'Escape') {
        close();
      } else if (e.key === 'Tab') {
        var i = btns.indexOf(document.activeElement);
        var n = e.shiftKey ? i - 1 : i + 1;
        e.preventDefault();
        btns[(n + btns.length) % btns.length].focus();
      }
    }
    mk('+', 'Zoom in', function () {
      mid(1.25);
    });
    mk('−', 'Zoom out', function () {
      mid(0.8);
    });
    mk('Fit', 'Fit to screen', fit);
    mk('✕', 'Close', close);
    modal.appendChild(bar);
    modal.appendChild(stage);
    document.body.appendChild(modal);
    fit();
    btns[btns.length - 1].focus();
    document.addEventListener('keydown', onKey);

    stage.addEventListener(
      'wheel',
      function (e) {
        e.preventDefault();
        var b = stage.getBoundingClientRect();
        zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - b.left, e.clientY - b.top);
      },
      { passive: false },
    );
    var pts = {};
    var last = 0;
    stage.addEventListener('pointerdown', function (e) {
      stage.setPointerCapture(e.pointerId);
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      last = 0;
    });
    stage.addEventListener('pointermove', function (e) {
      var p = pts[e.pointerId];
      if (!p) return;
      var ids = Object.keys(pts);
      if (ids.length === 2) {
        var o = pts[ids[0] === String(e.pointerId) ? ids[1] : ids[0]];
        var d = Math.hypot(e.clientX - o.x, e.clientY - o.y);
        if (last) {
          var b = stage.getBoundingClientRect();
          zoomAt(d / last, (e.clientX + o.x) / 2 - b.left, (e.clientY + o.y) / 2 - b.top);
        }
        last = d;
      } else {
        x += e.clientX - p.x;
        y += e.clientY - p.y;
        apply();
      }
      p.x = e.clientX;
      p.y = e.clientY;
    });
    function up(e) {
      delete pts[e.pointerId];
      last = 0;
    }
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);
  }
})();
