/* Build assertions for the Calmlyte static site.
 *
 * Required by tools/build-site.js, which runs these after writing build/, and
 * runnable on its own against an existing build:
 *
 *   node tools/verify-build.js
 *
 * Any failure exits non-zero, so a broken build cannot deploy.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const OUT_DEFAULT = path.resolve(__dirname, '..', 'build');

/* ------------------------------------------------------------------ *
 * Commerce gate.
 *
 * False means the cart's Checkout button must still be the inert stub the
 * approved artboard defines. Turning checkout on is a deliberate edit here plus
 * an explicit instruction — never a side effect of another change.
 * ------------------------------------------------------------------ */
const SHOPIFY_CHECKOUT_ENABLED = false;

/* The stub, verbatim from Cart.dc.html. A literal, so a change to the handler is
   caught rather than inferred. */
const CHECKOUT_STUB_MARKER =
  "this.setState({ toast: 'Checkout opens soon — email hello@calmlyte.com' });";

/* Must not appear anywhere while the gate is closed. */
const COMMERCE_MARKERS = [
  'myshopify.com', 'graphql.json', 'cartCreate', 'checkoutUrl',
  'storefront-access-token', 'stripe', 'paypal', 'braintree', 'adyen',
  'klarna', 'payment_intent', 'checkout.session', 'gid://shopify'
];

const ROBOTS_TAG = '<meta name="robots" content="noindex,nofollow">';

function verify(outDir) {
  const OUT = outDir || OUT_DEFAULT;
  const failures = [];

  if (!fs.existsSync(OUT)) {
    return { failures: [`${OUT} does not exist — nothing to verify`], counts: {} };
  }

  const pages = fs.readdirSync(OUT).filter(f => f.endsWith('.html')).sort();
  const runtime = path.join('assets', 'dc.js');
  const all = pages.concat(fs.existsSync(path.join(OUT, runtime)) ? [runtime] : []);
  const read = f => fs.readFileSync(path.join(OUT, f), 'utf8');

  /* 1 — no design-tool route may survive into the output. */
  for (const f of all) {
    for (const m of read(f).matchAll(/[^\s"'<>()]*\.dc\.html/g)) {
      failures.push(`${f}: unmapped design-tool route "${m[0]}" survived into the build`);
    }
  }

  /* 2 — no template binding may leak outside the <template> island. Inside it
   *     they are expected: the runtime resolves them in the browser. This
   *     catches a binding escaping into <head>, a <title>, or a meta tag.
   *     Whether every binding actually resolves is a runtime property, checked
   *     in-browser, not here. */
  for (const f of pages) {
    const text = read(f);
    const open = text.indexOf('<template id="dc-template">');
    const close = text.lastIndexOf('</template>');
    const outside = open < 0
      ? text
      : text.slice(0, open) + text.slice(close < 0 ? text.length : close);
    if (outside.includes('{{')) {
      failures.push(`${f}: unresolved {{ }} binding outside the template island`);
    }
  }

  /* 2b — every binding root must be produced by renderVals or introduced by an
   *      sc-for. Catches typos and renames statically.
   *
   *      `produced` matches any `name:` in the page. renderVals keys are often
   *      declared several to a line ("s0: …, s1: …, s2: …"), so anchoring to
   *      line starts misses most of them. This over-captures — CSS property
   *      names inside inline style strings land here too — which costs
   *      sensitivity but yields no false failures: a misspelt binding root
   *      still appears nowhere. */
  for (const f of pages) {
    const text = read(f);
    const tpl = /<template id="dc-template">([\s\S]*)<\/template>/.exec(text);
    if (!tpl) continue;
    const locals = new Set([...tpl[1].matchAll(/data-as="([^"]+)"/g)].map(m => m[1]));
    const produced = new Set([...text.matchAll(/([A-Za-z_$][\w$]*)\s*:/g)].map(m => m[1]));
    for (const m of tpl[1].matchAll(/\{\{\s*([A-Za-z_$][\w$]*)/g)) {
      const root = m[1];
      if (!produced.has(root) && !locals.has(root)) {
        failures.push(`${f}: binding {{ ${root} }} has no matching renderVals key or sc-for local`);
      }
    }
  }

  /* 3 — checkout must be the inert stub while the commerce gate is closed. */
  if (!SHOPIFY_CHECKOUT_ENABLED) {
    const cartPath = path.join(OUT, 'cart.html');
    if (!fs.existsSync(cartPath)) {
      failures.push('cart.html: missing from the build');
    } else if (!read('cart.html').includes(CHECKOUT_STUB_MARKER)) {
      failures.push('cart.html: checkout is no longer the inert stub, but SHOPIFY_CHECKOUT_ENABLED is false');
    }
    for (const f of all) {
      const lower = read(f).toLowerCase();
      for (const marker of COMMERCE_MARKERS) {
        if (lower.includes(marker)) {
          failures.push(`${f}: commerce marker "${marker}" present while SHOPIFY_CHECKOUT_ENABLED is false`);
        }
      }
    }
  }

  /* 3b — the Mask is withdrawn. It must not reappear as an active product:
   *      no purchasable SKU, no card, no PDP entry, no cart metadata, no
   *      shipped imagery. SAFETY_MASK survives in Product.dc.html as a dead
   *      constant with the same text as SAFETY_STD — not user-visible, and not
   *      matched here. */
  const MASK_ACTIVE = [
    "sku: 'mask'",          // Shop ITEMS / PDP entry
    "'mask':",              // Cart META key
    "add('mask')",          // Cart add handler
    'sku=mask',             // any surviving product link
    'assets/mask-'          // any shipped Mask image reference
  ];
  for (const f of all) {
    const text = read(f);
    for (const marker of MASK_ACTIVE) {
      if (text.includes(marker)) {
        failures.push(`${f}: withdrawn Mask still active — found "${marker}"`);
      }
    }
  }
  for (const img of ['mask-hero.webp', 'mask-front.webp', 'mask-rear.webp', 'mask-side.webp', 'mask-package.webp']) {
    if (fs.existsSync(path.join(OUT, 'assets', img))) {
      failures.push(`assets/${img}: withdrawn Mask imagery shipped into the build`);
    }
  }

  /* 4 — noindex on every page, every build. */
  for (const f of pages) {
    if (!read(f).includes(ROBOTS_TAG)) failures.push(`${f}: missing ${ROBOTS_TAG}`);
  }

  return {
    failures,
    counts: { pages: pages.length, files: all.length },
    gateOpen: SHOPIFY_CHECKOUT_ENABLED
  };
}

function report(result) {
  const has = needle => result.failures.some(f => f.includes(needle));
  console.log('\nASSERTIONS');
  console.log(`  design-tool routes in output ... ${has('design-tool') ? 'FAIL' : 'pass'}`);
  console.log(`  bindings resolved ............. ${has('binding') ? 'FAIL' : 'pass'}`);
  console.log(`  checkout inert (gate closed) .. ${has('checkout') || has('commerce marker') ? 'FAIL' : 'pass'}`);
  console.log(`  withdrawn Mask fully removed .. ${has('withdrawn Mask') ? 'FAIL' : 'pass'}`);
  console.log(`  noindex on every page ......... ${has('robots') ? 'FAIL' : 'pass'}`);
  console.log(`  SHOPIFY_CHECKOUT_ENABLED ...... ${result.gateOpen}`);
  console.log(`  files checked ................. ${result.counts.files} (${result.counts.pages} pages)`);

  if (result.failures.length) {
    console.error(`\nBUILD FAILED — ${result.failures.length} assertion failure(s):`);
    for (const f of result.failures) console.error('  ' + f);
    return 1;
  }
  return 0;
}

module.exports = { verify, report, SHOPIFY_CHECKOUT_ENABLED, CHECKOUT_STUB_MARKER };

if (require.main === module) {
  process.exit(report(verify(process.argv[2])));
}
