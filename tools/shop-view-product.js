/* The Shop page's card buttons go to the product page, not to checkout.
 *
 * Jake's correction, 2026-09-02. The previous pass sent each ADD straight to
 * Shopify. The intended funnel is Shop -> View product -> PDP -> Add to cart ->
 * Shopify, so the cards now navigate and nothing on this page touches commerce.
 * This module replaces tools/shop-buy-now.js, which is deleted: shop.html
 * carries no Storefront token, no cartCreate and no variant map at all.
 *
 * Four things change, all in the approved artboard's own vocabulary:
 *
 *   1. the label default, 'Add' -> 'View product'
 *   2. the four renderVals keys, add0..add3 -> view0..view3
 *   3. the four button bindings, to match
 *   4. the artboard's add() method, removed
 *
 * Renaming the keys
 * -----------------
 * add0 doing navigation is the trap the product page's CTA already taught us: a
 * name that says one thing while the code does another survives review because
 * nothing looks wrong. Here the customer-facing label is honest, so the risk is
 * only to the next maintainer — but it is the same risk, and renaming costs four
 * one-line rules. Assertion 2b independently catches a binding whose renderVals
 * key does not exist, so a half-applied rename fails the build rather than
 * shipping a dead button.
 *
 * Removing add() rather than keeping it
 * -------------------------------------
 * Nothing calls it once the keys are repointed, and what it does — write the
 * local cart, bump the badge, raise a toast — is now exactly what this page must
 * not do. read() and total() stay: componentDidMount uses them to show a cart
 * built on an earlier visit, which is preserved deliberately.
 *
 * Why the Panel button goes to ?sku=panel
 * ---------------------------------------
 * The brief specifies /product.html?sku=small-panel for the Panel. That is the
 * Shopify catalogue SKU; the PDP resolves ?sku= against its own product keys,
 * which are panel, handheld, studio-panel and belt. Two things follow.
 *
 * First, ?sku=small-panel rendered the Panel only by accident: the lookup missed
 * and fell through to the default, which happens to be the Panel.
 * tools/pdp-sku-aliases.js fixes that properly, so the URL now resolves because
 * small-panel is the Panel's SKU.
 *
 * Second, this button is not the only link on the card. The card image and the
 * product title are already anchors, and both point at ?sku=panel. Sending the
 * button somewhere else would put two URLs for one product on one card, and the
 * site is now indexable, so that is two crawlable pages competing with identical
 * content. The button therefore matches the anchors beside it. Both URLs work;
 * only one is used.
 *
 * Buttons, not anchors
 * --------------------
 * Left as <button>, as the artboard has them. Converting to <a> would gain
 * middle-click and open-in-new-tab, but not crawlability — the image and title
 * anchors already give every PDP two real inbound links from this page, checked
 * rather than assumed.
 */

'use strict';

const FILE = 'Shop.dc.html';

const CTA_LABEL = 'View product';
const OLD_LABEL = 'Add';

/* ITEMS index -> the PDP key that renders that product. The PDP keys its own
   product table by these; ITEMS is keyed by Shopify SKU, which is why the two
   differ for the Panel. Order is the artboard's ITEMS order, not the visual
   order of the cards. */
const ROUTES = [
  { key: 'panel',        name: 'Panel' },
  { key: 'handheld',     name: 'Handheld' },
  { key: 'studio-panel', name: 'Studio Panel' },
  { key: 'belt',         name: 'Belt' }
];

/* Emitted as the design-tool route; tools/build-site.js rewrites it to
   product.html on the way out, exactly as it does for the anchors the artboard
   already carries. Writing product.html here would work and would also be the
   one place the route is not mapped. */
const ROUTE_SRC = 'Product.dc.html?sku=';

/* The label lives in two places, and only one of them decides what a customer
   reads.
 *
 * renderVals has `addLabel: (this.props.addLabel ?? 'Add')`, which looks like
 * the source of truth and is not: the artboard also declares addLabel as a
 * design-tool prop with its own default, and that default is supplied at
 * runtime, so the `??` branch never evaluates. Changing the fallback alone
 * builds cleanly, asserts cleanly against the source string, and still renders
 * "Add" — which is exactly what happened on the first run of this rule.
 *
 * So both are rewritten, and assertion 4j-i checks the prop default, which is
 * the one that actually reaches the button. */
const LABEL_OLD = "      addLabel: (this.props.addLabel ?? '" + OLD_LABEL + "'),";
const LABEL_NEW = "      addLabel: (this.props.addLabel ?? '" + CTA_LABEL + "'),";

/* The prop schema, HTML-escaped as the artboard stores it. */
const PROP_OLD = '&quot;addLabel&quot;: {&quot;editor&quot;: &quot;text&quot;, &quot;default&quot;: &quot;' +
  OLD_LABEL + '&quot;, &quot;tsType&quot;: &quot;string&quot;, &quot;section&quot;: &quot;Layout&quot;}';
const PROP_NEW = '&quot;addLabel&quot;: {&quot;editor&quot;: &quot;text&quot;, &quot;default&quot;: &quot;' +
  CTA_LABEL + '&quot;, &quot;tsType&quot;: &quot;string&quot;, &quot;section&quot;: &quot;Layout&quot;}';

const keyOld = i => '      add' + i + ': () => this.add(ITEMS[' + i + ']),';
const keyNew = i =>
  '      view' + i + ": () => { location.assign('" + ROUTE_SRC + ROUTES[i].key + "'); },";

const bindOld = i => 'onClick="{{ add' + i + ' }}"';
const bindNew = i => 'onClick="{{ view' + i + ' }}"';

/* The artboard's add(p), verbatim, with the trailing newline so removing it
   does not leave a blank line behind. A literal, so a change to it fails the
   count assertion rather than being silently worked around. */
const ADD_METHOD_OLD = [
  '  add(p) {',
  '    const cart = this.read();',
  '    const hit = cart.find(i => i.sku === p.sku);',
  '    if (hit) hit.qty += 1; else cart.push({ sku: p.sku, name: p.name, price: p.price, qty: 1 });',
  '    localStorage.setItem(KEY, JSON.stringify(cart));',
  '    clearTimeout(this._t);',
  "    this.setState({ count: this.total(), toast: p.name + ' added to cart' });",
  "    this._t = setTimeout(() => this.setState({ toast: '' }), 2400);",
  '  }',
  ''
].join('\n');

/* Deliberately a static array, not gated on CHECKOUT_ENABLED. Navigation is not
   commerce: these buttons behave identically whether or not checkout is wired,
   and with the gate closed the Shop page should still take a customer to the
   product page rather than fall back to filling a cart it cannot check out. */
const RULES = [
  {
    file: FILE,
    label: 'card button label (prop default): ' + OLD_LABEL + ' -> ' + CTA_LABEL,
    from: PROP_OLD,
    to: PROP_NEW,
    count: 1
  },
  {
    file: FILE,
    label: 'card button label (renderVals fallback): ' + OLD_LABEL + ' -> ' + CTA_LABEL,
    from: LABEL_OLD,
    to: LABEL_NEW,
    count: 1
  },
  {
    file: FILE,
    label: 'remove add(): this page no longer writes the local cart',
    from: ADD_METHOD_OLD,
    to: '',
    count: 1
  }
].concat(
  ROUTES.flatMap((r, i) => [
    {
      file: FILE,
      label: 'add' + i + ' -> view' + i + ': navigate to the ' + r.name + ' PDP',
      from: keyOld(i),
      to: keyNew(i),
      count: 1
    },
    {
      file: FILE,
      label: 'card binding ' + i + ': {{ add' + i + ' }} -> {{ view' + i + ' }}',
      from: bindOld(i),
      to: bindNew(i),
      count: 1
    }
  ])
);

module.exports = {
  RULES, CTA_LABEL, OLD_LABEL, ROUTES, ROUTE_SRC,
  LABEL_NEW, PROP_NEW, keyNew, bindNew, ADD_METHOD_OLD, FILE
};
