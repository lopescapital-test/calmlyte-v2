/* The Shop page's four ADD buttons go straight to Shopify checkout.
 *
 * Jake's brief, 2026-09-02. The product page's CTA already went direct; ADD
 * still wrote a line to localStorage and left the customer to find the cart.
 * Each ADD now creates a Shopify cart holding that one product at quantity one
 * and redirects to its checkoutUrl.
 *
 * One checkout, not three
 * ----------------------
 * The whole call comes from checkoutHandler() in tools/checkout-wiring.js, with
 * SHOP_GATHER — the same productGather() the product page uses, pointed at the
 * card's ITEMS entry instead of the viewed product. Endpoint, token, mutation,
 * timeout, subtotal parity check and redirect are the same bytes as the cart and
 * product pages'. Assertion 4j compares all three built pages on those strings.
 *
 * One method, four one-line bindings
 * ---------------------------------
 * The artboard has four separate renderVals keys, add0 to add3, one per card,
 * each calling this.add(ITEMS[n]). Injecting the handler into all four would put
 * four identical copies of a hundred lines into the shipped page. So the
 * artboard's add(p) method is replaced by an injected buyNow(item) method, and
 * the four keys are repointed at it — four one-line substitutions and one
 * method. Every card gets identical behaviour because there is only one copy of
 * it, and the markup is not touched at all, so the card layout and the ADD label
 * cannot move.
 *
 * Replacing add() rather than leaving it
 * -------------------------------------
 * On the product page the equivalent method was left in place because the badge
 * depended on it. Here it does not: read() and total() are separate methods, and
 * componentDidMount uses them to show a cart that already exists. So add() is
 * genuinely dead once the four keys are repointed, and replacing it outright is
 * cleaner than leaving a method that writes to a cart nothing on this page is
 * meant to write to any more. Nothing else in the artboard calls it — checked
 * across the file, not assumed, and the count assertion would fail if a second
 * caller appeared.
 *
 * What this deliberately preserves
 * -------------------------------
 * The badge still shows an existing cart. componentDidMount reads localStorage
 * once on load, so a customer who built a cart from an earlier visit still sees
 * CART (n) — it simply never increments from this page again. That is the brief:
 * do not increment the badge, do not clear the cart. A customer with 2x Belt who
 * clicks ADD on the Handheld reaches a checkout for one Handheld, and their two
 * Belts are still in the cart when they come back.
 *
 * The label
 * ---------
 * ADD, unchanged, per the brief. As on the product page this means the button no
 * longer describes what it does, and the same consequence follows: the label is
 * no longer evidence of the behaviour, so assertion 4j checks the four keys are
 * bound to the injected method and that nothing on the page still writes to
 * localStorage from a click. A rule that silently stopped applying would leave
 * four buttons that look exactly right and quietly do the old thing.
 */

'use strict';

const CHECKOUT = require('./checkout-wiring');

const FILE = 'Shop.dc.html';

/* The injected method, and the four renderVals keys that call it. */
const METHOD = 'buyNow';
const ARG = 'item';
const KEYS = ['add0', 'add1', 'add2', 'add3'];

/* ------------------------------------------------------------------ *
 * 1. The method
 *
 * The artboard's add(p), verbatim. A literal, so a change to it fails the count
 * assertion rather than being silently worked around.
 * ------------------------------------------------------------------ */

const ADD_METHOD_OLD = `  add(p) {
    const cart = this.read();
    const hit = cart.find(i => i.sku === p.sku);
    if (hit) hit.qty += 1; else cart.push({ sku: p.sku, name: p.name, price: p.price, qty: 1 });
    localStorage.setItem(KEY, JSON.stringify(cart));
    clearTimeout(this._t);
    this.setState({ count: this.total(), toast: p.name + ' added to cart' });
    this._t = setTimeout(() => this.setState({ toast: '' }), 2400);
  }`;

function methodNew(variants, token) {
  return CHECKOUT.checkoutHandler(variants, token, {
    name: METHOD,
    arg: ARG,
    method: true,
    intro:
      'A Shop card\'s ADD button. Reads "ADD" and goes straight to Shopify:\n' +
      '       creates a cart holding this one product and hands the customer to its\n' +
      '       checkoutUrl. Nothing is sent to Shopify before this click, nothing is\n' +
      '       sent if any check below fails, and the Calmlyte cart in localStorage is\n' +
      '       neither read nor written — an existing cart survives untouched and the\n' +
      '       badge does not move.',
    gather: CHECKOUT.SHOP_GATHER,
    failed: CHECKOUT.MSG.pdpFailed
  });
}

/* ------------------------------------------------------------------ *
 * 2. The four bindings
 * ------------------------------------------------------------------ */

const keyOld = (key, i) => `      ${key}: () => this.add(ITEMS[${i}]),`;
const keyNew = (key, i) => `      ${key}: () => this.${METHOD}(ITEMS[${i}]),`;

/* ------------------------------------------------------------------ *
 * 3. The toast has to be visible where the customer clicked
 *
 * The artboard anchors this page's toast with position:absolute, so it sits at
 * one fixed spot on the page rather than in the viewport. That was fine for what
 * it used to say — a customer who misses "Belt added to cart" has lost nothing,
 * and the badge tells them anyway. It is not fine for what it says now, which is
 * the only notice a customer gets that their checkout failed, and the only place
 * the support address appears.
 *
 * Measured rather than assumed. At 390x700, clicking ADD on the Belt — the last
 * card, so the furthest from the toast's anchor — renders it at top -126px,
 * bottom 10px: ten pixels of a five-line message on screen. A customer whose
 * payment attempt fails there sees a button that did nothing.
 *
 * The fix is the one property, bringing this page in line with the product and
 * cart pages, which the same artboard family already sets to position:fixed.
 * Nothing else about the toast changes and no card layout is touched — the toast
 * is an overlay that only exists while a message is showing.
 * ------------------------------------------------------------------ */

const TOAST_OLD = `toastStyle: 'position:absolute;left:50%;bottom:24px;`;
const TOAST_NEW = `toastStyle: 'position:fixed;left:50%;bottom:24px;`;

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
      label: `add(p) -> direct-checkout ${METHOD}(${ARG})`,
      from: ADD_METHOD_OLD,
      to: methodNew(variants, token),
      count: 1
    },
    {
      file: FILE,
      label: 'toast: anchor to the viewport so a failure is readable',
      from: TOAST_OLD,
      to: TOAST_NEW,
      count: 1
    }
  ].concat(
    KEYS.map((key, i) => ({
      file: FILE,
      label: `${key}: card ADD -> ${METHOD}`,
      from: keyOld(key, i),
      to: keyNew(key, i),
      count: 1
    }))
  );
}

module.exports = {
  rules, METHOD, ARG, KEYS, ADD_METHOD_OLD, keyOld, keyNew, TOAST_NEW, FILE
};
