// Builds docs/site/ (plan 070, D-098): the Markdown in docs/ as a small branded HTML site.
// Run: pnpm run docs (plain `pnpm docs` is a pnpm built-in), then open docs/site/index.html. Dev-only (marked + mermaid), private, not deployed.
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docsDir = path.join(root, 'docs');
const outDir = path.join(docsDir, 'site');

/** Menu groups: [group title, [[source path under docs/, menu label]...]]. */
const GROUPS = [
  [
    'Product',
    [
      ['product/overview.md', 'Overview'],
      ['product/flows.md', 'Main UX flows'],
      ['product/roadmap.md', 'Roadmap (payments, store, events)'],
      ['product/app-store-roadmap.md', 'Store apps (analysis)'],
    ],
  ],
  [
    'Architecture',
    [
      ['architecture/README.md', 'Architecture index'],
      ['architecture/overview.md', 'System overview'],
      ['architecture/sequences.md', 'Message sequences'],
      ['architecture/data-model.md', 'Data model'],
      ['architecture/api.md', 'API'],
      ['architecture/seller-auth.md', 'Sign-in and roles'],
      ['architecture/source-layout.md', 'Source layout'],
      ['architecture/state-and-data-flow.md', 'State and data flow'],
    ],
  ],
  [
    'Guides',
    [
      ['guide/tech-stack.md', 'Tech stack and gate'],
      ['guide/agent-working-conventions.md', 'Agent conventions'],
      ['guide/token-efficiency.md', 'Token efficiency'],
      ['guide/deploy-cloudflare.md', 'Deploy to Cloudflare'],
      ['guide/update-brand-logo.md', 'Update the logo'],
    ],
  ],
  [
    'Decisions and plans',
    [
      ['decisions/README.md', 'Decisions'],
      ['plans/README.md', 'Plans index'],
      ['plan/roadmap.md', 'Phase roadmap'],
      ['plan/board.md', 'Board'],
      ['plan/lessons.md', 'Lessons'],
    ],
  ],
  ['Hand-over', [['HANDOVER.md', 'Hand-over']]],
];

const INDEX = 'README.md';
const pageFile = (src) =>
  src === INDEX ? 'index.html' : src.replace(/\.md$/, '').replace(/\//g, '-') + '.html';

const pages = [];
const bySrc = new Map();
for (const [group, items] of GROUPS) {
  for (const [src, label] of items) {
    const abs = path.join(docsDir, src);
    if (!existsSync(abs)) {
      console.warn(`skip (missing): docs/${src}`);
      continue;
    }
    const page = { src, label, group, file: pageFile(src) };
    pages.push(page);
    bySrc.set(src, page);
  }
}
bySrc.set(INDEX, { src: INDEX, label: 'Home', group: '', file: 'index.html' });

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plain = (html) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
const slugify = (text) =>
  plain(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s/g, '-');

/** Where a link in `fromSrc` should point: another site page, or the file in the repo. */
function rewriteHref(href, fromSrc) {
  if (!href || /^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(href)) return { href, ext: false };
  const [pathPart, hash] = href.split('#');
  const resolved = path.posix.normalize(
    path.posix.join(path.posix.dirname('docs/' + fromSrc), pathPart),
  );
  const inDocs = resolved.startsWith('docs/') ? resolved.slice(5) : null;
  const target = inDocs
    ? (bySrc.get(inDocs) ?? bySrc.get(inDocs.replace(/\/$/, '') + '/README.md'))
    : null;
  if (target) return { href: target.file + (hash ? '#' + hash : ''), ext: false };
  return { href: '../../' + resolved + (hash ? '#' + hash : ''), ext: true };
}

function render(page, text) {
  const headings = [];
  const seen = new Map();
  const marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth }) {
        const inner = this.parser.parseInline(tokens);
        let id = slugify(inner) || 'section';
        const n = seen.get(id) ?? 0;
        seen.set(id, n + 1);
        if (n) id += '-' + n;
        if (depth >= 2 && depth <= 3) headings.push({ id, text: plain(inner), depth });
        return `<h${depth} id="${id}">${inner}</h${depth}>\n`;
      },
      code({ text: code, lang }) {
        if (lang === 'mermaid')
          return `<div class="mermaid" role="img" aria-label="Diagram">${esc(code)}</div>\n`;
        return `<pre><code${lang ? ` class="language-${esc(lang)}"` : ''}>${esc(code)}</code></pre>\n`;
      },
      table(token) {
        const head = token.header
          .map((c, i) => this.tablecell({ ...c, header: true, align: token.align[i] }))
          .join('');
        const rows = token.rows
          .map(
            (r) =>
              `<tr>${r.map((c, i) => this.tablecell({ ...c, header: false, align: token.align[i] })).join('')}</tr>`,
          )
          .join('\n');
        return `<div class="tablewrap"><table><thead><tr>${head}</tr></thead><tbody>\n${rows}\n</tbody></table></div>\n`;
      },
      link({ href, title, tokens }) {
        const r = rewriteHref(href, page.src);
        const t = title ? ` title="${esc(title)}"` : '';
        const cls = r.ext && !/^[a-z][a-z0-9+.-]*:/i.test(href) ? ' class="repo"' : '';
        return `<a href="${esc(r.href)}"${t}${cls}>${this.parser.parseInline(tokens)}</a>`;
      },
      image({ href, title, text: alt }) {
        const r = rewriteHref(href, page.src);
        return `<img src="${esc(r.href)}" alt="${esc(alt)}"${title ? ` title="${esc(title)}"` : ''}>`;
      },
    },
  });
  const body = marked.parse(text);
  return { body, headings, hasDiagram: body.includes('class="mermaid"') };
}

function pageTitle(text, fallback) {
  const m = /^#\s+(.+)$/m.exec(text);
  return m ? m[1].replace(/[`*_]/g, '').trim() : fallback;
}

const nav = (current) =>
  GROUPS.map(([group]) => {
    const items = pages.filter((p) => p.group === group);
    if (!items.length) return '';
    const lis = items
      .map(
        (p) =>
          `<li data-file="${p.file}"><a href="${p.file}"${p.file === current ? ' aria-current="page"' : ''}>${esc(p.label)}</a><ul class="hits"></ul></li>`,
      )
      .join('');
    return `<section><h2>${esc(group)}</h2><ul>${lis}</ul></section>`;
  }).join('\n');

// Release version: single source is shared/release.ts (parsed, not imported); package.json is the fallback.
const releaseVersion = (() => {
  try {
    const m = /RELEASE_VERSION\s*=\s*['"]([^'"]+)['"]/.exec(
      readFileSync(path.join(root, 'shared', 'release.ts'), 'utf8'),
    );
    if (m) return m[1];
  } catch {
    // fall through to package.json
  }
  return JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version;
})();

const brand = (f) => `assets/${f}`;

function shell({ title, body, current, hasDiagram, toc }) {
  const tocHtml = toc.length
    ? `<nav class="toc" aria-label="On this page"><h2>On this page</h2><ul>${toc
        .map((h) => `<li class="d${h.depth}"><a href="#${h.id}">${esc(h.text)}</a></li>`)
        .join('')}</ul></nav>`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · ShaggyBobo Docs</title>
<link rel="icon" href="${brand('logo-icon.webp')}">
<link rel="stylesheet" href="assets/docs.css">
<script>try{var t=localStorage.getItem('docs-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}</script>
</head>
<body>
<a class="skip" href="#content">Skip to content</a>
<header class="band">
  <div class="scene" aria-hidden="true"><img src="${brand('nusantara-market.webp')}" alt=""></div>
  <div class="band-in">
    <a class="brand" href="index.html"><img src="${brand('logo-icon.webp')}" alt=""><span><b>Shaggy</b><i>Bobo</i></span></a>
    <div class="title"><p class="h1">ShaggyBobo · Docs <span class="ver" title="Release version">v${esc(releaseVersion)}</span></p><p class="sub">${esc(title)}</p></div>
    <div class="tools">
      <button type="button" id="menu-btn" class="pill menu-btn" aria-expanded="false" aria-controls="side">Menu</button>
      <button type="button" id="theme-btn" class="pill" aria-label="Switch light or dark theme">Theme</button>
    </div>
  </div>
  <div class="mascot" aria-hidden="true">
    <img class="legs" src="${brand('mascot-leg-right.webp')}" alt="">
    <img class="legs" src="${brand('mascot-leg-left.webp')}" alt="">
    <img src="${brand('mascot-body.webp')}" alt="">
    <img src="${brand('mascot-arm-spoon.webp')}" alt="">
  </div>
</header>
<div class="layout">
  <aside id="side" class="side">
    <div class="search"><label class="sr" for="q">Search the docs</label><input id="q" type="search" placeholder="Search the docs" autocomplete="off"></div>
    <nav id="menu" aria-label="Documentation">${nav(current)}</nav>
    <p id="none" class="none" hidden>No page matches.</p>
  </aside>
  <script>(function(){var s=document.getElementById('side'),v=null;try{v=sessionStorage.getItem('docs-side-scroll')}catch(e){}if(v!==null){s.scrollTop=Number(v)||0}else{var h=s.querySelector('[aria-current="page"]');if(h)h.scrollIntoView({block:'center'})}})()</script>
  <main id="content">
    <article class="doc">${body}</article>
  </main>
  ${tocHtml}
</div>
<script src="assets/search-data.js"></script>
<script src="assets/docs.js"></script>
${hasDiagram ? '<script src="assets/mermaid.min.js"></script>\n<script src="assets/diagrams.js"></script>' : ''}
</body>
</html>
`;
}

// --- build ---
rmSync(outDir, { recursive: true, force: true });
mkdirSync(path.join(outDir, 'assets'), { recursive: true });

const searchIndex = [];
const built = [];
for (const page of [...pages, bySrc.get(INDEX)]) {
  const text = readFileSync(path.join(docsDir, page.src), 'utf8');
  const title = page.src === INDEX ? 'Home' : pageTitle(text, page.label);
  const { body, headings, hasDiagram } = render(page, text);
  let html = body;
  if (page.src === INDEX) {
    const lists = GROUPS.map(([group]) => {
      const items = pages.filter((p) => p.group === group);
      return items.length
        ? `<section><h3>${esc(group)}</h3><ul>${items.map((p) => `<li><a href="${p.file}">${esc(p.label)}</a></li>`).join('')}</ul></section>`
        : '';
    }).join('');
    html += `\n<h2 id="all-pages">All pages</h2>\n<div class="cards">${lists}</div>\n`;
  }
  writeFileSync(
    path.join(outDir, page.file),
    shell({ title, body: html, current: page.file, hasDiagram, toc: headings }),
  );
  searchIndex.push({
    file: page.file,
    title: page.label,
    headings: headings.map((h) => ({ id: h.id, text: h.text })),
    text: plain(body).replace(/\s+/g, ' ').toLowerCase(),
  });
  built.push(page.file);
}

writeFileSync(
  path.join(outDir, 'assets', 'search-data.js'),
  'window.DOCS_INDEX=' + JSON.stringify(searchIndex) + ';\n',
);

const brandDir = path.join(root, 'public', 'brand');
for (const f of readdirSync(brandDir)) {
  if (/^(logo-icon|mascot-(?!eyes).*|nusantara-market)\.webp$/.test(f))
    cpSync(path.join(brandDir, f), path.join(outDir, 'assets', f));
}
const mermaidSrc = path.join(root, 'node_modules', 'mermaid', 'dist', 'mermaid.min.js');
if (!existsSync(mermaidSrc)) throw new Error('mermaid is not installed: run pnpm install');
cpSync(mermaidSrc, path.join(outDir, 'assets', 'mermaid.min.js'));
for (const f of ['docs.css', 'docs.js', 'diagrams.js'])
  cpSync(path.join(root, 'scripts', 'docs-site', f), path.join(outDir, 'assets', f));

console.log(`docs site: ${built.length} pages -> docs/site/index.html`);
