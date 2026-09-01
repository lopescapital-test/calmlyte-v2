/* Retire the standalone FAQ page.
 *
 * Per Jake 2026-09-01: the product pages now answer the relevant questions below
 * their Specifications module, so the separate FAQ page and its nav item are
 * redundant. The preferred end state is no FAQ route at all, which is what this
 * does — FAQ.dc.html is dropped from the route map in tools/build-site.js, so
 * faq.html is never written, and the nav item is removed from every page that is.
 *
 * Removing the route only works if nothing links to it. A surviving link would
 * be caught either way — assertion 1 fails the build on any unmapped
 * design-tool route reaching the output — but it is better to remove the links
 * deliberately than to discover them through a failed build.
 *
 * The links, all of them:
 *   - one nav item per page, byte-identical across all seven built artboards
 *   - the "More questions" link in the Specifications module, already removed by
 *     tools/pdp-conversion.js
 * There are no others. Checked across the approved set, not assumed.
 *
 * What this does not touch: the FAQ artboard itself stays in the approved
 * directory, unedited and unbuilt, so nothing is lost and the page can be
 * restored by putting one line back in ROUTES.
 */

'use strict';

/* The nav item, verbatim. Byte-identical in Shinrin Yoku, Shop, Product, Cart,
   Light, Studies and Research — verified, not assumed — so one string serves all
   seven. Only the leading indentation differs between files, which is why the
   match starts at the tag. */
const NAV_ITEM =
  '<a href="FAQ.dc.html" style="font-size:11.5px;letter-spacing:1.6px;text-transform:uppercase;color:#C6CFC4;padding:8px 13px;border-bottom:1px solid transparent" style-hover="color:#E7CE9B">FAQ</a>';

const PAGES = [
  'Shinrin Yoku.dc.html',
  'Shop.dc.html',
  'Product.dc.html',
  'Cart.dc.html',
  'Light.dc.html',
  'Studies.dc.html',
  'Research.dc.html'
];

const RULES = PAGES.map(file => ({
  file,
  label: 'nav: remove the FAQ item',
  from: NAV_ITEM,
  to: '',
  count: 1
}));

module.exports = { RULES, NAV_ITEM, PAGES };
