/* The Shopify catalogue: what the store sells, keyed by the SKU the site uses.
 *
 * Supplied by Jake on 2026-08-31 after the four products were created and their
 * handles, SKUs, prices and inventory were confirmed in the Shopify admin.
 *
 * This file holds no secrets and never will. The shop domain and product handles
 * are public — they appear in any storefront URL. The Storefront access token is
 * read from the environment by tools/resolve-variants.js and is never written to
 * a tracked file. An Admin API token is not needed here and must not be used.
 *
 * Nothing in this module reaches the built site. tools/build-site.js does not
 * read it, and while the commerce gate is closed the build asserts that no
 * Shopify marker — the domain included — appears in build/. Its only two
 * consumers today are tools/resolve-variants.js and the parity assertion in
 * tools/verify-build.js.
 *
 * Variant GIDs are absent on purpose. The CSV export Shopify produced did not
 * carry them, and they are not something to transcribe by hand or guess: a wrong
 * GID in a cartCreate call sells the wrong thing at the wrong price. They get
 * resolved from the live store through the Storefront API, checked against the
 * SKU and price below, and only then written to shopify-variants.json.
 */

'use strict';

/* Public storefront domain. Used to build the Storefront API endpoint and as
   the only host tools/resolve-variants.js will send a token to. */
const SHOP_DOMAIN = 'e6hqgs-hu.myshopify.com';

/* Keyed by the SKU the site already uses in Shop cards, PDP entries and the cart
   — the same string Shopify carries as the variant SKU, so the two sides join on
   one value with no translation table.
 *
 * `price` is USD, as an integer, matching how the site stores it (priceN in the
 * PDP entry, price in the cart META). The build asserts these against the
 * built pages, so a price changed on one side and not the other fails the build
 * rather than reaching a customer. */
const PRODUCTS = {
  'small-panel':  { handle: 'calmlyte-panel',        sku: 'small-panel',  price: 600,  name: 'Panel' },
  'handheld':     { handle: 'calmlyte-handheld',     sku: 'handheld',     price: 450,  name: 'Handheld' },
  'studio-panel': { handle: 'calmlyte-studio-panel', sku: 'studio-panel', price: 6000, name: 'Studio Panel' },
  'belt':         { handle: 'calmlyte-belt',         sku: 'belt',         price: 200,  name: 'Belt' }
};

const CURRENCY = 'USD';

/* Where tools/resolve-variants.js writes what it resolves. Generated, not
   hand-edited. Its absence is the normal state until the token arrives. */
const VARIANTS_FILE = 'shopify-variants.json';

module.exports = { SHOP_DOMAIN, PRODUCTS, CURRENCY, VARIANTS_FILE };
