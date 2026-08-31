/* Resolve Shopify ProductVariant GIDs from the live store.
 *
 *   SHOPIFY_STOREFRONT_TOKEN=<public storefront token> node tools/resolve-variants.js
 *
 * Shopify's CSV export did not include Variant IDs, and a GID is not something to
 * transcribe or guess — the wrong one sells the wrong product at the wrong price.
 * So this reads them from the store itself, by handle, and refuses to write any
 * of them unless the variant's own SKU, price and currency match what
 * shopify-catalog.js says the site is selling. On success it writes
 * tools/shopify-variants.json; on any mismatch it writes nothing and exits 1.
 *
 * Nothing here enables checkout. The cart's Checkout button stays the inert stub
 * until SHOPIFY_CHECKOUT_ENABLED is deliberately flipped in tools/verify-build.js,
 * which is a separate, instructed change.
 *
 * On the token
 * ------------
 * Read from the environment only. Never written to a file, never printed, never
 * logged, and never sent to any host but the shop domain in shopify-catalog.js.
 *
 * A Storefront access token is publishable — it is designed to sit in client-side
 * code and is scoped to reading the storefront and building carts. An Admin API
 * token is not, is not needed here, and is rejected below on sight rather than
 * being sent anywhere.
 *
 * Zero dependencies: Node 22's global fetch.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { SHOP_DOMAIN, PRODUCTS, CURRENCY, VARIANTS_FILE } = require('./shopify-catalog');

const TOKEN_ENV = 'SHOPIFY_STOREFRONT_TOKEN';

/* Admin and custom-app tokens carry these prefixes. A Storefront public token
   does not. Refuse them before a request is made, so an Admin token pasted into
   the wrong variable is never transmitted. */
const PRIVILEGED_PREFIXES = ['shpat_', 'shpca_', 'shppa_', 'shpss_'];

/* Newest first. Shopify supports a version for at least a year, so several of
   these are live at any time; the script uses the first that answers and says
   which. Override with SHOPIFY_API_VERSION if the store is pinned. */
const API_VERSIONS = ['2026-07', '2026-04', '2026-01', '2025-10', '2025-07'];

const endpoint = v => `https://${SHOP_DOMAIN}/api/${v}/graphql.json`;

/* Aliases must be valid GraphQL names and SKUs contain hyphens, so query by
   index and map back. */
const KEYS = Object.keys(PRODUCTS);

const PRODUCT_QUERY = `query Variants {
${KEYS.map((k, i) => `  p${i}: product(handle: ${JSON.stringify(PRODUCTS[k].handle)}) {
    handle
    title
    variants(first: 25) { edges { node { id sku title availableForSale price { amount currencyCode } } } }
  }`).join('\n')}
}`;

async function post(version, token, query) {
  const res = await fetch(endpoint(version), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': token,
      /* No keep-alive. This script makes at most two requests, and a pooled
         socket outlives the work: Node exposes no public API for shutting its
         fetch agent down, so that idle handle is what forces a hard exit — and a
         hard exit mid-teardown aborts inside libuv on Windows. */
      'Connection': 'close'
    },
    body: JSON.stringify({ query })
  });
  let body = null;
  try { body = await res.json(); } catch (e) { /* non-JSON error page */ }
  return { status: res.status, body };
}

/* Find the API version this store answers on. A 401/403 is a token problem, not
   a version problem — stop rather than replaying a bad token four more times. */
async function pickVersion(token) {
  const pinned = process.env.SHOPIFY_API_VERSION;
  const candidates = pinned ? [pinned] : API_VERSIONS;
  const tried = [];

  for (const v of candidates) {
    const { status, body } = await post(v, token, '{ shop { name } }');
    if (status === 401 || status === 403) {
      throw new Error(
        `Storefront API rejected the token (HTTP ${status}). Check that ${TOKEN_ENV} is a ` +
        `Storefront access token for ${SHOP_DOMAIN} and that the four products are ` +
        `published to the sales channel it belongs to.`
      );
    }
    if (status === 200 && body && body.data && body.data.shop) {
      return { version: v, shopName: body.data.shop.name };
    }
    /* Shopify serves 404 from its own edge for a hostname where no shop lives.
       Every API version 404s in that case, so treat the first one as the shop
       problem it is rather than reporting a version problem four requests later.
       Every *.myshopify.com name resolves to the same CNAME whether or not the
       shop exists, so DNS cannot tell you this — only the HTTP response can. */
    if (status === 404) {
      throw new Error(
        `No shop is served at ${SHOP_DOMAIN} — Shopify returned 404 for the API endpoint ` +
        `and this is not a token or API-version problem. Confirm the .myshopify.com domain ` +
        `in the Shopify admin under Settings > Domains, and correct SHOP_DOMAIN in ` +
        `tools/shopify-catalog.js if it differs.`
      );
    }
    /* Shopify explains itself in the error body. Quote it rather than reducing it
       to a status code and blaming the API version, which is what a bare
       "tried five versions" report would do. */
    const stated = body && Array.isArray(body.errors)
      ? body.errors.map(e => e.message).filter(Boolean)
      : [];
    if (stated.length) {
      if (stated.some(m => /channel is locked/i.test(m))) {
        /* Observed on 2026-08-31 against this store with no token header at all,
           which is the request an unauthenticated probe makes. Reaching it *with*
           a token means the token authenticated but its channel cannot read the
           storefront, so the two things to check are the channel the token
           belongs to and whether the products are published to it. Deliberately
           not asserting which — that was untestable without a valid token, and a
           guess here sends someone to change the wrong store setting. */
        throw new Error(
          `Shopify: "${stated.join('; ')}"\n\n` +
          `The Storefront API refused to read the storefront for ${SHOP_DOMAIN}. In the ` +
          `Shopify admin, check that the app or channel this token belongs to is ` +
          `installed and active, and that all four products are published to it.\n\n` +
          `Storefront password protection — the "Opening soon" page — is a separate ` +
          `setting and does not need to be lifted for the API to work.`
        );
      }
      throw new Error(`Storefront API refused the request (HTTP ${status}): ${stated.join('; ')}`);
    }
    tried.push(`${v} -> HTTP ${status}`);
  }
  throw new Error(`No usable Storefront API version. Tried: ${tried.join(', ')}`);
}

function checkProduct(key, node) {
  const want = PRODUCTS[key];
  const problems = [];

  if (!node) {
    return { problems: [`handle "${want.handle}" returned no product — wrong handle, or not published to this sales channel`] };
  }

  const variants = node.variants.edges.map(e => e.node);
  const bySku = variants.filter(v => v.sku === want.sku);

  if (bySku.length === 0) {
    problems.push(
      `no variant with SKU "${want.sku}" on handle "${want.handle}" ` +
      `(found: ${variants.map(v => `${v.title}=${v.sku || 'no SKU'}`).join(', ') || 'none'})`
    );
    return { problems };
  }
  if (bySku.length > 1) {
    problems.push(`${bySku.length} variants share SKU "${want.sku}" — ambiguous, cannot pick one`);
    return { problems };
  }

  const v = bySku[0];
  const amount = Number(v.price.amount);

  if (!Number.isFinite(amount) || amount !== want.price) {
    problems.push(`price mismatch on "${want.sku}": Shopify ${v.price.amount}, site ${want.price}`);
  }
  if (v.price.currencyCode !== CURRENCY) {
    problems.push(`currency mismatch on "${want.sku}": Shopify ${v.price.currencyCode}, expected ${CURRENCY}`);
  }
  if (!v.availableForSale) {
    problems.push(`"${want.sku}" is not available for sale — unpublished, or out of stock with no oversell`);
  }
  if (!/^gid:\/\/shopify\/ProductVariant\//.test(v.id)) {
    problems.push(`"${want.sku}" returned an unexpected id shape: ${v.id}`);
  }

  return {
    problems,
    resolved: {
      sku: want.sku,
      handle: want.handle,
      name: want.name,
      variantId: v.id,
      variantTitle: v.title,
      price: amount,
      currency: v.price.currencyCode
    }
  };
}

async function main() {
  const token = process.env[TOKEN_ENV];

  if (!token) {
    console.error(
      `${TOKEN_ENV} is not set.\n\n` +
      `Pass a Shopify *Storefront* access token for ${SHOP_DOMAIN} in the environment. ` +
      `It is publishable and read-scoped. Do not use an Admin API token, and do not ` +
      `write the token into a tracked file — the environment is the only place it belongs.\n\n` +
      `  SHOPIFY_STOREFRONT_TOKEN=xxxx node tools/resolve-variants.js\n`
    );
    return 2;
  }
  if (PRIVILEGED_PREFIXES.some(p => token.startsWith(p))) {
    console.error(
      `Refusing to use this token: it begins with "${token.slice(0, 6)}", the prefix of a ` +
      `Shopify Admin or custom-app access token. Those are secrets, are not needed for ` +
      `variant lookup or cart creation, and will not be sent anywhere by this script. ` +
      `Supply a Storefront access token instead.\n`
    );
    return 2;
  }

  const { version, shopName } = await pickVersion(token);
  console.log(`Storefront API ${version} — ${shopName} (${SHOP_DOMAIN})\n`);

  const { status, body } = await post(version, token, PRODUCT_QUERY);
  if (status !== 200 || !body || !body.data) {
    const detail = body && body.errors ? JSON.stringify(body.errors) : `HTTP ${status}`;
    throw new Error(`Variant query failed: ${detail}`);
  }
  if (body.errors && body.errors.length) {
    console.error('GraphQL errors:');
    for (const e of body.errors) console.error('  ' + e.message);
    return 1;
  }

  const resolved = {};
  const failures = [];
  const rows = [];

  KEYS.forEach((key, i) => {
    const out = checkProduct(key, body.data[`p${i}`]);
    for (const p of out.problems) failures.push(p);
    if (out.resolved && out.problems.length === 0) {
      resolved[key] = out.resolved;
      rows.push(out.resolved);
    }
  });

  for (const r of rows) {
    console.log(`  ${r.sku.padEnd(13)} ${r.handle.padEnd(23)} $${String(r.price).padStart(5)}  ${r.variantId}`);
  }

  if (failures.length) {
    console.error(`\n${failures.length} problem(s) — nothing written:`);
    for (const f of failures) console.error('  ' + f);
    return 1;
  }

  const out = {
    /* No token, and none is derivable from this file. GIDs, handles and prices
       are all public storefront data. */
    shopDomain: SHOP_DOMAIN,
    apiVersion: version,
    currency: CURRENCY,
    variants: resolved
  };
  const dest = path.join(__dirname, VARIANTS_FILE);
  fs.writeFileSync(dest, JSON.stringify(out, null, 2) + '\n');

  console.log(`\nAll four variants match the site on SKU, price and currency.`);
  console.log(`Wrote tools/${VARIANTS_FILE}.`);
  console.log(`Checkout is still the inert stub — enabling it is a separate change.`);
  return 0;
}

if (require.main === module) {
  /* process.exitCode, not process.exit(): setting the code lets Node unwind the
     event loop on its own. Forcing exit while a socket is still being torn down
     aborts inside libuv on Windows, which replaces the real exit code with 127
     and prints a C assertion on top of the actual error message. */
  main().then(
    code => { process.exitCode = code; },
    err => { console.error('\n' + err.message + '\n'); process.exitCode = 1; }
  );
}

module.exports = { PRODUCT_QUERY, checkProduct, PRIVILEGED_PREFIXES, API_VERSIONS };
