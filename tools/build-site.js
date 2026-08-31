#!/usr/bin/env node
/* Calmlyte production build — Brief H.
 *
 * Converts the approved Claude Design artboards in "Calmlyte Approved Site/"
 * into deployable static HTML under build/. The approved sources are read
 * only; nothing in that directory is written to.
 *
 * The conversion is deliberately mechanical. Visible copy is lifted verbatim
 * out of each artboard's <x-dc> block and each artboard's page logic is
 * embedded unedited, so no copy decision is taken at build time. What the
 * build removes is design-tool scaffolding only: the <x-dc> wrapper, the
 * editor props block, authoring-only hover metadata, placeholder hints, and
 * the React/support.js runtime dependency.
 *
 * Usage: node tools/build-site.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { verify: verifyBuild, report: reportAssertions } = require('./verify-build');
const SWAP = require('./studio-panel-swap');
const HOLDERS = require('./image-holders');

/* Artboard-level string rules, applied in order. Both sets assert their match
   counts, so a rule that stops matching fails the build. */
const ARTBOARD_RULES = SWAP.RULES.concat(HOLDERS.RULES);

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'Calmlyte Approved Site');
const OUT = path.join(ROOT, 'build');

/* ------------------------------------------------------------------ *
 * Route map. Design-tool filenames carry spaces and a .dc.html suffix;
 * deployed routes are lowercase and hyphenated. Shop is the site entry,
 * so it becomes index.html rather than shipping as a second URL.
 * ------------------------------------------------------------------ */
const ROUTES = {
  'Shinrin Yoku.dc.html': 'index.html',
  'Shop.dc.html': 'shop.html',
  'Product.dc.html': 'product.html',
  'FAQ.dc.html': 'faq.html',
  'Light.dc.html': 'light.html',
  'Studies.dc.html': 'studies.html',
  'Research.dc.html': 'research.html',
  'Cart.dc.html': 'cart.html'
};

/* The artboards point the masthead logo at Shop, which was the site entry when
   they were drawn. Shinrin Yoku is now the landing page, so the logo is
   retargeted to it — and only the logo. Its anchor is identified by the style
   the artboards give it, which is identical on every page and shared by nothing
   else. Expressed in artboard terms so ROUTES above still does the mapping. */
const LOGO_ANCHOR = '<a href="Shop.dc.html" style="display:flex;align-items:center;gap:11px;';
const LOGO_ANCHOR_HOME = '<a href="Shinrin Yoku.dc.html" style="display:flex;align-items:center;gap:11px;';

/* Product breadcrumb. The artboard sends the brand crumb to Shop and leaves the
   "Shop" crumb as plain text. With Shinrin Yoku as home the brand crumb belongs
   on the landing page, and the Shop crumb becomes the link to the shop. The
   anchor carries the same colour the paragraph already sets, so the rendered
   result is visually identical — only the link targets differ. Written in
   artboard terms so ROUTES still does the mapping. */
const BREADCRUMB =
  '<a href="Shop.dc.html" style="color:#8A9B84">Calmlyte</a> &nbsp;/&nbsp; Shop &nbsp;/&nbsp;';
const BREADCRUMB_REROUTED =
  '<a href="Shinrin Yoku.dc.html" style="color:#8A9B84">Calmlyte</a> &nbsp;/&nbsp; ' +
  '<a href="Shop.dc.html" style="color:#8A9B84">Shop</a> &nbsp;/&nbsp;';

/* Titles and descriptions are drawn from each artboard's own approved copy
   where the page provides a usable sentence, and are otherwise limited to
   naming what is on the page. No product, medical, or legal fact is
   introduced here that the approved master does not already state. */
const META = {
  'index.html': {
    title: 'Calmlyte | Bathing in the Forest Atmosphere',
    desc: 'Shinrin yoku, the Japanese practice of unhurried time spent among trees, and the forest scenes behind Calmlyte.'
  },
  'shop.html': {
    title: 'Shop | Calmlyte Green Light',
    desc: 'Calmlyte is inspired by shinrin yoku, the Japanese practice of bathing in the forest atmosphere. It uses a narrow band of visible green light, around 520 to 530 nm.'
  },
  'product.html': {
    title: 'Calmlyte | Product',
    desc: 'Product details, specifications, imagery, and safety information for the Calmlyte range.'
  },
  'faq.html': {
    title: 'Calmlyte FAQ | Frequently Asked',
    desc: 'Answers about Calmlyte products, the spectrum, sessions, box contents, shipping, returns, and warranty.'
  },
  'light.html': {
    title: 'The Calmlyte Spectrum | Move Along the Visible Range',
    desc: 'Educational. Describes light and lighting, not health outcomes. Not evaluated by the FDA.'
  },
  'studies.html': {
    title: 'Studies | The Calmlyte Reading List',
    desc: 'The reading list behind Calmlyte, tiered by the weight each source can carry, with design caveats stated alongside the findings.'
  },
  'research.html': {
    title: 'The Therapeutic Horizons of Green Light Photobiomodulation | Calmlyte White Paper',
    desc: 'A Calmlyte white paper on independently published research into green light photobiomodulation. The research it summarises was not conducted by Calmlyte and it does not evaluate Calmlyte products.'
  },
  'cart.html': {
    title: 'Calmlyte | Your Cart',
    desc: 'Review the items in your Calmlyte cart.'
  }
};

/* Images re-encoded ahead of the build and substituted for their originals.
   The approved source image is left untouched; only the deployed copy and the
   references to it change. Pre-generated rather than encoded here because the
   build box has no image library — see tools/optimized/README.md. */
const OPTIMIZED = {
  'handheld-card.png': 'handheld-card.webp'
};

/* Assets added to the build that are not part of the approved artboard set.
   Source PNGs live in assets/8.30.26/ and are preserved; these are the WebP
   derivatives, generated at the same pixel dimensions. Kept outside
   'Calmlyte Approved Site/' so that directory stays byte-identical to the set
   recorded in Legal Review. */
const ADDED_ASSETS = {
  /* Shop-card only. A tighter reframe of the same original render; the PDP
     gallery keeps the full-room hero below. */
  'assets/studio-panel/studio-panel-card.webp': 'studio-panel-card.webp',
  'assets/studio-panel/studio-panel-hero.webp': 'studio-panel-hero.webp',
  'assets/studio-panel/studio-panel-side.webp': 'studio-panel-side.webp',
  'assets/studio-panel/studio-panel-rear.webp': 'studio-panel-rear.webp',
  'assets/studio-panel/studio-panel-front.webp': 'studio-panel-front.webp'
};

/* ------------------------------------------------------------------ *
 * Responsive layer.
 *
 * Layout-only CSS added at build time. It exists because the approved
 * artboards may not be edited, and because two of them — Product and Cart —
 * ship no layout breakpoint at all, so both commerce pages render unusable
 * on a phone. Nothing here changes copy, colour, type, or desktop layout:
 * every rule sits inside a max-width media query, so above the widest
 * breakpoint the cascade is untouched.
 *
 * Selectors match on the approved inline style rather than on added classes,
 * so the approved markup stays byte-identical. If an approved style string
 * ever changes, the selector stops matching and the page reverts to its
 * approved behaviour — it cannot silently apply to the wrong element.
 * ------------------------------------------------------------------ */

/* Six nav items plus the wordmark do not fit a 375 px screen at any legible
   size. The approved ladder already hides the wordmark at 560; this lets the
   link row drop to its own centred line rather than clipping off-screen. */
const NAV_RESPONSIVE = `
@media (max-width:560px){
  #dc-root nav{flex-wrap:wrap!important;padding:8px 10px!important;gap:2px 12px!important}
  #dc-root nav > a{flex:0 0 auto!important}
  #dc-root nav > div:last-of-type{flex:1 0 100%!important;justify-content:center!important;flex-wrap:wrap!important;gap:0!important}
  #dc-root nav > div:last-of-type > a{padding:5px 4px!important;font-size:9.5px!important;letter-spacing:.4px!important}
  /* the Cart pill carries its own margin and pill padding — both too wide here */
  #dc-root nav > div:last-of-type > a[style*="border-radius:20px"]{margin-left:4px!important;padding:5px 9px!important}
}`;

const RESPONSIVE = {
  'product.html': `
/* Hero: gallery stacks above the buy column. */
@media (max-width:900px){
  #dc-root [style*="grid-template-columns:minmax(0,1.05fr)"]{grid-template-columns:minmax(0,1fr)!important}
}
/* Specification rows: label above value instead of a 32% label gutter. */
@media (max-width:620px){
  #dc-root [style*="grid-template-columns:minmax(140px,32%)"]{grid-template-columns:minmax(0,1fr)!important;gap:2px!important;padding:11px 0!important}
  #dc-root [style*="grid-template-columns:repeat(5,minmax(0,1fr))"]{grid-template-columns:repeat(4,minmax(0,1fr))!important}
}
/* Clear the taller wrapped nav on this fixed-nav page. */
@media (max-width:560px){
  #dc-root [style*="padding:clamp(112px,8vw,160px)"]{padding-top:132px!important}
}`,

  'cart.html': `
/* Order summary stacks below the line items. */
@media (max-width:820px){
  #dc-root [style*="grid-template-columns:minmax(0,1.6fr)"]{grid-template-columns:minmax(0,1fr)!important}
}
/* Line items: keep all three cells on one row, on a narrower thumbnail. */
@media (max-width:480px){
  #dc-root [style*="grid-template-columns:100px minmax(0,1fr) auto"]{grid-template-columns:72px minmax(0,1fr) auto!important;gap:12px!important;padding:16px!important}
  #dc-root [style*="width:100px;height:100px"]{width:72px!important;height:72px!important}
}`,

  'studies.html': `
/* Tier filter: the row is flex-wrap:nowrap and 402px of chips in a 311px box,
   so at 375px the "Reviews" chip runs past the viewport with nothing to scroll
   to. Let it wrap. */
@media (max-width:560px){
  #dc-root [style*="gap:6px;flex-wrap:nowrap"]{flex-wrap:wrap!important;row-gap:6px!important}
}`
};

const report = {
  pages: [],
  hoverRules: 0,
  responsivePages: [],
  removed: {},
  bindings: new Set(),
  unresolved: [],
  missingAssets: [],
  assetsCopied: [],
  optimized: [],
  added: [],
  excluded: [],
  swapApplied: [],
  swapFailures: [],
  links: new Set()
};

function note(kind, n) { report.removed[kind] = (report.removed[kind] || 0) + n; }

/* ------------------------------------------------------------------ *
 * Markup transforms
 * ------------------------------------------------------------------ */

/* Inline style="" wins over a class rule, so hover declarations carry
   !important — the same thing the design-tool runtime did at render time. */
function importantify(css) {
  return css
    .split(';')
    .map(d => d.trim())
    .filter(Boolean)
    .map(d => (/!\s*important$/i.test(d) ? d : d + ' !important'))
    .join(';');
}

/* Route mapping is applied to the whole text, not just href="" attributes.
 *
 * The artboards also build links inside their page logic as plain string
 * literals — `href: 'Product.dc.html?sku=' + k` for the related-product cards,
 * `href: 'Research.dc.html'` for the white-paper link. An href-only rewriter
 * leaves those pointing at files that do not exist in the build, which is
 * exactly the bug this replaces: three dead links on every product page and one
 * on Studies.
 *
 * Substituting on the bare filename is safe here because `.dc.html` never
 * appears in visible copy anywhere in the approved set — every occurrence is an
 * attribute value or a JS string literal. The build asserts afterwards that no
 * `.dc.html` string survives, so a future artboard that breaks that assumption
 * fails the build rather than shipping a dead link.
 */
function mapRoutes(text, where) {
  for (const [file, route] of Object.entries(ROUTES)) {
    for (const form of [file, file.replace(/ /g, '%20')]) {
      if (!text.includes(form)) continue;
      const n = text.split(form).length - 1;
      text = text.split(form).join(route);
      report.links.add(`${file} -> ${route}  (${n}× in ${where})`);
    }
  }
  return text;
}

function transformBody(html, hoverOut) {
  /* Placeholder hints are editor-only and their values contain {{ }}, so they
     must go before any binding-bearing attribute is touched. */
  let n = 0;
  html = html.replace(/\s+hint-placeholder-(?:count|val)="[^"]*"/g, () => { n++; return ''; });
  note('hint-placeholder attributes', n);

  /* <sc-for list="{{ x }}" as="t">  ->  <sc-for data-list="x" data-as="t"> */
  n = 0;
  html = html.replace(/<sc-for\s+list="\{\{\s*([^}]+?)\s*\}\}"\s+as="([^"]+)"\s*>/g,
    (_, list, as) => { n++; return `<sc-for data-list="${list}" data-as="${as}">`; });
  note('sc-for directives rewritten', n);

  /* <sc-if value="{{ v }}">  ->  <sc-if data-val="v"> */
  n = 0;
  html = html.replace(/<sc-if\s+value="\{\{\s*([^}]+?)\s*\}\}"\s*>/g,
    (_, val) => { n++; return `<sc-if data-val="${val}">`; });
  note('sc-if directives rewritten', n);

  /* ref="{{ x }}"  ->  data-ref="x" */
  n = 0;
  html = html.replace(/\sref="\{\{\s*([^}]+?)\s*\}\}"/g,
    (_, p) => { n++; return ` data-ref="${p}"`; });
  note('ref bindings rewritten', n);

  /* onClick / onPointerDown / ... -> a single data-on="type:path;..." so the
     browser never compiles these as inline handler source. */
  n = 0;
  const EVENT = /\son([A-Z][A-Za-z]*)="\{\{\s*([^}]+?)\s*\}\}"/g;
  const pending = new Map();
  html = html.replace(/<([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g, (whole, tag, attrs) => {
    const handlers = [];
    const stripped = attrs.replace(EVENT, (_, evName, p) => {
      handlers.push(evName.toLowerCase() + ':' + p);
      n++;
      return '';
    });
    if (!handlers.length) return whole;
    return `<${tag}${stripped} data-on="${handlers.join(';')}">`;
  });
  note('event bindings rewritten', n);
  void pending;

  /* style-hover="css" -> generated class + a real :hover rule */
  n = 0;
  html = html.replace(/<([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g, (whole, tag, attrs) => {
    const m = /\sstyle-hover="([^"]*)"/.exec(attrs);
    if (!m) return whole;
    const cls = 'h' + (hoverOut.length).toString(36);
    hoverOut.push(`.${cls}:hover{${importantify(m[1])}}`);
    n++;
    return `<${tag}${attrs.replace(m[0], '')} class="${cls}">`;
  });
  note('style-hover attributes converted', n);

  /* React-cased DOM attributes the HTML parser would lowercase anyway. */
  html = html.replace(/\stabIndex=/g, ' tabindex=');

  /* Point image references at their re-encoded replacements. */
  for (const [from, to] of Object.entries(OPTIMIZED)) {
    html = html.split('assets/' + from).join('assets/' + to);
  }

  /* Retarget the masthead logo to the landing page before routes are mapped. */
  const logos = html.split(LOGO_ANCHOR).length - 1;
  if (logos) {
    html = html.split(LOGO_ANCHOR).join(LOGO_ANCHOR_HOME);
    note('logo anchors retargeted to the landing page', logos);
  }

  /* Same, for the product breadcrumb. */
  const crumbs = html.split(BREADCRUMB).length - 1;
  if (crumbs) {
    html = html.split(BREADCRUMB).join(BREADCRUMB_REROUTED);
    note('product breadcrumbs rerouted', crumbs);
  }

  html = mapRoutes(html, 'markup');

  for (const b of html.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)) report.bindings.add(b[1]);

  return html;
}

/* ------------------------------------------------------------------ *
 * Extraction
 * ------------------------------------------------------------------ */

function slice(src, openRe, closeTag) {
  const open = openRe.exec(src);
  if (!open) return null;
  const start = open.index + open[0].length;
  const end = src.lastIndexOf(closeTag);
  if (end < start) return null;
  return { inner: src.slice(start, end), start: open.index, end: end + closeTag.length };
}

/* Mask -> Studio Panel. Applied to the whole artboard before it is split into
   helmet / markup / logic, so a rule can target either side. Every rule asserts
   its match count: a rule that stops matching fails the build rather than
   silently leaving the Mask in place. */
function applyProductSwap(src, file) {
  let out = src;
  for (const rule of ARTBOARD_RULES) {
    if (rule.file !== file) continue;
    let found;
    if (rule.fromRe) {
      found = (out.match(new RegExp(rule.fromRe.source, rule.fromRe.flags.replace('g', '') + 'g')) || []).length;
      if (found === rule.count) out = out.replace(rule.fromRe, rule.to);
    } else {
      found = out.split(rule.from).length - 1;
      if (found === rule.count) out = out.split(rule.from).join(rule.to);
    }
    if (found !== rule.count) {
      report.swapFailures.push(`${file}: rule "${rule.label}" matched ${found}×, expected ${rule.count}`);
    } else {
      report.swapApplied.push(`${file}: ${rule.label} (${found}×)`);
    }
  }
  /* Any ?sku=mask left over points at a product that no longer exists. */
  const links = out.split(SWAP.SKU_LINK.from).length - 1;
  if (links) {
    out = out.split(SWAP.SKU_LINK.from).join(SWAP.SKU_LINK.to);
    report.swapApplied.push(`${file}: ?${SWAP.SKU_LINK.from} -> ?${SWAP.SKU_LINK.to} (${links}×)`);
  }
  return out;
}

function extract(file) {
  const src = applyProductSwap(fs.readFileSync(path.join(SRC, file), 'utf8'), file);

  const dc = slice(src, /<x-dc(?:\s[^>]*)?>/, '</x-dc>');
  if (!dc) throw new Error('no <x-dc> block in ' + file);

  let body = dc.inner;
  let helmet = '';
  const hel = slice(body, /<helmet(?:\s[^>]*)?>/, '</helmet>');
  if (hel) {
    helmet = hel.inner;
    body = body.slice(0, hel.start) + body.slice(hel.end);
  }

  const scriptOpen = /<script\s+type="text\/x-dc"[^>]*>/.exec(src);
  if (!scriptOpen) throw new Error('no logic script in ' + file);
  const logicStart = scriptOpen.index + scriptOpen[0].length;
  const logic = src.slice(logicStart, src.indexOf('</script>', logicStart));

  /* data-props supplies the defaults the editor would have injected; the
     approved logic reads them as this.props.X ?? fallback. */
  let props = {};
  const pm = /data-props="([\s\S]*?)"\s*>/.exec(scriptOpen[0]);
  if (pm) {
    const json = pm[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    try {
      const spec = JSON.parse(json);
      for (const [k, v] of Object.entries(spec)) {
        if (v && Object.prototype.hasOwnProperty.call(v, 'default')) props[k] = v.default;
      }
      note('editor props blocks removed', 1);
    } catch (e) {
      report.unresolved.push(`${file}: could not parse data-props (${e.message})`);
    }
  }

  return { body, helmet, logic, props };
}

/* ------------------------------------------------------------------ *
 * Emit
 * ------------------------------------------------------------------ */

function buildPage(file, route) {
  const { body, helmet, logic: rawLogic, props } = extract(file);
  const hover = [];
  const markup = transformBody(body, hover);

  /* Image paths also appear inside the page logic (product galleries, cart
     thumbnails), so the same substitution has to reach there. */
  let logic = rawLogic;
  for (const [from, to] of Object.entries(OPTIMIZED)) {
    logic = logic.split('assets/' + from).join('assets/' + to);
  }
  /* Links built by the page logic need the same route mapping as the markup. */
  logic = mapRoutes(logic, 'logic');
  report.hoverRules += hover.length;
  const meta = META[route];

  /* Layout-only, all inside max-width queries. Emitted after the approved
     helmet so it resolves ties, never before it. */
  const responsive = NAV_RESPONSIVE + (RESPONSIVE[route] || '');
  if (RESPONSIVE[route]) report.responsivePages.push(route);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${meta.title}</title>
<meta name="description" content="${meta.desc.replace(/"/g, '&quot;')}">
<!-- No canonical until the live domain is confirmed. -->
${helmet.trim()}
${hover.length ? '<style>\n' + hover.join('\n') + '\n</style>' : ''}
<style data-build="responsive">/* Build-added layout only. No copy, colour, or type. Desktop unaffected. */
${responsive.trim()}
</style>
</head>
<body>
<div id="dc-root"></div>
<template id="dc-template">${markup}</template>
<script src="assets/dc.js"></script>
<script>
DC.page({
  props: ${JSON.stringify(props)},
  logic: function (DCLogic, React) {
${logic.trim()}
    return Component;
  }
});
</script>
</body>
</html>
`;

  fs.writeFileSync(path.join(OUT, route), html);
  report.pages.push({ route, file, bytes: Buffer.byteLength(html), hover: hover.length });
}

/* ------------------------------------------------------------------ *
 * Assets
 * ------------------------------------------------------------------ */

function copyAssets() {
  const from = path.join(SRC, 'assets');
  const to = path.join(OUT, 'assets');
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from)) {
    const s = fs.statSync(path.join(from, f));
    if (!s.isFile()) continue;

    /* Withdrawn-product imagery: present in the approved set, referenced by no
       page, so not shipped. */
    if (SWAP.EXCLUDED_ASSETS.includes(f)) {
      report.excluded.push({ name: f, bytes: s.size });
      continue;
    }

    const swap = OPTIMIZED[f];
    if (swap) {
      const src = path.join(ROOT, 'tools', 'optimized', swap);
      if (!fs.existsSync(src)) {
        report.unresolved.push(`optimized asset missing: tools/optimized/${swap}`);
        fs.copyFileSync(path.join(from, f), path.join(to, f));
        report.assetsCopied.push({ name: f, bytes: s.size });
        continue;
      }
      fs.copyFileSync(src, path.join(to, swap));
      const after = fs.statSync(src).size;
      report.assetsCopied.push({ name: swap, bytes: after });
      report.optimized.push({ from: f, to: swap, before: s.size, after });
      continue;
    }

    fs.copyFileSync(path.join(from, f), path.join(to, f));
    report.assetsCopied.push({ name: f, bytes: s.size });
  }
  fs.copyFileSync(path.join(ROOT, 'tools', 'dc-runtime.js'), path.join(to, 'dc.js'));

  /* Assets added outside the approved artboard set. */
  for (const [from, name] of Object.entries(ADDED_ASSETS)) {
    const srcPath = path.join(ROOT, from);
    if (!fs.existsSync(srcPath)) {
      report.unresolved.push('added asset missing: ' + from);
      continue;
    }
    fs.copyFileSync(srcPath, path.join(to, name));
    const bytes = fs.statSync(srcPath).size;
    report.assetsCopied.push({ name, bytes });
    report.added.push({ name, from, bytes });
  }
}

function checkAssetRefs() {
  const have = new Set(fs.readdirSync(path.join(OUT, 'assets')));
  for (const p of report.pages) {
    /* Comments carry provenance notes that name repo paths (e.g. the nav
       ladder's "from calmlyte/assets/site.css"); those are prose, not refs. */
    const html = fs.readFileSync(path.join(OUT, p.route), 'utf8')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/\/\*[\s\S]*?\*\//g, ' ');
    for (const m of html.matchAll(/assets\/([A-Za-z0-9._-]+)/g)) {
      const name = m[1];
      /* 'assets/forest-' is a runtime concatenation, not a literal path. */
      if (name.endsWith('-') || name === 'dc.js') continue;
      if (!have.has(name)) report.missingAssets.push(`${p.route} -> assets/${name}`);
    }
  }
}

/* ------------------------------------------------------------------ */

function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  copyAssets();
  for (const [file, route] of Object.entries(ROUTES)) buildPage(file, route);
  checkAssetRefs();

  console.log('PAGES');
  for (const p of report.pages) {
    console.log(`  ${p.route.padEnd(20)} <- ${p.file.padEnd(24)} ${String(p.bytes).padStart(7)} B  ${p.hover} hover rules`);
  }
  console.log('\nDESIGN-TOOL ELEMENTS REMOVED');
  for (const [k, v] of Object.entries(report.removed)) console.log(`  ${String(v).padStart(4)}  ${k}`);
  console.log(`  ${String(report.pages.length).padStart(4)}  x-dc wrappers`);
  console.log(`  ${String(report.pages.length).padStart(4)}  support.js runtime dependencies`);

  console.log(`\nBINDINGS: ${report.bindings.size} distinct`);
  console.log(`LINKS REWRITTEN: ${report.links.size} distinct`);
  for (const l of [...report.links].sort()) console.log('  ' + l);

  console.log('\nPRODUCT SWAP (Mask -> Studio Panel)');
  for (const a of report.swapApplied) console.log('  applied  ' + a);
  if (report.swapFailures.length) {
    console.error('\nBUILD FAILED — product swap did not apply cleanly:');
    for (const f of report.swapFailures) console.error('  ' + f);
    process.exit(1);
  }

  console.log('\nEXCLUDED ASSETS (withdrawn product, not shipped)');
  if (!report.excluded.length) console.log('  none');
  for (const e of report.excluded) {
    console.log(`  ${e.name.padEnd(26)} ${(e.bytes / 1024).toFixed(0).padStart(5)} KB   (kept in the approved set)`);
  }

  console.log('\nADDED ASSETS (outside the approved set)');
  if (!report.added.length) console.log('  none');
  for (const a of report.added) {
    console.log(`  ${a.name.padEnd(26)} ${(a.bytes / 1024).toFixed(0).padStart(5)} KB   <- ${a.from}`);
  }

  console.log('\nIMAGE OPTIMIZATION');
  if (!report.optimized.length) console.log('  none');
  for (const o of report.optimized) {
    const pct = (100 - (o.after / o.before) * 100).toFixed(1);
    console.log(`  ${o.from} -> ${o.to}  ${(o.before / 1048576).toFixed(2)} MB -> ${(o.after / 1024).toFixed(0)} KB  (-${pct}%)`);
  }

  console.log(`\nASSETS COPIED: ${report.assetsCopied.length}`);
  const big = report.assetsCopied.filter(a => a.bytes > 500000).sort((a, b) => b.bytes - a.bytes);
  if (big.length) {
    console.log('  over 500 KB:');
    for (const a of big) console.log(`    ${(a.bytes / 1048576).toFixed(2)} MB  ${a.name}`);
  }

  console.log(`\nMISSING ASSETS: ${report.missingAssets.length}`);
  for (const m of report.missingAssets) console.log('  ' + m);
  console.log(`UNRESOLVED: ${report.unresolved.length}`);
  for (const u of report.unresolved) console.log('  ' + u);

  process.exitCode = reportAssertions(verifyBuild(OUT));
}

main();
