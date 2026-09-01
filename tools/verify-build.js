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
const { PRODUCTS, SHOP_DOMAIN, VARIANTS_FILE } = require('./shopify-catalog');
const CHECKOUT = require('./checkout-wiring');

const OUT_DEFAULT = path.resolve(__dirname, '..', 'build');

/* ------------------------------------------------------------------ *
 * Commerce gate.
 *
 * The flag lives with the code it gates, in tools/checkout-wiring.js, so there is
 * one switch rather than two that can disagree. Closed means the cart's Checkout
 * button must still be the inert stub the approved artboard defines; open means
 * real checkout code must be present and correct. Either way it is asserted, not
 * assumed.
 * ------------------------------------------------------------------ */
const SHOPIFY_CHECKOUT_ENABLED = CHECKOUT.CHECKOUT_ENABLED;

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

  /* 3 — the checkout button must match the gate, in both directions. */
  const cartPath = path.join(OUT, 'cart.html');
  if (!fs.existsSync(cartPath)) {
    failures.push('cart.html: missing from the build');
  } else if (!SHOPIFY_CHECKOUT_ENABLED) {
    /* Gate closed: the artboard's inert stub, and no commerce anywhere. */
    if (!read('cart.html').includes(CHECKOUT_STUB_MARKER)) {
      failures.push('cart.html: checkout is no longer the inert stub, but the commerce gate is closed');
    }
    for (const f of all) {
      const lower = read(f).toLowerCase();
      for (const marker of COMMERCE_MARKERS) {
        if (lower.includes(marker)) {
          failures.push(`${f}: commerce marker "${marker}" present while the commerce gate is closed`);
        }
      }
    }
  } else {
    /* Gate open. Checkout takes money, so every property it depends on is
       asserted rather than trusted to have survived the last edit. */
    const cart = read('cart.html');
    const variants = JSON.parse(fs.readFileSync(path.join(__dirname, VARIANTS_FILE), 'utf8'));

    /* 3-i  the stub must be gone — otherwise the substitution silently no-oped
            and the button still does nothing. */
    if (cart.includes(CHECKOUT_STUB_MARKER)) {
      failures.push('cart.html: the inert stub is still present while the commerce gate is open — the substitution did not apply');
    }

    /* 3-ii the real handler, and the guards that make it safe. Each of these is
            a behaviour the brief asked for; asserting the marker means a future
            edit cannot quietly drop one. */
    const REQUIRED = [
      ['cartCreate mutation',        'mutation CartCreate'],
      ['redirect to checkoutUrl',    'window.location.href = out.cart.checkoutUrl'],
      ['empty-cart guard',           'if (!cart.length)'],
      ['double-submit guard',        'if (this._checkingOut) return;'],
      ['unknown-variant guard',      'if (!gid)'],
      ['subtotal parity check',      'subtotal mismatch:'],
      ['request timeout',            'abort.abort()'],
      ['failure keeps the cart',     'checkout failed:']
    ];
    for (const [label, marker] of REQUIRED) {
      if (!cart.includes(marker)) failures.push(`cart.html: ${label} missing from the checkout handler`);
    }

    /* 3-iii the SKU -> variant map, compared pair by pair against the verified
             file.
     *
     *       Whole quoted values, not substrings. Matching /gid:...\/\d+/ inside
     *       the page finds the right GID inside a wrong one — a trailing
     *       character appended to a merchandiseId passes a substring check and
     *       then fails at Shopify. And comparing the two as *sets* would accept a
     *       map whose entries had been swapped, which charges the customer for a
     *       different product than the one they picked. Both were live holes here
     *       until a fault-injection run appended an X to a GID and nothing
     *       failed. */
    const block = /var VARIANTS = \{([\s\S]*?)\n\s*\};/.exec(cart);
    if (!block) {
      failures.push('cart.html: no VARIANTS map found in the checkout handler');
    } else {
      const pairs = new Map(
        [...block[1].matchAll(/"([^"]+)"\s*:\s*"([^"]*)"/g)].map(m => [m[1], m[2]])
      );
      const skus = Object.keys(PRODUCTS);
      if (pairs.size !== skus.length) {
        failures.push(`cart.html: VARIANTS map has ${pairs.size} entries, expected ${skus.length}`);
      }
      for (const sku of skus) {
        const want = variants.variants[sku].variantId;
        if (!pairs.has(sku)) {
          failures.push(`cart.html: VARIANTS map has no entry for SKU "${sku}"`);
        } else if (pairs.get(sku) !== want) {
          failures.push(`cart.html: SKU "${sku}" maps to "${pairs.get(sku)}", verified GID is "${want}"`);
        }
      }
      for (const sku of pairs.keys()) {
        if (!skus.includes(sku)) failures.push(`cart.html: VARIANTS map sells unknown SKU "${sku}"`);
      }
    }

    /* No ProductVariant GID anywhere in the build may be outside the verified
       set — one that is was never checked against a SKU or a price. */
    const verified = new Set(Object.keys(PRODUCTS).map(sku => variants.variants[sku].variantId));
    for (const f of all) {
      for (const m of read(f).matchAll(/gid:\/\/shopify\/ProductVariant\/[0-9]+[0-9A-Za-z_-]*/g)) {
        if (!verified.has(m[0])) failures.push(`${f}: unverified variant "${m[0]}" shipped in the build`);
      }
    }

    /* 3-iv the request must go to this shop and no other host. */
    if (!cart.includes(SHOP_DOMAIN)) {
      failures.push(`cart.html: checkout does not reference ${SHOP_DOMAIN}`);
    }
    for (const m of cart.matchAll(/[A-Za-z0-9-]+\.myshopify\.com/g)) {
      if (m[0] !== SHOP_DOMAIN) failures.push(`cart.html: checkout references a foreign shop "${m[0]}"`);
    }

    /* 3-v  a Storefront public token is expected in the page — that is how the
            Storefront API is designed to be called from a browser. A privileged
            token is not, ever, on any page. This is the assertion that matters
            most: it is the one thing here that could publish a secret. */
    for (const f of all) {
      const text = read(f);
      for (const m of text.matchAll(/shp(?:at|ca|pa|ss)_[A-Za-z0-9]{4,}/g)) {
        failures.push(`${f}: a privileged Shopify token (${m[0].slice(0, 6)}…) reached the build`);
      }
    }
    if (!/'[0-9a-f]{32}'/.test(cart) && !/"[0-9a-f]{32}"/.test(cart)) {
      failures.push('cart.html: no Storefront public token embedded — the Checkout button cannot work');
    }

    /* 3-vi checkout belongs on the cart page alone. A token or a mutation on
            another page means the substitution leaked. */
    for (const f of all) {
      if (f === 'cart.html') continue;
      const text = read(f);
      if (text.includes('cartCreate') || /X-Shopify-Storefront-Access-Token/i.test(text)) {
        failures.push(`${f}: checkout code leaked outside cart.html`);
      }
    }

    /* 3-vii no third-party payment processor. Shopify hosts the payment page;
             nothing else should be in here. */
    const lower = cart.toLowerCase();
    for (const marker of ['stripe', 'paypal', 'braintree', 'adyen', 'klarna', 'payment_intent', 'checkout.session']) {
      if (lower.includes(marker)) failures.push(`cart.html: unexpected payment marker "${marker}"`);
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

  /* 3c — internal editorial markers must never reach a public page. [FACTS:] and
   *      [LEGAL:] are working notes: an unconfirmed row is withheld, not shipped
   *      with its own to-do visible. Three of these were live on the staging
   *      domain before being caught by eye rather than by the build. */
  for (const f of all) {
    const text = read(f);
    for (const m of text.matchAll(/\[(?:FACTS|LEGAL):[^\]]*\]/g)) {
      failures.push(`${f}: internal marker "${m[0]}" reached the build`);
    }
  }

  /* 4 — noindex on every page, every build. */
  for (const f of pages) {
    if (!read(f).includes(ROBOTS_TAG)) failures.push(`${f}: missing ${ROBOTS_TAG}`);
  }

  /* 4g — vercel.json: the retired route redirects, and noindex still applies.
   *
   *      Two things live in that file that nothing else can enforce. The
   *      X-Robots-Tag header is half of the noindex posture — the meta tags in
   *      the pages are the other half, and a page-level check cannot see a
   *      config-level deletion. And /faq.html now only resolves because of a
   *      redirect; drop it and a URL that used to work starts 404ing silently.
   *
   *      The redirect is also checked for coherence: its destination must be a
   *      page that exists, and its source must not be, because a rebuilt
   *      faq.html and a redirect away from it are contradictory instructions. */
  {
    const vjPath = path.resolve(__dirname, '..', 'vercel.json');
    if (!fs.existsSync(vjPath)) {
      failures.push('vercel.json: missing');
    } else {
      let vj = null;
      try { vj = JSON.parse(fs.readFileSync(vjPath, 'utf8')); }
      catch (e) { failures.push(`vercel.json: not valid JSON (${e.message})`); }

      if (vj) {
        const hdr = (vj.headers || []).find(h => h.source === '/(.*)');
        const robots = hdr && (hdr.headers || []).find(
          x => x.key === 'X-Robots-Tag' && /noindex/.test(x.value) && /nofollow/.test(x.value));
        if (!robots) {
          failures.push('vercel.json: the site-wide X-Robots-Tag noindex header is gone');
        }

        const r = (vj.redirects || []).find(x => x.source === '/faq.html');
        if (!r) {
          failures.push('vercel.json: /faq.html no longer redirects — the retired route would 404');
        } else {
          if (r.destination !== '/shop.html') {
            failures.push(`vercel.json: /faq.html redirects to "${r.destination}", expected /shop.html`);
          }
          const dest = r.destination.replace(/^\//, '');
          if (dest && !pages.includes(dest)) {
            failures.push(`vercel.json: /faq.html redirects to "${r.destination}", which is not a built page`);
          }
          if (pages.includes('faq.html')) {
            failures.push('vercel.json: /faq.html both redirects and is built — contradictory');
          }
        }
      }
    }
  }

  /* 4f — the FAQ page is retired. It must be gone, and nothing may point at it.
   *
   *      A stale link would already fail assertion 1 as an unmapped
   *      design-tool route, but only because faq.html is no longer a route. If
   *      the page were ever half-restored the link would resolve and the nav
   *      item would quietly come back, so the end state is asserted directly:
   *      no page, no href, no nav item. The product-page Questions module is
   *      what replaced it, and it is asserted separately in 4d. */
  {
    const RETIRE = require('./faq-retire');
    if (pages.includes('faq.html')) {
      failures.push('faq.html: the FAQ page is retired but was built');
    }
    for (const f of all) {
      const text = read(f);
      const hrefs = (text.match(/href="faq\.html"/g) || []).length;
      if (hrefs) failures.push(`${f}: ${hrefs} link(s) to the retired faq.html`);
      if (text.includes(RETIRE.NAV_ITEM)) {
        failures.push(`${f}: the FAQ nav item is still present`);
      }
      /* The nav item after route mapping, which is what would actually ship. */
      if (/>FAQ<\/a>/.test(text)) failures.push(`${f}: a nav item still reads "FAQ"`);
    }
  }

  /* 4e — US-only must hold across the whole built site.
   *
   *      The store enforces it (one country at checkout) and the policies state
   *      it, but the FAQ said "Yes" to international shipping for a while after
   *      the decision was made. That is the failure mode worth guarding: a
   *      decision taken in one place and not propagated to a page that answers
   *      questions about it. A customer who reads the FAQ and believes they can
   *      order finds no country to select. */
  {
    const FAQFIX = require('./faq-corrections');
    for (const f of all) {
      const text = read(f);
      for (const phrase of FAQFIX.FORBIDDEN) {
        if (text.includes(phrase)) {
          failures.push(`${f}: claims international shipping — "${phrase}"`);
        }
      }
    }
    if (pages.includes('faq.html')) {
      const faq = read('faq.html');
      if (faq.includes('Do you ship internationally?') &&
          !faq.includes(FAQFIX.US_ONLY_ANSWER)) {
        failures.push('faq.html: the international-shipping question is not answered with the US-only text');
      }
    }
  }

  /* 4d — product page conversion changes.
   *
   *      The point of both is that the reader stays put: the mechanism is stated
   *      before the price, and objections are answered below the specs instead of
   *      on another page. So the assertion checks the outbound link is gone, the
   *      questions module is present, and every SKU has a non-empty question set.
   *
   *      The question text is compared against tools/pdp-conversion.js rather
   *      than merely counted, because the whole point is that these answers are
   *      the approved FAQ answers verbatim — a paraphrase would defeat it. */
  if (pages.includes('product.html')) {
    const PDP = require('./pdp-conversion');
    const HERO = require('./pdp-hero-copy');
    const prod = read('product.html');

    /* The claim paragraph, once, above the price. */
    if (!prod.includes(HERO.CLAIM)) {
      failures.push('product.html: the claim paragraph is missing');
    } else if (prod.indexOf(HERO.CLAIM) > prod.indexOf('{{ price }}')) {
      failures.push('product.html: the claim paragraph is below the price, expected above it');
    }

    /* It must not be set smaller than the body copy. Checking the rendered style
       string rather than trusting the rule: the whole point of Jake's
       instruction was that an earlier pass had set it two-and-a-half points
       smaller than the lede, so "same size as body" is the property to assert,
       not "a paragraph exists". */
    const claimP = new RegExp(`<p style="([^"]*)"[^>]*>${HERO.CLAIM.slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
    const m = claimP.exec(prod);
    if (!m) {
      failures.push('product.html: could not find the claim paragraph to check its size');
    } else if (!m[1].includes(HERO.BODY)) {
      failures.push(`product.html: the claim paragraph is not body size/weight — got "${m[1]}"`);
    }

    /* Each product's own two sentences, and the binding that carries the second. */
    for (const sku of Object.keys(HERO.COPY)) {
      const c = HERO.COPY[sku];
      if (!prod.includes(`lede: '${c.lede}'`)) {
        failures.push(`product.html: "${sku}" does not carry its new lede`);
      }
      if (!prod.includes(`spectrum: '${c.spectrum}'`)) {
        failures.push(`product.html: "${sku}" does not carry its spectrum sentence`);
      }
      if (prod.includes(c.oldLede)) {
        failures.push(`product.html: "${sku}" still carries the old lede`);
      }
    }
    if (!prod.includes('spectrum: p.spectrum')) {
      failures.push('product.html: renderVals does not expose spectrum');
    }
    if (prod.includes('More questions')) {
      failures.push('product.html: the outbound "More questions" link is still present');
    }
    if (!prod.includes('>Questions</h2>')) {
      failures.push('product.html: the questions module is missing');
    }
    if (!prod.includes('faqs: (p.faqs || [])')) {
      failures.push('product.html: renderVals does not expose faqs');
    }
    for (const sku of Object.keys(PDP.PER_SKU)) {
      const at = prod.indexOf(`sku: '${sku}'`);
      if (at < 0) { failures.push(`product.html: no PDP entry for "${sku}"`); continue; }
      const seg = prod.slice(at, at + 6000);
      const open = seg.indexOf('faqs: [');
      if (open < 0) { failures.push(`product.html: "${sku}" has no faqs array`); continue; }
      const arr = seg.slice(open, seg.indexOf('\n    ],', open));
      const asked = [...arr.matchAll(/\['([^']+)'/g)].map(m => m[1]);
      const want = PDP.PER_SKU[sku].map(k => PDP.A[k][0]);
      if (asked.length !== want.length) {
        failures.push(`product.html: "${sku}" has ${asked.length} question(s), expected ${want.length}`);
      }
      /* Question and answer are both checked inside this SKU's own array, not
         across the whole page. A page-wide `includes` would let one product's
         paraphrased answer hide behind another product's correct copy of it —
         which is exactly what happened when this check was fault-injected. */
      for (const key of PDP.PER_SKU[sku]) {
        const [q, a] = PDP.A[key];
        if (!asked.includes(q)) {
          failures.push(`product.html: "${sku}" is missing the question "${q}"`);
        }
        if (!arr.includes(a.replace(/'/g, "\\'"))) {
          failures.push(`product.html: "${sku}" — the answer to "${q}" is not the approved text`);
        }
      }
    }
  }

  /* 4c — favicons and social preview: the tags on every page, and the files they
   *      point at actually present in the output.
   *
   *      Both halves matter. Tags without files give a blank tab and a broken
   *      share card; files without tags are dead weight. And og:url is checked
   *      per page against the canonical map — a share card that carries the
   *      wrong page's URL sends every reader to the wrong place, which no amount
   *      of correct markup elsewhere reveals. */
  const HEAD_TAGS = [
    '<link rel="icon" href="/favicon.ico" sizes="any">',
    'sizes="32x32" href="/favicon-32x32.png"',
    'sizes="16x16" href="/favicon-16x16.png"',
    'rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"',
    'property="og:type" content="website"',
    'property="og:site_name" content="Calmlyte"',
    'property="og:title"',
    'property="og:description"',
    'property="og:url"',
    'property="og:image"',
    'property="og:image:width" content="1200"',
    'property="og:image:height" content="630"',
    'name="twitter:card" content="summary_large_image"',
    'name="twitter:title"',
    'name="twitter:description"',
    'name="twitter:image"'
  ];
  const SOCIAL_URL = 'https://www.calmlyte.com/assets/calmlyte-social-preview.jpg';
  const CANON = {
    'index.html': 'https://www.calmlyte.com/',
    'shop.html': 'https://www.calmlyte.com/shop.html',
    'product.html': 'https://www.calmlyte.com/product.html',
    'light.html': 'https://www.calmlyte.com/light.html',
    'studies.html': 'https://www.calmlyte.com/studies.html',
    'research.html': 'https://www.calmlyte.com/research.html',
    'cart.html': 'https://www.calmlyte.com/cart.html'
  };
  for (const f of pages) {
    const text = read(f);
    const head = text.slice(0, text.indexOf('</head>'));
    for (const tag of HEAD_TAGS) {
      if (!head.includes(tag)) failures.push(`${f}: head is missing ${tag}`);
    }
    for (const prop of ['og:image', 'twitter:image']) {
      const re = new RegExp(`(?:property|name)="${prop}" content="([^"]+)"`);
      const m = re.exec(head);
      if (m && m[1] !== SOCIAL_URL) failures.push(`${f}: ${prop} is "${m[1]}", expected ${SOCIAL_URL}`);
    }
    const want = CANON[f];
    const got = (/property="og:url" content="([^"]+)"/.exec(head) || [])[1];
    if (want && got !== want) failures.push(`${f}: og:url is "${got}", expected "${want}"`);
    /* Titles and descriptions must be the page's own, not another page's. */
    const ogT = (/property="og:title" content="([^"]+)"/.exec(head) || [])[1];
    const twT = (/name="twitter:title" content="([^"]+)"/.exec(head) || [])[1];
    const docT = (/<title>([^<]*)<\/title>/.exec(head) || [])[1];
    if (ogT !== docT) failures.push(`${f}: og:title "${ogT}" does not match <title> "${docT}"`);
    if (twT !== docT) failures.push(`${f}: twitter:title "${twT}" does not match <title> "${docT}"`);
  }
  for (const f of ['favicon.ico', 'favicon-16x16.png', 'favicon-32x32.png',
                   'apple-touch-icon.png', path.join('assets', 'calmlyte-social-preview.jpg')]) {
    if (!fs.existsSync(path.join(OUT, f))) failures.push(`${f}: referenced in every head but not in the build`);
  }

  /* 4b — the policy footer must be on every page, with all four links.
   *
   *      The site promises free US shipping, 30-day returns and a 1-year
   *      warranty; the documents backing those promises live on Shopify, and
   *      these links are the only route to them. A page that quietly loses the
   *      footer is a page making commitments with nothing behind them, so the
   *      count is asserted rather than eyeballed. Whole URLs are compared, since
   *      a link to the wrong slug still looks right in a nav. */
  const POLICY_SLUGS = ['privacy-policy', 'terms-of-service', 'shipping-policy', 'refund-policy'];
  for (const f of pages) {
    const text = read(f);
    if (!text.includes('class="cl-policy"')) {
      failures.push(`${f}: policy footer missing`);
      continue;
    }
    for (const slug of POLICY_SLUGS) {
      const url = `https://${SHOP_DOMAIN}/policies/${slug}`;
      const n = text.split(`href="${url}"`).length - 1;
      if (n !== 1) failures.push(`${f}: policy footer has ${n} link(s) to ${slug}, expected 1`);
    }
    /* No policy link may point anywhere but this shop. */
    for (const m of text.matchAll(/href="(https?:\/\/[^"]*\/policies\/[^"]*)"/g)) {
      if (!m[1].startsWith(`https://${SHOP_DOMAIN}/policies/`)) {
        failures.push(`${f}: policy link points off-store: ${m[1]}`);
      }
    }
  }

  /* 5 — the site and the Shopify catalogue must agree on SKU and price.
   *
   *     The site states a price on three surfaces — the Shop card, the PDP entry
   *     and the cart META — and Shopify states a fourth on the variant. Once
   *     checkout is live, the cart total a customer reads comes from the site and
   *     the amount they are charged comes from Shopify, so a price edited on one
   *     side and not the other is a mispriced sale, not a cosmetic drift. It fails
   *     the build here instead.
   *
   *     Prices are read out of the built pages rather than the artboards, because
   *     the built page is what a visitor is served — a build-time substitution
   *     that changed a price would otherwise slip past.
   *
   *     A surface yielding fewer than four SKUs is itself a failure: it means the
   *     artboard was reformatted and these patterns silently stopped matching,
   *     which would read as a pass.
   *
   *     Variant GIDs are not checked here. They are not in the built output while
   *     the gate is closed, and they are verified against SKU, price, currency and
   *     availability at resolution time by tools/resolve-variants.js. */
  const SURFACES = [
    { file: 'shop.html',    label: 'Shop card',  re: /\{ sku: '([a-z-]+)', name: '[^']*', price: (\d+)/g },
    { file: 'product.html', label: 'PDP entry',  re: /sku: '([a-z-]+)', name: '[^']*', title: '[^']*', price: '[^']*', priceN: (\d+)/g },
    { file: 'cart.html',    label: 'cart META',  re: /'([a-z-]+)': \{ img: '[^']*', tag: '[^']*', price: (\d+)/g }
  ];
  const catalogSkus = Object.keys(PRODUCTS);

  for (const s of SURFACES) {
    if (!fs.existsSync(path.join(OUT, s.file))) continue;   // covered by its own assertion
    const found = new Map([...read(s.file).matchAll(s.re)].map(m => [m[1], Number(m[2])]));

    if (found.size !== catalogSkus.length) {
      failures.push(
        `${s.file}: ${s.label} yielded ${found.size} priced SKUs, expected ${catalogSkus.length} ` +
        `— the pattern no longer matches the built markup, so prices are unchecked`
      );
    }
    for (const sku of catalogSkus) {
      const want = PRODUCTS[sku].price;
      if (!found.has(sku)) {
        failures.push(`${s.file}: ${s.label} has no entry for Shopify SKU "${sku}"`);
      } else if (found.get(sku) !== want) {
        failures.push(`${s.file}: ${s.label} prices "${sku}" at ${found.get(sku)}, Shopify has ${want}`);
      }
    }
    for (const sku of found.keys()) {
      if (!catalogSkus.includes(sku)) {
        failures.push(`${s.file}: ${s.label} sells SKU "${sku}", which has no Shopify product`);
      }
    }
  }

  /* 5b — if variants have been resolved, that file must still describe this
   *      catalogue, and must never have acquired a token. It is generated by
   *      tools/resolve-variants.js; its absence is the normal pre-token state. */
  const vPath = path.join(__dirname, VARIANTS_FILE);
  if (fs.existsSync(vPath)) {
    let v = null;
    try {
      v = JSON.parse(fs.readFileSync(vPath, 'utf8'));
    } catch (e) {
      failures.push(`tools/${VARIANTS_FILE}: not valid JSON (${e.message})`);
    }
    if (v) {
      const raw = fs.readFileSync(vPath, 'utf8');
      if (/token|secret|password|shpat_|shpca_/i.test(raw)) {
        failures.push(`tools/${VARIANTS_FILE}: contains something token-shaped — it must hold public storefront data only`);
      }
      const got = Object.keys(v.variants || {}).sort().join(',');
      const want = catalogSkus.slice().sort().join(',');
      if (got !== want) {
        failures.push(`tools/${VARIANTS_FILE}: resolved SKUs [${got}] do not match the catalogue [${want}] — re-run tools/resolve-variants.js`);
      }
      for (const sku of Object.keys(v.variants || {})) {
        const r = v.variants[sku];
        if (PRODUCTS[sku] && r.price !== PRODUCTS[sku].price) {
          failures.push(`tools/${VARIANTS_FILE}: "${sku}" resolved at ${r.price}, catalogue says ${PRODUCTS[sku].price} — re-run tools/resolve-variants.js`);
        }
        if (!/^gid:\/\/shopify\/ProductVariant\//.test(r.variantId || '')) {
          failures.push(`tools/${VARIANTS_FILE}: "${sku}" has no ProductVariant GID`);
        }
      }
    }
  }

  return {
    failures,
    counts: { pages: pages.length, files: all.length },
    gateOpen: SHOPIFY_CHECKOUT_ENABLED,
    variantsResolved: fs.existsSync(vPath)
  };
}

function report(result) {
  const has = needle => result.failures.some(f => f.includes(needle));
  console.log('\nASSERTIONS');
  console.log(`  design-tool routes in output ... ${has('design-tool') ? 'FAIL' : 'pass'}`);
  console.log(`  bindings resolved ............. ${has('binding') ? 'FAIL' : 'pass'}`);
  console.log(`  checkout matches the gate ..... ${has('checkout') || has('commerce marker') || has('variant') || has('token') || has('shop') || has('payment marker') ? 'FAIL' : 'pass'}`);
  console.log(`  withdrawn Mask fully removed .. ${has('withdrawn Mask') ? 'FAIL' : 'pass'}`);
  console.log(`  no internal markers shipped ... ${has('internal marker') ? 'FAIL' : 'pass'}`);
  console.log(`  noindex on every page ......... ${has('robots') ? 'FAIL' : 'pass'}`);
  console.log(`  policy footer on every page ... ${has('policy') ? 'FAIL' : 'pass'}`);
  console.log(`  favicon + social tags ......... ${has('head is missing') || has('og:') || has('twitter:') || has('not in the build') ? 'FAIL' : 'pass'}`);
  console.log(`  PDP conversion changes ........ ${has('hero paragraph') || has('More questions') || has('questions module') || has('question') || has('approved text') || has('faqs') ? 'FAIL' : 'pass'}`);
  console.log(`  US-only holds site-wide ....... ${has('international shipping') || has('US-only text') ? 'FAIL' : 'pass'}`);
  console.log(`  FAQ page retired .............. ${has('faq.html') || has('FAQ nav item') || has('reads "FAQ"') ? 'FAIL' : 'pass'}`);
  console.log(`  vercel.json redirect + robots . ${has('vercel.json') ? 'FAIL' : 'pass'}`);
  console.log(`  prices match Shopify catalogue  ${has('Shopify') || has('priced SKUs') ? 'FAIL' : 'pass'}`);
  console.log(`  variant GIDs .................. ${result.variantsResolved ? 'resolved' : 'not resolved yet (no token)'}`);
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
