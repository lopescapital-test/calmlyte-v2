/* The product page's primary CTA goes straight to Shopify checkout.
 *
 * Jake's brief, 2026-09-02. Add to cart put a page between the customer and
 * checkout: click, land on the cart, click Checkout. The CTA now creates a
 * Shopify cart holding that one product at quantity one and redirects to its
 * checkoutUrl. The Calmlyte cart page is untouched and still works for anyone
 * who reaches it from the nav or who already has a cart.
 *
 * One checkout, not two
 * ---------------------
 * The whole call comes from checkoutHandler() in tools/checkout-wiring.js. This
 * module supplies only the renderVals key it should be bound to and the gather
 * block that names one variant; the endpoint, the token, the mutation, the
 * timeout, the subtotal parity check and the redirect are the same bytes as the
 * cart page's. Assertion 4i compares the two built handlers on those strings, so
 * a future edit to one that is not made to the other fails the build.
 *
 * Gated with checkout
 * -------------------
 * rules() is a function, not a static array, and returns nothing when
 * CHECKOUT_ENABLED is false. Both rules have to move together: rebinding the
 * button without injecting the handler ships a CTA bound to a renderVals key
 * that does not exist, so the primary CTA does nothing at all. They come from
 * one rules() call for that reason, and both gate directions are asserted.
 *
 * The label
 * ---------
 * "Add to cart", unchanged from the artboard. The first pass changed it to "Buy
 * now" to match the behaviour; Jake's revision of 2026-09-02 keeps the original
 * wording and the direct-to-checkout behaviour together, which is his call and
 * is what this ships.
 *
 * It does mean the label no longer describes what the button does, so a customer
 * who expects to keep shopping lands on a payment page instead. Noted here
 * because it changes what the assertions have to protect rather than because it
 * is being argued again: with the label identical either way, the label is no
 * longer evidence of which handler the button calls. So the pairing is asserted
 * directly — assertion 4i requires the element reading "Add to cart" to be the
 * one bound to buyNow, and requires nothing at all to be bound to addToCart.
 * Before, a rule that silently stopped applying would at least have left a
 * visibly wrong label; now it would leave a button that looks exactly right and
 * quietly does the old thing.
 *
 * CTA_LABEL is therefore a value this module asserts rather than writes: the
 * substitution changes the onClick and nothing else.
 *
 * What is deliberately left alone
 * -------------------------------
 * `addToCart` stays in renderVals, unwired. Removing it would orphan the
 * artboard's own add() method, which also maintains the nav cart badge, so the
 * dead code would move rather than disappear — and deleting add() is a change to
 * artboard behaviour that the brief does not ask for. An inline comment in the
 * built page says it is unwired, so the next reader does not bind a button to it
 * by mistake. The Shop page's Add buttons still build multi-item carts.
 *
 * The one behaviour worth knowing about: a customer who already has items in the
 * Calmlyte cart and then uses the product CTA gets a checkout containing only
 * the product they were looking at. Their cart is not merged into it and not
 * cleared — it is still there when they come back. That is what the brief asks
 * for ("Shopify checkout with Handheld only, quantity 1"), and the alternative
 * would be to charge for items the customer was not shown at the moment of
 * clicking. It is more surprising now that the button says "Add to cart": a
 * customer with two items in the cart who reads the label and clicks reaches a
 * checkout for one of them, with the other still sitting in the cart behind
 * them.
 */

'use strict';

const CHECKOUT = require('./checkout-wiring');
const PIXEL = require('./meta-pixel');
const HERO = require('./pdp-hero-copy');

const FILE = 'Product.dc.html';

/* The renderVals key the CTA binds to, and the label the customer reads. Only
   the first of these changes; CTA_LABEL is the artboard's own wording, kept
   deliberately, and is exported so the assertions can pin it. */
const HANDLER = 'buyNow';
const OLD_HANDLER = 'addToCart';
const CTA_LABEL = 'Add to cart';

/* ------------------------------------------------------------------ *
 * 1. The button
 *
 * BUTTON is imported rather than copied, so this rule's `from` cannot drift out
 * of step with the markup tools/pdp-hero-copy.js emits. That rule runs first and
 * moves the button into the price row, trimming its indentation; the tag itself
 * is byte-identical from `<button` onward, which is where the match starts.
 * ------------------------------------------------------------------ */

const CTA_OLD = HERO.BUTTON.trimStart();

/* The onClick, and only the onClick. */
const CTA_NEW = CTA_OLD.replace(`{{ ${OLD_HANDLER} }}`, `{{ ${HANDLER} }}`);

/* Three things have to be true of the rewrite, checked here rather than left to
   the build's match count, because that count only proves the `from` was found
   once — not that the `to` is what it should be. */
if (CTA_NEW === CTA_OLD) {
  throw new Error(
    'tools/pdp-buy-now.js: could not rewrite the product CTA — ' +
    `"{{ ${OLD_HANDLER} }}" was not found in HERO.BUTTON. ` +
    'Check tools/pdp-hero-copy.js.'
  );
}
if (CTA_NEW.includes(`{{ ${OLD_HANDLER} }}`)) {
  throw new Error(
    'tools/pdp-buy-now.js: the rewritten CTA is still bound to ' +
    `${OLD_HANDLER}, so the primary CTA would still add to the local cart.`
  );
}
/* And the label must survive untouched. It is the artboard's wording, kept on
   purpose, so a change to it here would be an unreviewed copy change — and
   since the label is no longer evidence of the binding, a silent one. */
if (!CTA_NEW.includes(`>${CTA_LABEL}</button>`)) {
  throw new Error(
    `tools/pdp-buy-now.js: the CTA no longer reads "${CTA_LABEL}". The label is ` +
    'the approved artboard\'s and must not change here; if tools/pdp-hero-copy.js ' +
    'reworded the button, update CTA_LABEL deliberately.'
  );
}

/* ------------------------------------------------------------------ *
 * 2. The handler
 *
 * Injected beside addToCart in renderVals, where `p` — the product currently
 * being viewed — is in scope. The gather block reads p.sku and p.priceN from the
 * page's own product table, which is the same table the price beside the button
 * is rendered from, so the parity check compares Shopify's subtotal against the
 * exact number the customer just read.
 * ------------------------------------------------------------------ */

const RENDERVAL_OLD = '      addToCart: () => this.add(p),';

function renderValNew(variants, token) {
  const handler = CHECKOUT.checkoutHandler(variants, token, {
    name: HANDLER,
    intro:
      'The product page CTA. Reads "Add to cart" and goes straight to Shopify:\n' +
      '           creates a cart holding this one product and hands the customer to its\n' +
      '           checkoutUrl. Nothing is sent to Shopify before this click, nothing is\n' +
      '           sent if any check below fails, and the Calmlyte cart in localStorage\n' +
      '           is neither read nor written.',
    gather: CHECKOUT.PRODUCT_GATHER,
    failed: CHECKOUT.MSG.pdpFailed,
    /* Meta InitiateCheckout. Product-page flow only: the cart page's Checkout
       button is a different shape (n items, a different total) and the brief
       specifies num_items:1 here. */
    beforeRedirect: PIXEL.PIXEL_ENABLED ? PIXEL.initiateCheckout('p') : ''
  });

  return (
    '      /* Unwired since 2026-09-02. The primary CTA still reads "Add to cart"\n' +
    '         but is bound to buyNow below, which goes straight to Shopify. This\n' +
    '         is kept only because add() also maintains the nav cart badge. Do\n' +
    '         not bind a button to it without deciding what a second add-to-cart\n' +
    '         means beside a CTA that already says exactly that. */\n' +
    RENDERVAL_OLD + '\n' +
    handler
  );
}

/* ------------------------------------------------------------------ *
 * Rules
 * ------------------------------------------------------------------ */

function rules() {
  if (!CHECKOUT.CHECKOUT_ENABLED) return [];
  const variants = CHECKOUT.readVariants();
  const token = CHECKOUT.readToken();
  return [
    {
      file: FILE,
      label: `hero CTA: rebound to ${HANDLER} (label stays "${CTA_LABEL}")`,
      from: CTA_OLD,
      to: CTA_NEW,
      count: 1
    },
    {
      file: FILE,
      label: `renderVals: add the ${HANDLER} handler`,
      from: RENDERVAL_OLD,
      to: renderValNew(variants, token),
      count: 1
    }
  ];
}

module.exports = {
  rules, HANDLER, OLD_HANDLER, CTA_LABEL,
  CTA_OLD, CTA_NEW, RENDERVAL_OLD, FILE
};
