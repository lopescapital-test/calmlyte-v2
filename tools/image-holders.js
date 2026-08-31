/* Product image holders -> driven by the image, not a fixed colour.
 *
 * The artboards paint every image holder #16211B, the dark panel green. That is
 * invisible where an image fills its box (background-size:cover), but the
 * product-page main image switches to `contain` for every shot after the hero,
 * so a letterboxed studio shot sits inside a dark green frame.
 *
 * A single white holder does not solve it either: the supplied Studio Panel
 * renders do not share a backdrop. Measured corner pixels — hero #FFFFFF,
 * side #DBDBDB, rear #FEFEFE, front #E0E0E0 — so any one value leaves a seam on
 * the others.
 *
 * So the holder colour travels with the image. Each entry in a product's
 * `images` array may carry a fourth element, its backdrop colour; the main
 * holder and the thumbnail holders read it, and it changes as the selected
 * thumbnail changes. Products that do not supply one fall back to #16211B, so
 * every other PDP renders exactly as before.
 *
 * Applied at build time by tools/build-site.js. The approved artboards are not
 * edited, and no image is cropped, recoloured, or regenerated.
 *
 * Scope, per Jake 2026-08-31: Studio Panel PDP only. Deliberately unchanged —
 *   - the <figure> wrapper, which keeps #16211B. It is fully covered by the
 *     inner holder div (width:100%, aspect-ratio-driven height, overflow:hidden
 *     on the figure), so its colour is not visible; making it dynamic would mean
 *     adding a binding to approved logic for no visual gain.
 *   - Shop product cards: holder sits behind an <img object-fit:cover>, so it
 *     never shows, and every card hero is a dark room scene, not a studio shot.
 *   - "The rest of the range" cards and cart thumbnails, both cover-filled.
 *   - The toast, which shares the #16211B value but is not an image holder.
 */

'use strict';

/* Fallback for any image that carries no colour — i.e. every product but the
   Studio Panel. Identical to the artboard's original value. */
const DEFAULT_HOLDER = '#16211B';

const RULES = [
  {
    file: 'Product.dc.html',
    label: 'PDP main image holder -> per-image colour',
    from:
      `';background-color:${DEFAULT_HOLDER};background-image:url(' + img[0] + ');background-size:' + img[2] +`,
    to:
      `';background-color:' + (img[3] || '${DEFAULT_HOLDER}') + ';background-image:url(' + img[0] + ');background-size:' + img[2] +`,
    count: 1
  },
  {
    file: 'Product.dc.html',
    label: 'PDP thumbnail holders -> per-image colour',
    from:
      `style: 'width:100%;aspect-ratio:1;padding:0;background-color:${DEFAULT_HOLDER};background-image:url(' + im[0] +`,
    to:
      `style: 'width:100%;aspect-ratio:1;padding:0;background-color:' + (im[3] || '${DEFAULT_HOLDER}') + ';background-image:url(' + im[0] +`,
    count: 1
  }
];

module.exports = { RULES, DEFAULT_HOLDER };
