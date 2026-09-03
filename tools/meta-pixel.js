/* Meta Pixel on the Vercel storefront: PageView, ViewContent, InitiateCheckout.
 *
 * Jake's brief, 2026-09-02. Calmlyte is not a Shopify theme storefront, so the
 * split is deliberate:
 *
 *   this site (Vercel)   PageView, ViewContent, InitiateCheckout — everything
 *                        before the customer leaves for Shopify
 *   Shopify              Checkout, Purchase, and the server-side Conversions
 *                        API, via the Facebook & Instagram channel
 *
 * Purchase is deliberately not fired here. Shopify owns it, including CAPI and
 * its own deduplication, and a browser Purchase from this origin would be a
 * second, undeduplicated copy of every order. There is no event_id coordination
 * to get right because the two systems fire disjoint events.
 *
 * The Pixel ID
 * ------------
 * Injected at build time from META_PIXEL_ID. Not in this repo and not in any
 * tracked file — the same treatment as the Storefront token, for the same
 * reason: rotating it becomes an environment change and a rebuild rather than a
 * commit and a history rewrite.
 *
 * A Pixel ID is genuinely public — it ships in the page, as Meta intends. What
 * must never ship is a Conversions API access token, and the most likely way
 * that happens is someone pasting one into this variable by mistake. So the
 * value is validated before it is embedded: 15 or 16 digits, nothing else. A
 * CAPI token starts "EAA" and is a hundred-odd characters, so it fails that
 * check and the build stops rather than publishing a credential on all seven
 * pages. readPixelId() names that case explicitly.
 *
 * With the gate open and no ID the build fails. A deploy carrying pixel code
 * with no ID would show every page a broken tracker and report nothing, so
 * failing the build is the safer end state — the previous deploy keeps serving.
 * Vercel needs META_PIXEL_ID set in project settings before a deploy with this
 * gate open will build.
 *
 * What this does not do
 * ---------------------
 * No server-side CAPI from Vercel — explicitly out of scope for this pass, so
 * there is no access token anywhere in this path, nothing to leak, and no
 * serverless endpoint to secure.
 *
 * No AddToCart or InitiateCheckout from the Shop page. Its cards navigate to a
 * product page and nothing else; PageView is the whole story there.
 *
 * Where InitiateCheckout fires
 * ----------------------------
 * Both places a checkout can actually start: the product page's CTA and the
 * cart page's Checkout button. The first pass had only the product page, per
 * the original brief, which left the funnel reporting no checkout starting for
 * any customer buying more than one thing. Jake added the cart on 2026-09-02.
 *
 * The two payloads differ because the two events differ — one product at
 * quantity one, versus n lines and a cart subtotal — but both are emitted at
 * the same position in the same shared handler, so both inherit the same
 * guarantees about when they may fire.
 */

'use strict';

const PIXEL_ENABLED = true;

const PIXEL_ENV = 'META_PIXEL_ID';

/* Prefixes of Meta credentials that must never reach a browser. An app-scoped
   or system-user access token begins "EAA"; app secrets are 32 hex characters,
   which is why the shape check below demands digits rather than merely
   rejecting known prefixes. */
const CREDENTIAL_PREFIXES = ['EAA', 'EAAB', 'EAAG'];

function readPixelId() {
  const id = process.env[PIXEL_ENV];
  if (!id) {
    throw new Error(
      `Meta Pixel is enabled but ${PIXEL_ENV} is not set, so every page would ` +
      `carry pixel code with no destination.\n\n` +
      `  ${PIXEL_ENV}=<pixel id> node tools/build-site.js\n\n` +
      `On Vercel, set it in the project's environment variables. To build ` +
      `without the pixel instead, set PIXEL_ENABLED = false in ` +
      `tools/meta-pixel.js.`
    );
  }
  if (CREDENTIAL_PREFIXES.some(p => id.startsWith(p))) {
    throw new Error(
      `Refusing to build: ${PIXEL_ENV} begins with "${id.slice(0, 3)}", the prefix of a ` +
      `Meta access token. Embedding one in a public page would publish a credential ` +
      `with API access to the ad account. Only the numeric Pixel ID belongs here — ` +
      `a Conversions API token is never used client-side.`
    );
  }
  if (!/^[0-9]{15,16}$/.test(id)) {
    throw new Error(
      `${PIXEL_ENV} is not shaped like a Meta Pixel ID (expected 15 or 16 digits, ` +
      `got ${id.length} character(s)). Refusing to embed an unrecognised value in ` +
      `a public page — if this is an access token or an app secret it must not be ` +
      `here at all.`
    );
  }
  return id;
}

/* ------------------------------------------------------------------ *
 * The base code, injected into <head> on every built page.
 *
 * Meta's standard snippet, with two deliberate additions:
 *
 *   - the whole thing is wrapped so a failure to load cannot throw into the
 *     page. Nothing on this site depends on the pixel, and a tracker must never
 *     be able to break a storefront.
 *   - a `calmlyteTrack` helper, so the event calls injected elsewhere have one
 *     guarded path rather than repeating the typeof check. It is a no-op when
 *     fbq is missing, which is the normal state for a customer running an ad
 *     blocker — perhaps a third of them.
 * ------------------------------------------------------------------ */
function baseCode(pixelId) {
  return `<script>
/* Meta Pixel. PageView here; ViewContent and InitiateCheckout are fired from
   the page logic. Purchase is fired by Shopify, never from this origin. */
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
try { fbq('init', '${pixelId}'); fbq('track', 'PageView'); }
catch (e) { console.warn('[calmlyte] pixel init failed:', e); }
/* One guarded path for every other event on the site. A no-op when the pixel
   is blocked, and it can never throw into the caller — an ad blocker must not
   be able to break add-to-cart. */
window.calmlyteTrack = function (event, params) {
  try { if (typeof fbq === 'function') fbq('track', event, params); }
  catch (e) { console.warn('[calmlyte] pixel event failed:', event, e); }
};
</script>
<noscript><img height="1" width="1" style="display:none" alt=""
src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"></noscript>`;
}

/* ------------------------------------------------------------------ *
 * ViewContent, on the product page.
 *
 * Fired from componentDidMount, after ?sku= has resolved to a real product, so
 * it always describes the product actually on screen rather than the default.
 *
 * The payload comes from the page's own product table — the same table the
 * price beside the Add to cart button is rendered from, and the same one the
 * build asserts equal to the Shopify catalogue. There is no second catalogue
 * here; content_ids uses p.sku, the Shopify SKU, and content_name uses p.title,
 * the Shopify product title.
 * ------------------------------------------------------------------ */
const VC_ANCHOR = "    document.title = 'Calmlyte ' + PRODUCTS[key].name;";

const VIEW_CONTENT = `    document.title = 'Calmlyte ' + PRODUCTS[key].name;
    /* Meta ViewContent, once, for the product that actually resolved. */
    (function (vp) {
      window.calmlyteTrack && window.calmlyteTrack('ViewContent', {
        content_ids: [vp.sku],
        content_name: vp.title,
        content_type: 'product',
        value: vp.priceN,
        currency: 'USD'
      });
    })(PRODUCTS[key]);`;

/* ------------------------------------------------------------------ *
 * InitiateCheckout, from the product page only.
 *
 * Emitted into the shared checkout handler through its beforeRedirect hook, so
 * it sits after the userErrors check, after checkoutUrl is confirmed present,
 * and after Shopify's subtotal has been matched against the price on screen —
 * and before the redirect. Every one of the brief's conditions falls out of
 * that position rather than needing its own flag:
 *
 *   fires only on success        it is past every throw
 *   never before checkoutUrl     out.cart.checkoutUrl is verified above it
 *   once per click flow          _checkingOut gates the click, and this is the
 *                                single success point inside it
 *
 * calmlyteTrack swallows its own errors, so a blocked or broken pixel cannot
 * stop the redirect. That ordering matters more than the event does: losing a
 * tracking call costs a row in a dashboard, losing the redirect costs a sale.
 * ------------------------------------------------------------------ */
function initiateCheckout(product) {
  return `          /* Meta InitiateCheckout: checkoutUrl exists and its subtotal
             matched the page, so this is a real checkout starting. */
          window.calmlyteTrack && window.calmlyteTrack('InitiateCheckout', {
            content_ids: [${product}.sku],
            content_name: ${product}.title,
            content_type: 'product',
            value: shown,
            currency: 'USD',
            num_items: 1
          });`;
}

/* ------------------------------------------------------------------ *
 * InitiateCheckout, from the cart page.
 *
 * Added on Jake's instruction of 2026-09-02. Without it the funnel reported no
 * checkout starting for any customer who bought more than one thing — the
 * product page fires this, and the cart page was the other half.
 *
 * Same position in the shared handler, so the same three guarantees hold: past
 * every throw, after checkoutUrl is confirmed, after Shopify's subtotal has
 * matched the page.
 *
 * The payload is cart-shaped rather than a copy of the product one. `value` is
 * the subtotal already computed and parity-checked above it, so the number
 * reported is the number the customer read and Shopify agreed to. `num_items`
 * counts items, not lines — three of one product is three items. `contents`
 * carries the per-line quantities, which content_ids alone cannot express, and
 * is what Meta reads for a multi-item event.
 *
 * There is no content_name: with several products in the cart there is no one
 * name to give, and inventing a summary string would put a value in the field
 * that matches nothing in the catalogue.
 * ------------------------------------------------------------------ */
function initiateCheckoutCart() {
  return `          /* Meta InitiateCheckout: checkoutUrl exists and its subtotal
             matched the page, so this is a real checkout starting. */
          window.calmlyteTrack && window.calmlyteTrack('InitiateCheckout', {
            content_ids: cart.map(function (it) { return it.sku; }),
            contents: cart.map(function (it) { return { id: it.sku, quantity: it.qty }; }),
            content_type: 'product',
            value: shown,
            currency: 'USD',
            num_items: cart.reduce(function (n, it) { return n + it.qty; }, 0)
          });`;
}

/* Events this origin must never fire — Shopify owns them, with its own
   deduplication and its own server-side copy. */
const FORBIDDEN_EVENTS = ['Purchase', 'Subscribe', 'StartTrial'];

/* Events this origin does fire, in the order a customer meets them. */
const OWNED_EVENTS = ['PageView', 'ViewContent', 'InitiateCheckout'];

const RULES = [];
if (PIXEL_ENABLED) {
  RULES.push({
    file: 'Product.dc.html',
    label: 'PDP: Meta ViewContent for the resolved product',
    from: VC_ANCHOR,
    to: VIEW_CONTENT,
    count: 1
  });
}

module.exports = {
  PIXEL_ENABLED, PIXEL_ENV, CREDENTIAL_PREFIXES,
  readPixelId, baseCode, initiateCheckout, initiateCheckoutCart,
  FORBIDDEN_EVENTS, OWNED_EVENTS, RULES, VC_ANCHOR
};
