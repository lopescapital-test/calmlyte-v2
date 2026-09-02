/* The product page resolves ?sku= by product key or by Shopify SKU.
 *
 * The approved artboard resolves one way only:
 *
 *   const key = PRODUCTS[q] ? q : 'panel';
 *
 * PRODUCTS is keyed panel / handheld / studio-panel / belt, so any other value
 * misses and falls through to the default. That default is the Panel, which made
 * ?sku=small-panel — the Panel's Shopify SKU, and the URL Jake's brief of
 * 2026-09-02 specifies — render the right product for the wrong reason. Change
 * the default, or reorder the table, and that URL would quietly start showing
 * something else.
 *
 * So the lookup gains a second step: try the key, then try the SKU, then fall
 * back. Both namespaces now resolve deliberately, and the fallback stays the
 * last resort it always was.
 *
 * Nothing that worked before changes: the key lookup is still first, so every
 * existing link — the Shop card anchors, the PDP's own cross-links, anything
 * already shared — resolves exactly as it did.
 */

'use strict';

const FILE = 'Product.dc.html';

const OLD = "    const key = PRODUCTS[q] ? q : 'panel';";

/* Written inline rather than as a helper: it is injected into a method body in
   a page that ships to the browser, and reads better where it is used. */
const NEW = [
  '    const key = PRODUCTS[q] ? q',
  "      : (Object.keys(PRODUCTS).find(k => PRODUCTS[k].sku === q) || 'panel');"
].join('\n');

const RULES = [
  {
    file: FILE,
    label: '?sku= resolves by product key or by Shopify SKU',
    from: OLD,
    to: NEW,
    count: 1
  }
];

module.exports = { RULES, OLD, NEW, FILE };
