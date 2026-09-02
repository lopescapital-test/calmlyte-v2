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

/* Every page that may start a checkout: the cart's Checkout button and the
   product page's CTA.
 *
   The Shop page briefly belonged here — its ADD buttons went straight to
   Shopify — and was removed on 2026-09-02 when Jake corrected the funnel to
   route those cards to the product page instead. Assertion 3-vi asserts
   membership in both directions, so shop.html carrying a token or a mutation
   now fails, and assertion 4j names the rest of the commerce leftovers
   directly. Declared once at module scope because several assertions depend on
   the same list, and two copies could disagree. */
const CHECKOUT_PAGES = ['cart.html', 'product.html'];

/* Slice one handler out of a built page, from `from` to the brace that closes
   the first `{` after it, skipping strings and comments.
 *
 * Brace matching rather than a line-shape heuristic. "The first line that is
 * only `},`" is the obvious rule and it is wrong: the fetch options inside the
 * handler contain exactly that line, so the slice ended in the middle of the
 * request. It also cannot be a fixed indent, because the build reindents the
 * logic block. Both were tried; both cut in the wrong place, which silently
 * changes what every check on the slice is looking at.
 *
 * Returns null if the braces do not balance, which callers must treat as a
 * failure rather than as an empty handler. */
function sliceHandler(src, from) {
  const open = src.indexOf('{', from);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '*') {
      const e = src.indexOf('*/', i + 2);
      if (e < 0) return null;
      i = e + 1;
      continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      const e = src.indexOf('\n', i);
      if (e < 0) return null;
      i = e;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      let closed = false;
      for (i++; i < src.length; i++) {
        if (src[i] === '\\') { i++; continue; }
        if (src[i] === c) { closed = true; break; }
      }
      if (!closed) return null;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return src.slice(from, i + 1);
    }
  }
  return null;
}

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

    /* Every page that may start a checkout. Three since 2026-09-02: the cart's
       Checkout button, the product page's CTA, and the Shop page's four ADD
       buttons.
     *
       Held as a set because the checks below have to hold on all of them, and
       because 3-vi asserts membership in both directions. A page missing from
       the set is as dangerous as an extra one: an extra means the token and the
       mutation leaked somewhere they were not meant to be, while a missing one
       means the substitution silently no-oped and a customer is looking at a
       primary CTA that does nothing. Only the first of those looks like a
       failure, so both are stated. */
    for (const f of CHECKOUT_PAGES) {
      if (!pages.includes(f)) {
        failures.push(`${f}: expected to carry checkout code but was not built`);
      }
    }
    const checkoutPages = CHECKOUT_PAGES.filter(f => pages.includes(f));

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
      ['double-submit guard',        'if (this._checkingOut) return;'],
      ['unknown-variant guard',      'if (!gid)'],
      ['subtotal parity check',      'subtotal mismatch:'],
      ['request timeout',            'abort.abort()'],
      ['failure leaves the cart alone', 'checkout failed:']
    ];
    for (const f of checkoutPages) {
      const text = read(f);
      for (const [label, marker] of REQUIRED) {
        if (!text.includes(marker)) failures.push(`${f}: ${label} missing from the checkout handler`);
      }
    }
    /* Cart page only: Buy Now has no empty case to guard, because the customer
       is looking at the product being bought. */
    if (!cart.includes('if (!cart.length)')) {
      failures.push('cart.html: empty-cart guard missing from the checkout handler');
    }

    /* Each page's failure message, verbatim. The two differ deliberately — the
       cart's says the cart is saved, which would be a lie on a Buy Now that
       never wrote one — so they are checked separately rather than by looking
       for the support address anywhere on the page. */
    if (!cart.includes(CHECKOUT.MSG.failed)) {
      failures.push('cart.html: the checkout failure message is not the expected text');
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
    for (const f of checkoutPages) {
      const block = /var VARIANTS = \{([\s\S]*?)\n\s*\};/.exec(read(f));
      if (!block) {
        failures.push(`${f}: no VARIANTS map found in the checkout handler`);
        continue;
      }
      const pairs = new Map(
        [...block[1].matchAll(/"([^"]+)"\s*:\s*"([^"]*)"/g)].map(m => [m[1], m[2]])
      );
      const skus = Object.keys(PRODUCTS);
      if (pairs.size !== skus.length) {
        failures.push(`${f}: VARIANTS map has ${pairs.size} entries, expected ${skus.length}`);
      }
      for (const sku of skus) {
        const want = variants.variants[sku].variantId;
        if (!pairs.has(sku)) {
          failures.push(`${f}: VARIANTS map has no entry for SKU "${sku}"`);
        } else if (pairs.get(sku) !== want) {
          failures.push(`${f}: SKU "${sku}" maps to "${pairs.get(sku)}", verified GID is "${want}"`);
        }
      }
      for (const sku of pairs.keys()) {
        if (!skus.includes(sku)) failures.push(`${f}: VARIANTS map sells unknown SKU "${sku}"`);
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
    for (const f of checkoutPages) {
      const text = read(f);
      if (!text.includes(SHOP_DOMAIN)) {
        failures.push(`${f}: checkout does not reference ${SHOP_DOMAIN}`);
      }
      for (const m of text.matchAll(/[A-Za-z0-9-]+\.myshopify\.com/g)) {
        if (m[0] !== SHOP_DOMAIN) failures.push(`${f}: checkout references a foreign shop "${m[0]}"`);
      }
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
    for (const f of checkoutPages) {
      const text = read(f);
      if (!/'[0-9a-f]{32}'/.test(text) && !/"[0-9a-f]{32}"/.test(text)) {
        failures.push(`${f}: no Storefront public token embedded — its checkout button cannot work`);
      }
    }

    /* 3-vi checkout belongs on exactly the pages listed above, no more and no
            fewer. An extra page means the token and the mutation leaked
            somewhere they were not meant to be; a missing one means a primary
            CTA is bound to a handler that was never injected. */
    for (const f of all) {
      const text = read(f);
      const carries = /cartcreate/i.test(text) || /X-Shopify-Storefront-Access-Token/i.test(text);
      if (carries && !CHECKOUT_PAGES.includes(f)) {
        failures.push(`${f}: checkout code leaked onto a page that must not carry it`);
      }
      if (!carries && CHECKOUT_PAGES.includes(f)) {
        failures.push(`${f}: no checkout code — the substitution did not apply, so its CTA is dead`);
      }
    }

    /* 3-vii no third-party payment processor. Shopify hosts the payment page;
             nothing else should be in here. */
    for (const f of checkoutPages) {
      const lower = read(f).toLowerCase();
      for (const marker of ['stripe', 'paypal', 'braintree', 'adyen', 'klarna', 'payment_intent', 'checkout.session']) {
        if (lower.includes(marker)) failures.push(`${f}: unexpected payment marker "${marker}"`);
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

  /* 4 — the public site is indexable, on every page, every build.
   *
   *      Inverted at launch, 2026-09-02. For the whole build-up this asserted
   *      the opposite: noindex present on all seven pages, so an unfinished
   *      store could not be found. Both directions matter, and the reason to
   *      keep asserting it after launch is that the tag is one line in a
   *      template — reintroduced by a copy-paste or a reverted commit, it would
   *      quietly de-index the whole site, and nothing about the rendered page
   *      would look wrong.
   *
   *      Any robots directive is caught, not just the exact old string: a
   *      "none" or a bare "noindex" would suppress indexing just as
   *      effectively as the literal that used to be here. `nofollow` on its own
   *      is treated the same way — it is not what launch means either.
   *
   *      Scope is the Vercel build only. The Shopify storefront keeps its own
   *      noindex deliberately, so that an unfinished duplicate storefront does
   *      not compete with this site; nothing here touches or checks that, and
   *      it is not served from this build. */
  for (const f of pages) {
    const text = read(f);
    if (text.includes(ROBOTS_TAG)) {
      failures.push(`${f}: still carries ${ROBOTS_TAG} — the public site must be indexable`);
      continue;
    }
    for (const m of text.matchAll(/<meta[^>]*name=["']robots["'][^>]*>/gi)) {
      if (/noindex|nofollow|\bnone\b/i.test(m[0])) {
        failures.push(`${f}: a robots meta tag suppresses indexing — ${m[0]}`);
      }
    }
  }

  /* 4h — the public contact address.
   *
   *      Customer email is meant to land in GoHighLevel Conversations, which
   *      only happens for mail.calmlyte.com — the root address is a separate
   *      GoDaddy mailbox the CRM cannot see. So an old address left anywhere on
   *      a page silently routes that customer somewhere nobody is watching.
   *
   *      Both halves are checked, because they fail differently: an old address
   *      in the visible text misleads the reader, and an old address in a mailto
   *      href misroutes the click even when the text looks right. */
  {
    const CONTACT = require('./contact-email');
    for (const f of all) {
      const text = read(f);
      /* Bounded so the new address, which contains the old as a substring after
         the "mail." label, is not counted as an occurrence of it. */
      const stale = (text.match(new RegExp(`(^|[^.\\w])${CONTACT.OLD_EMAIL.replace(/\./g, '\\.')}`, 'g')) || []).length;
      if (stale) failures.push(`${f}: ${stale} reference(s) to the old contact address ${CONTACT.OLD_EMAIL}`);
      for (const m of text.matchAll(/mailto:([^"'\s>]+)/g)) {
        if (m[1] !== CONTACT.PUBLIC_EMAIL) {
          failures.push(`${f}: mailto link points at "${m[1]}", expected ${CONTACT.PUBLIC_EMAIL}`);
        }
      }
    }
    /* The address has to actually be present, not merely not-wrong. */
    const carriers = pages.filter(f => read(f).includes(CONTACT.PUBLIC_EMAIL));
    if (!carriers.length) {
      failures.push(`no page carries the public contact address ${CONTACT.PUBLIC_EMAIL}`);
    }
  }

  /* 4i — the product page's primary CTA goes straight to Shopify checkout.
   *
   *      Per Jake 2026-09-02. The button used to add to the local cart and leave
   *      the customer to find the cart page; it now creates a one-line Shopify
   *      cart and redirects.
   *
   *      Per Jake's revision the same day, the button keeps the artboard's
   *      "Add to cart" wording. That removes the only visible symptom this
   *      change would otherwise have had: the CTA looks identical whether or not
   *      the rebinding applied, so these assertions are the only thing that can
   *      tell the two apart.
   *
   *      Three things can go wrong here, and none of them looks broken:
   *
   *        - the rebinding silently stops applying, leaving a correct-looking
   *          button that adds to the local cart and goes nowhere. Nothing about
   *          the rendered page says so.
   *        - the quantity, or the price the parity check compares against, stops
   *          matching the product being viewed. This is the one failure mode
   *          here that could charge an amount the customer never read.
   *        - the two checkouts drift. Copying the handler was the obvious way to
   *          build this and would have left two implementations to keep in step;
   *          they are generated from one string in tools/checkout-wiring.js, and
   *          the marker comparison below is what holds that true.
   *
   *      Both directions of the gate are asserted, because a closed gate that
   *      still rewrote the label would ship a Buy Now button bound to a handler
   *      that does not exist. */
  if (pages.includes('product.html')) {
    const BUYNOW = require('./pdp-buy-now');
    const prod = read('product.html');
    /* The compiled form, not the template form. The build turns
       onClick="{{ buyNow }}" into data-on="click:buyNow", so matching the
       template attribute finds nothing and the assertion passes vacuously —
       which is exactly what happened on the first run of this check. */
    const bound = needle =>
      (prod.match(new RegExp('data-on="click:' + needle + '"', 'g')) || []).length;

    /* Comments stripped, because the negative checks below look for mentions of
       localStorage and of the cart route, and the handler's own comments say it
       touches neither. A comment saying so is not the same as code doing so. */
    const stripComments = src => src
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

    if (!SHOPIFY_CHECKOUT_ENABLED) {
      /* Gate closed: the artboard's own button, untouched. */
      if (bound(BUYNOW.HANDLER)) {
        failures.push(`product.html: the CTA is bound to ${BUYNOW.HANDLER} while the commerce gate is closed — the button would do nothing`);
      }
      if (!bound(BUYNOW.OLD_HANDLER)) {
        failures.push(`product.html: with the gate closed the CTA should still be bound to ${BUYNOW.OLD_HANDLER}`);
      }
      /* The label is the same either way, so it says nothing about the gate.
         What must hold is that the button carrying it is bound to the artboard's
         own handler and that nothing references the injected one. */
      const closedTags = prod.match(new RegExp(`<button[^>]*>${BUYNOW.CTA_LABEL}</button>`, 'g')) || [];
      if (closedTags.length !== 1) {
        failures.push(`product.html: ${closedTags.length} button(s) read "${BUYNOW.CTA_LABEL}", expected 1`);
      } else if (!closedTags[0].includes(`data-on="click:${BUYNOW.OLD_HANDLER}"`)) {
        failures.push(`product.html: with the gate closed the "${BUYNOW.CTA_LABEL}" button should be bound to ${BUYNOW.OLD_HANDLER}`);
      }
      if (prod.includes(BUYNOW.HANDLER)) {
        failures.push(`product.html: ${BUYNOW.HANDLER} is named on the page while the commerce gate is closed`);
      }
    } else {
      /* 4i-i  the binding and the label move together. A button that says it
               adds to a cart and instead leaves for a payment page is the
               failure this pair exists to prevent. */
      const buy = bound(BUYNOW.HANDLER);
      if (buy !== 1) {
        failures.push(`product.html: ${buy} element(s) bound to ${BUYNOW.HANDLER}, expected 1`);
      }
      const old = bound(BUYNOW.OLD_HANDLER);
      if (old) {
        failures.push(`product.html: ${old} element(s) still bound to ${BUYNOW.OLD_HANDLER} — a CTA still adds to the local cart`);
      }
      /* The label and the binding on the same element, which is the pairing that
         carries the whole change now that the label is unchanged.
       *
         Two separate checks — a button reading "Add to cart" exists, and
         something is bound to buyNow — both pass on a page where those are
         different elements. And because the wording is the artboard's own, a
         rule that silently stopped applying would leave a button that looks
         exactly right and quietly does the old thing, so there is no visible
         symptom for this to fall back on. */
      const labelled = new RegExp(`<button[^>]*>${BUYNOW.CTA_LABEL}</button>`, 'g');
      const tags = prod.match(labelled) || [];
      if (tags.length !== 1) {
        failures.push(`product.html: ${tags.length} button(s) read "${BUYNOW.CTA_LABEL}", expected 1`);
      } else if (!tags[0].includes(`data-on="click:${BUYNOW.HANDLER}"`)) {
        failures.push(`product.html: the "${BUYNOW.CTA_LABEL}" button is not bound to ${BUYNOW.HANDLER} — it reads "${BUYNOW.CTA_LABEL}" and adds to the local cart instead of opening checkout`);
      }

      /* 4i-ii the handler itself. Sliced out so the checks below cannot be
               satisfied by text elsewhere on the page — the cart nav link and
               the related-product links both name routes this handler must
               never use. */
      const open = prod.indexOf(`${BUYNOW.HANDLER}: async () => {`);
      const body = open < 0 ? null : sliceHandler(prod, open);
      if (open < 0) {
        failures.push(`product.html: renderVals has no ${BUYNOW.HANDLER} handler`);
      } else if (!body) {
        failures.push(`product.html: could not find the end of the ${BUYNOW.HANDLER} handler`);
      } else if (!body.includes('out.cart.checkoutUrl')) {
        /* The slice is only worth checking if it actually contains the handler.
           Without this, a mis-detected boundary makes every check below pass or
           fail on unrelated text — which is how the two failed boundary rules
           above were caught rather than shipped. */
        failures.push(`product.html: the ${BUYNOW.HANDLER} slice does not contain the redirect — the handler boundary was mis-detected`);
      } else {
        const code = stripComments(body);

        /* One variant, quantity fixed at one, read from this page's own table. */
        if (!body.includes('var gid = VARIANTS[p.sku];')) {
          failures.push(`product.html: ${BUYNOW.HANDLER} does not resolve the variant from p.sku`);
        }
        if (!body.includes('var lines = [{ merchandiseId: gid, quantity: 1 }];')) {
          failures.push(`product.html: ${BUYNOW.HANDLER} does not send exactly one line at quantity 1`);
        }

        /* The parity check must compare against the price rendered beside the
           button, which is p.priceN — the field {{ price }} is formatted from.
           Anything else and the number checked is not the number read. */
        if (!body.includes('var shown = p.priceN;')) {
          failures.push(`product.html: ${BUYNOW.HANDLER} does not compare Shopify's subtotal against p.priceN`);
        }

        /* Buy Now must not touch the local cart in either direction: not read,
           so the checkout holds only the product on screen, and not written, so
           an abandoned Buy Now leaves nothing behind. */
        if (/localStorage|this\.state\.cart/.test(code)) {
          failures.push(`product.html: ${BUYNOW.HANDLER} touches the Calmlyte cart — Buy Now must neither read nor write it`);
        }

        /* And it must not route through the cart page, which is the change. */
        if (/cart\.html|Cart\.dc\.html/.test(code)) {
          failures.push(`product.html: ${BUYNOW.HANDLER} navigates to the cart page`);
        }

        /* The customer-facing failure, compared against the exact text rather
           than by looking for the address somewhere in the handler.
           "Does the handler mention the support address anywhere" passed with
           the address stripped out of this message, because the
           unknown-variant message carries it too — a fault-injection run is
           what surfaced that. The message a customer actually sees when
           checkout fails is the one that has to be right. */
        if (!body.includes(CHECKOUT.MSG.pdpFailed)) {
          failures.push(`product.html: the ${BUYNOW.HANDLER} failure message is not the expected text — a customer hitting an error may be left without a way to reach anyone`);
        }
      }

      /* 4i-iv every price the CTA can quote must be the catalogue price, and
               every SKU it can offer must have a resolved variant. The parity
               check refuses the redirect on a mismatch, so a drift here shows up
               as a Buy Now button that has stopped working rather than as a
               wrong charge — a safe failure, but a silent one. */
      const entries = [...prod.matchAll(/sku: '([a-z-]+)',[^\n]*?priceN: (\d+)/g)];
      if (entries.length !== Object.keys(PRODUCTS).length) {
        failures.push(`product.html: ${entries.length} priced product entries, expected ${Object.keys(PRODUCTS).length}`);
      }
      for (const [, sku, priceN] of entries) {
        if (!PRODUCTS[sku]) {
          failures.push(`product.html: Buy Now offers SKU "${sku}", which is not in the Shopify catalogue`);
        } else if (Number(priceN) !== PRODUCTS[sku].price) {
          failures.push(`product.html: "${sku}" priced ${priceN} on the page, ${PRODUCTS[sku].price} in the Shopify catalogue`);
        }
      }
    }
  }

  /* 4j — the Shop page's card buttons go to the product page, and this page
   *      touches no commerce at all.
   *
   *      Jake's correction of 2026-09-02, reversing the direct-checkout pass.
   *      Four buttons means a rule can apply to three of them and miss the
   *      fourth with nothing to see, so each is checked individually — the same
   *      reason the previous version of this assertion existed.
   *
   *      The strongest check here is the last one: every route these buttons
   *      emit must actually resolve to a product on the PDP. A button that
   *      navigates to a URL the product page cannot key silently shows whatever
   *      the fallback is, which is a real product, just the wrong one. */
  if (pages.includes('shop.html')) {
    const SHOPVIEW = require('./shop-view-product');
    const shop = read('shop.html');

    /* 4j-i  the label the customer actually reads.
     *
     *       Two declarations feed it and only one wins. The artboard declares
     *       addLabel as a design-tool prop with its own default, and that
     *       default is supplied at runtime, so renderVals' `?? 'Add'` fallback
     *       never evaluates. Rewriting the fallback alone built cleanly,
     *       asserted cleanly against the source string, and still rendered
     *       "Add" — so the prop default is checked in its own right, and the
     *       fallback too, because the two disagreeing about what this button
     *       says is its own kind of trap. */
    /*       Checked in its resolved form. The build reads the artboard's prop
     *       schema and emits the resolved values as a JSON blob, so neither the
     *       schema's escaped default nor renderVals' fallback appears in the
     *       page as written — matching either of those against the built output
     *       finds nothing and passes vacuously. `"addLabel":"…"` is the value
     *       the runtime hands the button. */
    const resolved = `"addLabel":"${SHOPVIEW.CTA_LABEL}"`;
    if (!shop.includes(resolved)) {
      failures.push(`shop.html: the resolved card button label is not ${resolved} — that is the value that renders`);
    }
    if (shop.includes(`"addLabel":"${SHOPVIEW.OLD_LABEL}"`)) {
      failures.push(`shop.html: the resolved card button label is still "${SHOPVIEW.OLD_LABEL}"`);
    }
    /* And the renderVals fallback, so the two cannot drift into disagreeing
       about what this button says if the prop is ever cleared. */
    if (!shop.includes(SHOPVIEW.LABEL_NEW.trim())) {
      failures.push(`shop.html: the card button renderVals fallback is not "${SHOPVIEW.CTA_LABEL}"`);
    }
    const labels = (shop.match(/>\{\{ addLabel \}\}</g) || []).length;
    if (labels !== 4) {
      failures.push(`shop.html: ${labels} card buttons render {{ addLabel }}, expected 4`);
    }

    /* 4j-ii each card repointed, and none left on the old handler. Both
              directions per card, because a binding and its renderVals key can
              drift apart independently. */
    for (let i = 0; i < SHOPVIEW.ROUTES.length; i++) {
      const r = SHOPVIEW.ROUTES[i];
      /* Both of these are compared against the built page, not the rule's own
         strings. The build rewrites the design-tool route to product.html and
         compiles onClick="{{ x }}" into data-on="click:x", so matching what
         the module emits finds nothing and the check passes vacuously — which
         is exactly what happened on the first run of this assertion, and on
         the first run of the product page's equivalent before it. */
      const route = `location.assign('product.html?sku=${r.key}')`;
      if (!shop.includes(route)) {
        failures.push(`shop.html: view${i} does not navigate to ${route}`);
      }
      if (!shop.includes(`data-on="click:view${i}"`)) {
        failures.push(`shop.html: card ${i} is not bound to view${i}`);
      }
      if (shop.includes(`{{ add${i} }}`) || shop.includes(`add${i}: () =>`)) {
        failures.push(`shop.html: card ${i} still uses the old add${i} handler`);
      }
    }

    /* 4j-iii the artboard's add() must be gone, not merely uncalled. Left in
               place it is a live method that writes the cart and bumps the
               badge, one binding away from coming back. */
    if (shop.includes(SHOPVIEW.ADD_METHOD_OLD.trim())) {
      failures.push('shop.html: the artboard add() method is still present');
    }
    if (/\bthis\.add\(/.test(shop)) {
      failures.push('shop.html: something still calls this.add()');
    }

    /* 4j-iv no click on this page may write the local cart or move the badge. */
    const tpl = /<template id="dc-template">([\s\S]*)<\/template>/.exec(shop);
    const logic = tpl
      ? shop.slice(0, shop.indexOf(tpl[0])) + shop.slice(shop.indexOf(tpl[0]) + tpl[0].length)
      : shop;
    const writes = (logic.match(/localStorage\.setItem/g) || []).length;
    if (writes) {
      failures.push(`shop.html: ${writes} localStorage write(s) in the page logic — the cards must not touch the cart`);
    }

    /* 4j-v  ...but a cart built on an earlier visit must still show in the
              badge. Removing add() must not have taken the read path with it. */
    if (!/componentDidMount\(\)\s*\{\s*this\.setState\(\{\s*count:\s*this\.total\(\)/.test(shop)) {
      failures.push('shop.html: componentDidMount no longer sets the cart count — an existing cart would stop showing in the badge');
    }
    if (!/read\(\)\s*\{[\s\S]{0,120}localStorage\.getItem/.test(shop)) {
      failures.push('shop.html: read() no longer reads the stored cart');
    }

    /* 4j-vi no commerce on this page. Assertion 3-vi already fails on a token
              or a mutation reaching a page outside CHECKOUT_PAGES, which
              shop.html no longer is; these name the rest of it, so a partially
              reverted change cannot leave a variant map or a shop domain behind
              on a page whose buttons only navigate. */
    /* SHOP_DOMAIN is deliberately not in this list: the policy footer links to
       the store's own policy pages on every page, so the bare domain is
       expected here. These markers are the ones that only appear when checkout
       code is present. */
    /* Matched case-insensitively. A fault-injection run put
       "mutation CartCreate" on this page and nothing fired, because the
       operation name is capitalised and the marker was not — the mutation's
       own name is the one spelling of it most likely to survive a partial
       revert. */
    const shopLower = shop.toLowerCase();
    for (const marker of ['var variants = {', 'gid://shopify', 'graphql.json',
                          'x-shopify-storefront-access-token', 'cartcreate']) {
      if (shopLower.includes(marker)) {
        failures.push(`shop.html: commerce leftover "${marker}" on a page that only navigates`);
      }
    }

    /* 4j-vii every route the buttons emit must resolve to a product on the PDP.
               This is the one that matters: the PDP falls back to a default when
               a ?sku= misses, so a wrong or stale key does not error — it
               quietly renders a different product than the card the customer
               clicked. Checked against the built product page, and against the
               alias rule that makes the Shopify SKUs resolve too. */
    if (pages.includes('product.html')) {
      const prod = read('product.html');
      const ALIAS = require('./pdp-sku-aliases');
      if (!prod.includes(ALIAS.NEW)) {
        failures.push('product.html: ?sku= does not resolve Shopify SKUs — small-panel would fall through to the default');
      }
      for (const r of SHOPVIEW.ROUTES) {
        const keyed = new RegExp(`^  '?${r.key}'?: \\{$`, 'm').test(prod);
        if (!keyed) {
          failures.push(`shop.html: a card navigates to ?sku=${r.key}, which is not a product key on product.html — it would render the fallback product`);
        }
      }
      /* And the SKU namespace, so the aliases resolve to something. */
      for (const sku of Object.keys(PRODUCTS)) {
        if (!prod.includes(`sku: '${sku}'`)) {
          failures.push(`product.html: no product carries Shopify SKU "${sku}", so ?sku=${sku} would fall through to the default`);
        }
      }
    }
  }

  /* 4k — one checkout system, not two.
   *
   *      Every string the handlers must have in common, compared across every
   *      page in CHECKOUT_PAGES. This is what makes "do not introduce a second
   *      checkout system" an assertion rather than an intention: edit the
   *      mutation, the endpoint, the credential header or the parity check on
   *      one page only, and this fails.
   *
   *      Compared pairwise against the first page rather than counted, so the
   *      message can name which page drifted. */
  if (SHOPIFY_CHECKOUT_ENABLED) {
    const present = CHECKOUT_PAGES.filter(f => pages.includes(f));
    for (const marker of CHECKOUT.SHARED_MARKERS) {
      const has = present.filter(f => read(f).includes(marker));
      if (!has.length) {
        failures.push(`every checkout is missing "${marker.slice(0, 46)}…"`);
      } else if (has.length !== present.length) {
        const missing = present.filter(f => !has.includes(f));
        failures.push(
          `the checkouts have diverged — "${marker.slice(0, 46)}…" is missing from ` +
          missing.join(', ')
        );
      }
    }
  }

  /* 4l — the Shop card's button cannot be clipped by its card.
   *
   *      Jake reported it as truncated text, 2026-09-02. It was not: the button
   *      never clipped its own text at any width. The price/button row
   *      overflowed the content column and the <article>'s overflow:hidden cut
   *      the button's right edge off, showing "VIEW PRODUC". Measured overflow
   *      before the fix: +43px at 1024, +19px at 1280, and +2px at 1440 on the
   *      Studio Panel, whose "$6,000" is the widest price.
   *
   *      Three properties together make that impossible, and all three have to
   *      hold or the guarantee is gone:
   *
   *        white-space:nowrap   the label stays on one line — Jake's requirement
   *        flex:none            the button never compresses below that line
   *        flex-wrap:wrap       so when the row runs out of room the button
   *                             moves down instead of past the edge
   *
   *      Drop the wrap and nowrap+flex:none guarantees an overflow. Drop
   *      flex:none and the button compresses and clips. Drop nowrap and the
   *      label breaks across two lines. Each is checked per card, because a
   *      substitution that reaches three cards and misses the fourth is exactly
   *      the failure that shipped this bug in the first place.
   *
   *      Geometry is not asserted here — it depends on font metrics the build
   *      cannot see. It is measured in-browser across 360px to 1920px, the same
   *      way the product page's price/CTA row is. What this protects is the
   *      arrangement that makes the geometry safe at any width. */
  if (pages.includes('shop.html')) {
    const FIT = require('./shop-card-fit');
    const shop = read('shop.html');

    const expect = [
      ['image column widened',        FIT.IMG_NEW],
      ['content padding tightened',   FIT.PAD_NEW],
      ['row may wrap',                FIT.ROW_NEW],
      ['button tightened + flex:none', FIT.BTN_NEW],
      ['price floor',                 FIT.PRICE_NEW]
    ];
    for (const [what, needle] of expect) {
      const n = shop.split(needle).length - 1;
      if (n !== FIT.CARDS) {
        failures.push(`shop.html: ${n} of ${FIT.CARDS} cards have the ${what} — a card left behind would clip its button`);
      }
    }

    /* The properties that together make clipping impossible, read off each
       built button rather than inferred from the rules above. */
    const btnTags = shop.match(/<button[^>]*>\{\{ addLabel \}\}<\/button>/g) || [];
    if (btnTags.length !== FIT.CARDS) {
      failures.push(`shop.html: ${btnTags.length} card buttons found, expected ${FIT.CARDS}`);
    }
    for (const tag of btnTags) {
      if (!/white-space:nowrap/.test(tag)) {
        failures.push('shop.html: a card button lost white-space:nowrap — its label would break across lines');
      }
      if (!/flex:none/.test(tag)) {
        failures.push('shop.html: a card button lost flex:none — it would compress and clip inside the card');
      }
    }
    const wraps = (shop.match(/flex-wrap:wrap/g) || []).length;
    if (wraps < FIT.CARDS) {
      failures.push(`shop.html: ${wraps} rows can wrap, expected at least ${FIT.CARDS} — a row that cannot wrap overflows the card instead`);
    }

    /* And the values the fix replaced must not come back. */
    for (const [what, stale] of [
      ['46% image column', 'width:min(46%,100%)'],
      ['17px button padding', 'padding:9px 17px'],
      ['1.5px button tracking', 'letter-spacing:1.5px;text-transform:uppercase;padding']
    ]) {
      if (shop.includes(stale)) {
        failures.push(`shop.html: the ${what} is back — the button overflowed the card at desktop widths with it`);
      }
    }
  }

  /* 4g — vercel.json: the retired route redirects, and no header de-indexes
   *      the public site.
   *
   *      Two things live in that file that nothing else can enforce. A header
   *      is invisible to any page-level check, so an X-Robots-Tag reintroduced
   *      here would de-index a site whose HTML looks perfectly correct — the
   *      inverse of the hole this used to guard. And /faq.html now only
   *      resolves because of a redirect; drop it and a URL that used to work
   *      starts 404ing silently.
   *
   *      One header rule is allowed to carry noindex, and only one: the rule
   *      scoped by `has: host` to the Vercel deployment domain, which serves
   *      byte-identical content and would otherwise compete with
   *      www.calmlyte.com in search results. That is the same reasoning that
   *      keeps the Shopify storefront noindexed. A rule with no host condition
   *      applies to the public site and fails.
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
        /* Every header rule that carries a robots directive must be scoped to
           a host, and that host must not be the public site. An unscoped rule,
           or one scoped to calmlyte.com, de-indexes what was just launched. */
        for (const h of (vj.headers || [])) {
          const robots = (h.headers || []).find(
            x => /^x-robots-tag$/i.test(x.key) && /noindex|nofollow|\bnone\b/i.test(x.value));
          if (!robots) continue;

          const hostCond = (h.has || []).filter(c => c.type === 'host');
          if (!hostCond.length) {
            failures.push(
              `vercel.json: an X-Robots-Tag "${robots.value}" header applies to every host, ` +
              `including www.calmlyte.com — the public site would be de-indexed`
            );
          }
          for (const c of hostCond) {
            if (/(^|\.)calmlyte\.com$/.test(String(c.value))) {
              failures.push(
                `vercel.json: an X-Robots-Tag "${robots.value}" header is scoped to ` +
                `"${c.value}" — that is the public site`
              );
            }
          }
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

    /* Each product's own lede, and the old one gone. */
    for (const sku of Object.keys(HERO.COPY)) {
      const c = HERO.COPY[sku];
      if (!prod.includes(`lede: '${c.lede}'`)) {
        failures.push(`product.html: "${sku}" does not carry its new lede`);
      }
      if (prod.includes(c.oldLede)) {
        failures.push(`product.html: "${sku}" still carries the old lede`);
      }
    }

    /* Exactly two body paragraphs in the hero. The wavelength moved onto the
       image, so repeating it in prose would undo the change the brief asked
       for — hence the check that it is not back in the copy area. */
    const heroOpen = prod.indexOf('{{ lede }}');
    const heroClose = prod.indexOf('<div style="display:flex;align-items:center;justify-content:space-between;');
    if (heroOpen < 0 || heroClose < 0 || heroClose < heroOpen) {
      failures.push('product.html: could not locate the hero copy block');
    } else {
      /* From the lede's own text to the start of the CTA row. Every <p> in that
         span is a body paragraph after the lede, so the total is that plus one.
         Bounded at the CTA row rather than at {{ price }}, which sits inside the
         price paragraph and so counted it as hero copy. */
      const heroCopy = prod.slice(heroOpen, heroClose);
      const paras = (heroCopy.match(/<p style="/g) || []).length + 1;
      if (paras !== 2) {
        failures.push(`product.html: ${paras} hero body paragraphs, expected 2`);
      }
      if (/520|530|narrow-band/.test(heroCopy)) {
        failures.push('product.html: the wavelength is back in the hero prose — it belongs on the pill');
      }
    }

    /* The spectrum pill: present once, inside the figure, and the figure
       positioned so the pill anchors to the image rather than to some ancestor
       further up the page. */
    const fig = /<figure style="([^"]*)"[\s\S]*?<\/figure>/.exec(prod);
    if (!fig) {
      failures.push('product.html: no <figure> found for the hero image');
    } else {
      if (!/position:relative/.test(fig[1])) {
        failures.push('product.html: the hero <figure> is not positioned — the pill would anchor elsewhere');
      }
      if (!fig[0].includes(HERO.PILL_TEXT)) {
        failures.push(`product.html: the "${HERO.PILL_TEXT}" pill is not inside the hero figure`);
      }
    }
    const pills = prod.split(HERO.PILL_TEXT).length - 1;
    if (pills !== 1) {
      failures.push(`product.html: "${HERO.PILL_TEXT}" appears ${pills} time(s), expected 1`);
    }

    /* Price and Add to cart in one flex row. Checked as containment, not
       adjacency: the point of the change is that they share a row, and the
       rendered geometry is confirmed in-browser separately. */
    const row = /<div style="display:flex;align-items:center;justify-content:space-between;[^"]*">([\s\S]*?)<\/div>/.exec(prod);
    if (!row) {
      failures.push('product.html: no price/CTA row found');
    } else {
      const BUYNOW = require('./pdp-buy-now');
      if (!row[1].includes('{{ price }}')) failures.push('product.html: the price is not in the CTA row');
      if (!row[1].includes(`>${BUYNOW.CTA_LABEL}</button>`)) {
        failures.push(`product.html: the CTA row has no "${BUYNOW.CTA_LABEL}" button`);
      }
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
  console.log(`  public site is indexable ...... ${has('robots') || has('indexable') || has('de-indexed') ? 'FAIL' : 'pass'}`);
  console.log(`  policy footer on every page ... ${has('policy') ? 'FAIL' : 'pass'}`);
  console.log(`  favicon + social tags ......... ${has('head is missing') || has('og:') || has('twitter:') || has('not in the build') ? 'FAIL' : 'pass'}`);
  console.log(`  PDP conversion changes ........ ${has('hero paragraph') || has('More questions') || has('questions module') || has('question') || has('approved text') || has('faqs') ? 'FAIL' : 'pass'}`);
  console.log(`  PDP CTA to Shopify checkout ... ${has('bound to') || has('button') || has('diverged') || has('Buy Now') || has('quantity 1') || has('priceN') || has('priced ') || has('product entries') ? 'FAIL' : 'pass'}`);
  console.log(`  Shop card button fits ......... ${has('clip') || has('cards have the') || has('card button') || has('rows can wrap') || has('is back') ? 'FAIL' : 'pass'}`);
  console.log(`  Shop cards route to PDPs ...... ${has('shop.html') || has('checkouts have diverged') || has('checkout is missing') || has('?sku=') ? 'FAIL' : 'pass'}`);
  console.log(`  US-only holds site-wide ....... ${has('international shipping') || has('US-only text') ? 'FAIL' : 'pass'}`);
  console.log(`  FAQ page retired .............. ${has('faq.html') || has('FAQ nav item') || has('reads "FAQ"') ? 'FAIL' : 'pass'}`);
  console.log(`  vercel.json redirect + robots . ${has('vercel.json') ? 'FAIL' : 'pass'}`);
  console.log(`  public contact address ........ ${has('contact address') || has('mailto link') ? 'FAIL' : 'pass'}`);
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
