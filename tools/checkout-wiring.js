/* Shopify checkout, wired lazily into the approved Cart artboard at build time.
 *
 * The approved artboard ships an inert Checkout button whose handler shows a
 * toast. This module replaces that one handler — and nothing else — with a real
 * one. The artboard itself is never edited: the substitution is an exact-match
 * rule with an asserted count, so if the artboard's stub ever changes shape the
 * build fails rather than quietly leaving checkout dead.
 *
 * Lazy, not mirrored
 * ------------------
 * Nothing is sent to Shopify until the customer clicks Checkout. There is no
 * cart sync, no cart id kept in localStorage, no background request. One
 * cartCreate call is made from the current localStorage contents, and its
 * checkoutUrl is where the browser goes. Shopify owns the cart from that point;
 * the Calmlyte cart stays in localStorage untouched, so abandoning checkout and
 * coming back finds the cart still there.
 *
 * Three entry points, one implementation
 * --------------------------------------
 * From 2026-09-02 two more places start a checkout directly, both skipping the
 * Calmlyte cart: the product page's primary CTA, and each of the four ADD
 * buttons on the Shop page. The obvious way to build either — copy the handler
 * and change a couple of lines — would leave three checkouts to keep in step.
 * Instead checkoutHandler() below emits the whole call from one string, and each
 * caller supplies only the few lines that turn its own state into `lines` and
 * `shown`. The request, the guards, the parity check and the redirect are the
 * same bytes on all three pages, and tools/verify-build.js compares them to
 * prove it.
 *
 * The three differ in exactly two ways, both arguments rather than forks:
 *
 *   - what fills `lines` and `shown`: the whole localStorage cart on the cart
 *     page, one product at quantity one on the other two (productGather)
 *   - the shape emitted: a renderVals property on the cart and product pages,
 *     an instance method on the Shop page, whose four buttons would otherwise
 *     carry four identical copies of the same hundred lines
 *
 * tools/pdp-buy-now.js and tools/shop-buy-now.js own the two direct-checkout
 * rule sets. Both are gated on the same CHECKOUT_ENABLED flag, because a closed
 * gate must leave those buttons doing what the approved artboards say they do
 * rather than shipping a button wired to a handler that does not exist.
 *
 * The token
 * ---------
 * Injected at build time from SHOPIFY_STOREFRONT_TOKEN. It is not in this repo
 * and is not in any tracked file.
 *
 * A Storefront public token is designed to sit in client-side code — it ends up
 * readable in the built page, and that is how Shopify intends it to work. It is
 * still kept out of git: rotating it becomes an environment change and a rebuild
 * rather than a commit and a history rewrite, and git history is the one place a
 * credential is genuinely hard to remove later. Vercel needs
 * SHOPIFY_STOREFRONT_TOKEN set in project settings before a deploy with the gate
 * open will build.
 *
 * With the gate open and no token, the build fails. A site deployed with an open
 * gate and no token would show customers a checkout button that cannot work, so
 * failing the build is the safer end state — the previous deploy keeps serving.
 *
 * What the handler refuses to do
 * ------------------------------
 * Redirect on anything it is not sure about. In particular it will not send a
 * customer to Shopify when:
 *
 *   - the cart is empty (Shopify is not called at all)
 *   - a line has no known variant — a stale SKU in localStorage, e.g. a Mask
 *     added before that product was withdrawn. Its GID does not exist, so
 *     proceeding would silently charge for a cart different from the one on
 *     screen. It stops and names the item instead.
 *   - Shopify's own subtotal disagrees with the subtotal displayed on the page.
 *     This is the failure the build-time price-parity check cannot catch: a price
 *     edited in the Shopify admin after deploy. The amount charged must match the
 *     amount read.
 *   - the request fails, times out, returns userErrors, or returns no
 *     checkoutUrl.
 *
 * In every one of those cases the localStorage cart is left exactly as it was.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { SHOP_DOMAIN, PRODUCTS, CURRENCY, VARIANTS_FILE } = require('./shopify-catalog');
const { PUBLIC_EMAIL } = require('./contact-email');
const PIXEL = require('./meta-pixel');

/* ------------------------------------------------------------------ *
 * The commerce gate.
 *
 * True means real checkout code is injected into the build and the
 * gate-open assertions apply. This is the single flag; tools/verify-build.js
 * imports it rather than keeping its own copy.
 * ------------------------------------------------------------------ */
const CHECKOUT_ENABLED = true;

const TOKEN_ENV = 'SHOPIFY_STOREFRONT_TOKEN';

/* Tokens that must never be shipped to a browser. Checked again here, not just
   in tools/resolve-variants.js, because this is the path that would embed one in
   a public page. */
const PRIVILEGED_PREFIXES = ['shpat_', 'shpca_', 'shppa_', 'shpss_'];

/* Request timeout. A hung fetch would otherwise leave the button permanently
   mid-flight with no way back for the customer. */
const TIMEOUT_MS = 15000;

/* The artboard's inert handler, verbatim from Cart.dc.html. A literal, so a
   change to the stub is caught by the count assertion rather than inferred. */
const STUB = `      checkout: () => {
        clearTimeout(this._t);
        this.setState({ toast: 'Checkout opens soon — email hello@calmlyte.com' });
        this._t = setTimeout(() => this.setState({ toast: '' }), 3200);
      },`;

/* Customer-facing strings. New text is unavoidable here — the brief asks for an
   empty-cart message and a friendly failure — but it is confined to the toast the
   artboard already renders. No page copy, heading, or claim is touched. */
const MSG = {
  empty:      'Your cart is empty.',
  working:    'Opening secure checkout…',
  unavailable: ' is no longer available. Please remove it to continue.',
  failed:     'Checkout is unavailable right now. Your cart is saved — please try again, or email ' + PUBLIC_EMAIL,
  /* The product page's equivalent of `unavailable`. It needs its own wording
     because there is nothing to remove: the customer is looking at one product,
     not editing a cart. Unreachable in a correct build — assertion 4i ties every
     product-page SKU to a resolved variant — but a customer must still be told
     something useful if it ever fires. */
  pdpUnavailable: ' is not available right now. Please email ' + PUBLIC_EMAIL,
  /* Buy Now creates no local cart, so "your cart is saved" would be a lie. */
  pdpFailed: 'Checkout is unavailable right now — nothing has been charged. Please try again, or email ' + PUBLIC_EMAIL
};

function readVariants() {
  const p = path.join(__dirname, VARIANTS_FILE);
  if (!fs.existsSync(p)) {
    throw new Error(
      `Checkout is enabled but tools/${VARIANTS_FILE} is missing. ` +
      `Run: ${TOKEN_ENV}=<public token> node tools/resolve-variants.js`
    );
  }
  const v = JSON.parse(fs.readFileSync(p, 'utf8'));

  /* The variants file and the catalogue must describe the same store. If they
     drift, the GIDs shipped to customers belong to a different shop than the one
     everything else was checked against. */
  if (v.shopDomain !== SHOP_DOMAIN) {
    throw new Error(`tools/${VARIANTS_FILE} is for ${v.shopDomain}, catalogue says ${SHOP_DOMAIN}`);
  }
  for (const sku of Object.keys(PRODUCTS)) {
    const r = v.variants && v.variants[sku];
    if (!r) throw new Error(`tools/${VARIANTS_FILE} has no variant for "${sku}" — re-run tools/resolve-variants.js`);
    if (r.price !== PRODUCTS[sku].price) {
      throw new Error(`tools/${VARIANTS_FILE}: "${sku}" at ${r.price}, catalogue says ${PRODUCTS[sku].price}`);
    }
  }
  return v;
}

function readToken() {
  const token = process.env[TOKEN_ENV];
  if (!token) {
    throw new Error(
      `Checkout is enabled but ${TOKEN_ENV} is not set, so the built page would carry ` +
      `no token and the Checkout button could not work.\n\n` +
      `  ${TOKEN_ENV}=<public storefront token> node tools/build-site.js\n\n` +
      `On Vercel, set it in the project's environment variables. To build without ` +
      `checkout instead, set CHECKOUT_ENABLED = false in tools/checkout-wiring.js.`
    );
  }
  if (PRIVILEGED_PREFIXES.some(p => token.startsWith(p))) {
    throw new Error(
      `Refusing to build: ${TOKEN_ENV} begins with "${token.slice(0, 6)}", the prefix of a ` +
      `Shopify Admin or custom-app token. Embedding one in a public page would publish a ` +
      `secret with write access to the store. Use the Storefront public token.`
    );
  }
  if (!/^[0-9a-f]{32}$/.test(token)) {
    throw new Error(
      `${TOKEN_ENV} is not shaped like a Storefront public access token (expected 32 ` +
      `lowercase hex characters). Refusing to embed an unrecognised credential in a public page.`
    );
  }
  return token;
}

/* What each caller supplies: the few lines that turn a page's own state into
   `lines` and `shown`. Everything else — the mutation, the guards, the parity
   check, the redirect, the failure message — comes from checkoutHandler below,
   so both pages carry the same bytes and there is one checkout system rather
   than two that drift apart.
   ------------------------------------------------------------------ */

/* The cart page: every line in localStorage, at its own quantity. */
const CART_GATHER = `        var cart = this.state.cart || [];

        /* 1. Empty cart never reaches Shopify. */
        if (!cart.length) { say(${JSON.stringify(MSG.empty)}, 3200); return; }

        /* 2. One click at a time. renderVals re-runs on every render, so the
              in-flight flag lives on the instance, not in this closure. Without
              it a second click creates a second Shopify cart. */
        if (this._checkingOut) return;

        /* 3. Every line must map to a verified variant. An unmapped SKU means
              localStorage holds something the store no longer sells, and
              proceeding would charge for a different cart than the one shown. */
        var lines = [];
        for (var i = 0; i < cart.length; i++) {
          var item = cart[i];
          var gid = VARIANTS[item.sku];
          if (!gid) {
            var label = (META[item.sku] || {}).name || item.name || item.sku;
            say(label + ${JSON.stringify(MSG.unavailable)}, 6000);
            return;
          }
          lines.push({ merchandiseId: gid, quantity: item.qty });
        }

        /* 4. The subtotal shown on this page, computed exactly as the summary
              panel computes it, so the comparison below is like for like. */
        var shown = cart.reduce((a, it) => a + ((META[it.sku] || {}).price ?? it.price ?? 0) * it.qty, 0);`;

/* A product page: this product, quantity one, and nothing else. There is no
   empty case to guard — the customer is looking at the product — and the
   Calmlyte cart is neither read nor written, so whatever is in it survives. */
/* One product, quantity one. Used by the product page's CTA and by each of the
   four Shop cards' ADD buttons.
 *
 * Parameterised over the expression that holds the product and the field its
 * price sits in, because the two pages keep those in different shapes — the
 * product page has one `p` for whatever is being viewed with the price in
 * priceN, the Shop page has four ITEMS entries with the price in price. Those
 * two facts are the only difference between the two, so they are arguments
 * rather than a reason to write the block twice. */
function productGather({ product, priceField }) {
  return `        /* 1. One click at a time. renderVals re-runs on every render, so the
              in-flight flag lives on the instance, not in this closure. Without
              it a second click creates a second Shopify cart. */
        if (this._checkingOut) return;

        /* 2. The variant must be known. The SKU comes from this page's own
              product table, so an unmapped value means the page and the
              resolved variant map have drifted apart. Refuse rather than open
              a checkout that cannot contain what the customer asked for. */
        var gid = VARIANTS[${product}.sku];
        if (!gid) { say(${product}.name + ${JSON.stringify(MSG.pdpUnavailable)}, 8000); return; }

        /* 3. One line, quantity fixed at 1. */
        var lines = [{ merchandiseId: gid, quantity: 1 }];

        /* 4. The price shown beside this button, for the parity check below. */
        var shown = ${product}.${priceField};`;
}

/* The product page: one `p`, price in priceN. */
const PRODUCT_GATHER = productGather({ product: 'p', priceField: 'priceN' });

/* The Shop page: the card's ITEMS entry, price in price. */
const SHOP_GATHER = productGather({ product: 'item', priceField: 'price' });

/* The injected handler. Written to be readable in the built page: it ships to
   the browser, so someone will eventually read it there rather than here.
 *
 * opts.name    the renderVals key, or the method name, the button reaches
 * opts.intro   one line of comment at the top of the built handler
 * opts.gather  the page-specific block above, which must set `lines` and
 *              `shown` or return
 * opts.failed  the customer-facing message when the call does not succeed
 * opts.beforeRedirect
 *              optional source emitted at the one point where the call has
 *              certainly succeeded: userErrors clear, checkoutUrl present, and
 *              Shopify's subtotal matched against the page. Used for the Meta
 *              InitiateCheckout event, which must not fire on a failure and
 *              must not fire before the URL exists. Anything here has to be
 *              incapable of throwing — it sits between a confirmed checkout and
 *              the redirect to it, so an exception would cost the sale.
 * opts.method  emit an instance method `async name(arg)` instead of a
 *              renderVals property. The Shop page needs this: it has four
 *              buttons, and four copies of this handler would be four hundred
 *              lines of identical code in the shipped page. One method taking
 *              the card's item, called from four one-line renderVals keys,
 *              carries the same behaviour once.
 * opts.arg     the method's parameter name, when opts.method is set
 */
function checkoutHandler(variants, token, opts) {
  const lines = Object.keys(PRODUCTS)
    .map(sku => `    ${JSON.stringify(sku)}: ${JSON.stringify(variants.variants[sku].variantId)}`)
    .join(',\n');

  const inner = `        /* ${opts.intro} */
        var SHOP = ${JSON.stringify(variants.shopDomain)};
        var API = ${JSON.stringify(variants.apiVersion)};
        var TOKEN = ${JSON.stringify(token)};
        var CURRENCY = ${JSON.stringify(CURRENCY)};
        var VARIANTS = {
${lines}
        };

        var say = (msg, ms) => {
          clearTimeout(this._t);
          this.setState({ toast: msg });
          if (ms) this._t = setTimeout(() => this.setState({ toast: '' }), ms);
        };

${opts.gather}

        this._checkingOut = true;
        say(${JSON.stringify(MSG.working)});

        var abort = new AbortController();
        var timer = setTimeout(() => abort.abort(), ${TIMEOUT_MS});

        try {
          var res = await fetch('https://' + SHOP + '/api/' + API + '/graphql.json', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Shopify-Storefront-Access-Token': TOKEN
            },
            signal: abort.signal,
            body: JSON.stringify({
              query: 'mutation CartCreate($lines:[CartLineInput!]!){cartCreate(input:{lines:$lines}){cart{id checkoutUrl cost{subtotalAmount{amount currencyCode}}} userErrors{field message}}}',
              variables: { lines: lines }
            })
          });

          var body = await res.json();
          var out = body && body.data && body.data.cartCreate;

          if (!res.ok || (body && body.errors && body.errors.length)) {
            throw new Error('Storefront API error: ' + JSON.stringify(body && body.errors || res.status));
          }
          if (!out) throw new Error('cartCreate returned no payload');
          if (out.userErrors && out.userErrors.length) {
            throw new Error('cartCreate userErrors: ' + JSON.stringify(out.userErrors));
          }
          if (!out.cart || !out.cart.checkoutUrl) {
            throw new Error('cartCreate returned no checkoutUrl');
          }

          /* 5. Shopify's subtotal must equal the one on screen. This is the
                check the build cannot make: a price edited in the Shopify admin
                after deploy would otherwise charge an amount the customer never
                agreed to. Refuse the redirect instead. */
          var cost = out.cart.cost && out.cart.cost.subtotalAmount;
          if (!cost || Number(cost.amount) !== shown || cost.currencyCode !== CURRENCY) {
            throw new Error(
              'subtotal mismatch: page ' + shown + ' ' + CURRENCY +
              ', Shopify ' + (cost ? cost.amount + ' ' + cost.currencyCode : 'none')
            );
          }

          clearTimeout(timer);
${opts.beforeRedirect || ''}
          /* localStorage is untouched throughout. Shopify owns the checkout from
             here; an abandoned checkout comes back to a cart that is still
             exactly as the customer left it. */
          window.location.href = out.cart.checkoutUrl;
          return;
        } catch (err) {
          /* Detail to the console for whoever is debugging, one plain sentence
             to the customer, and localStorage untouched either way. The button
             is released, so the customer can simply click again. */
          console.error('[calmlyte] checkout failed:', err);
          clearTimeout(timer);
          this._checkingOut = false;
          say(${JSON.stringify(opts.failed)}, 8000);
        }`;

  if (!opts.method) {
    return `      ${opts.name}: async () => {\n${inner}\n      },`;
  }

  /* Same bytes, shifted left to sit at a class method's indentation. Only the
     wrapper differs between the two forms — the body above is generated once,
     which is what keeps the Shop page's checkout the same checkout as the
     other two rather than a third implementation that looks like them. */
  const shifted = inner.replace(/^ {4}/gm, '');
  return `  async ${opts.name}(${opts.arg}) {\n${shifted}\n  }`;
}

/* Build-time substitution rules. Empty when the gate is closed, so a closed gate
   injects nothing at all rather than injecting something disabled. */
function rules() {
  if (!CHECKOUT_ENABLED) return [];
  const variants = readVariants();
  const token = readToken();
  return [
    {
      file: 'Cart.dc.html',
      label: 'inert Checkout stub -> lazy Shopify cartCreate',
      from: STUB,
      to: cartHandler(variants, token),
      count: 1
    }
  ];
}

function cartHandler(variants, token) {
  return checkoutHandler(variants, token, {
    name: 'checkout',
    intro: 'Lazy Shopify cart creation. Nothing has been sent to Shopify before\n           this click, and nothing is sent if any check below fails.',
    gather: CART_GATHER,
    failed: MSG.failed,
    /* Meta InitiateCheckout, cart-shaped: every SKU, the parity-checked
       subtotal, and a real item count. Added 2026-09-02 — without it the
       funnel showed no checkout starting for any multi-item order. */
    beforeRedirect: PIXEL.PIXEL_ENABLED ? PIXEL.initiateCheckoutCart() : ''
  });
}

/* Every string all three handlers must have in common. tools/verify-build.js
   compares the built cart, product and shop pages on these, which is how "do
   not introduce a second checkout system" is asserted rather than assumed: the
   endpoint, the credential, the mutation and the parity check have to be
   identical in all of them. */
const SHARED_MARKERS = [
  "'https://' + SHOP + '/api/' + API + '/graphql.json'",
  "'X-Shopify-Storefront-Access-Token': TOKEN",
  'mutation CartCreate($lines:[CartLineInput!]!){cartCreate(input:{lines:$lines})',
  'if (!cost || Number(cost.amount) !== shown || cost.currencyCode !== CURRENCY)',
  'window.location.href = out.cart.checkoutUrl;'
];

module.exports = {
  CHECKOUT_ENABLED, TOKEN_ENV, PRIVILEGED_PREFIXES, STUB, MSG, TIMEOUT_MS,
  rules, readVariants, readToken,
  checkoutHandler, productGather, PRODUCT_GATHER, SHOP_GATHER, SHARED_MARKERS
};
