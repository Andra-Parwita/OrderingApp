// Renders the Mermaid blocks (the bundle is copied from node_modules, so this works offline).
(function () {
  var nodes = Array.prototype.slice.call(document.querySelectorAll('.mermaid'));
  nodes.forEach(function (n) {
    n.dataset.src = n.textContent;
  });
  function dark() {
    var t = document.documentElement.dataset.theme;
    return t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function draw() {
    nodes.forEach(function (n) {
      n.textContent = n.dataset.src;
      n.removeAttribute('data-processed');
    });
    window.mermaid.initialize({
      startOnLoad: false,
      theme: dark() ? 'dark' : 'default',
      securityLevel: 'strict',
      flowchart: { htmlLabels: true, useMaxWidth: true },
      sequence: { useMaxWidth: true, wrap: true },
    });
    window.mermaid.run({ nodes: nodes });
  }
  draw();
  document.addEventListener('docs-theme', draw);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', draw);
})();
