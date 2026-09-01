/* Product hero: copy, spectrum pill, and the price/CTA row.
 *
 * Jake's brief, 2026-09-01 (second pass). The hero was too tall: three
 * paragraphs pushed the price and Add to Cart below the fold of the image
 * column, leaving dead space under the thumbnails. The fix is to move the
 * spectrum detail out of the prose and onto the image, so the copy drops to two
 * paragraphs and the CTA rises.
 *
 * Four changes:
 *
 *   1. a "520–530 NM" pill over the hero image
 *   2. two paragraphs of body copy, not three — the spectrum paragraph is gone
 *      and the wavelength is deliberately not repeated in prose
 *   3. price and Add to Cart share one row
 *   4. the title sized to hold one line without losing presence
 *
 * The approved artboard is not edited. Every rule is an exact-match substitution
 * with an asserted count, so a rule that stops matching fails the build.
 *
 * Pill placement
 * --------------
 * Top-right on all four. Checked against each hero image rather than assumed:
 * the first image of every product is a room scene with the product left or
 * centre, and the top-right corner is wall and leaf-shadow in all four. The
 * brief allows top-left as a per-product exception; none is needed. Worth
 * re-checking if a hero render is ever replaced — the crop matters too, since
 * the hero box is 4:3 over a square source, so the visible top edge is already
 * about an eighth of the way down the file.
 *
 * The pill is pointer-events:none so it cannot intercept a click, and it states
 * nothing the spec table below does not already carry.
 *
 * Title
 * -----
 * The previous pass took the floor to 30px to hold one line on a 360px phone.
 * The brief asks for no more shrinking than needed, so the floor comes back up
 * to 32px, which is the largest value that still fits: "Calmlyte Studio Panel"
 * needs 9.52px of width per 1px of font, so 32px needs 305px against the ~312px
 * column of a 360px screen. 34px would need 324px and wrap there.
 */

'use strict';

const FILE = 'Product.dc.html';

/* ------------------------------------------------------------------ *
 * 1. Copy
 * ------------------------------------------------------------------ */

const CLAIM =
  'Early research suggests green light may support sleep, chronic pain management, ' +
  'migraine intensity reduction, and the appearance of surface-level skin tone.';

/* oldLede is matched exactly against the artboard, except the Studio Panel's,
   which tools/studio-panel-swap.js injects before these rules run. */
const COPY = {
  'small-panel': {
    oldLede: 'A compact green-forward LED panel built around a narrow-band 520–530 nm green spectrum, with optional cyan-green and amber support. Designed for desks, side tables, nightstands, wellness rooms, and quiet spaces.',
    lede: 'A compact green-light panel for daily wellness routines at your desk, bedside, or throughout the day.'
  },
  'handheld': {
    oldLede: 'A portable green-light reset built around a narrow-band 520–530 nm green spectrum. Designed for short daytime sessions at your desk, in your office, or on the go.',
    lede: 'A portable green-light device for daily wellness routines at home, at your desk, or on the go.'
  },
  'studio-panel': {
    oldLede: 'A large-format green light panel designed for bigger rooms, wellness spaces, and full-room Calmlyte routines. The Studio Panel uses the same narrow-band Calmlyte spectrum architecture as the desktop panel, built around a 520–530 nm green core with cyan-green and amber support.',
    lede: 'A room-scale green-light panel for larger spaces, wellness rooms, studios, and full-room routines.'
  },
  'belt': {
    oldLede: 'A wearable green-light wrap built around a narrow-band 520–530 nm green spectrum. Designed to be worn quietly during decompression, for a calmer, lower-stimulation moment.',
    lede: 'A wearable green-light device for quiet daily routines at home.'
  }
};

/* Both paragraphs share one style: the claim is product body copy, not a
   disclaimer, and must not read as smaller or quieter than the sentence above
   it. Only the space beneath differs. */
const BODY = 'font-size:17px;color:#EDE8DC;font-weight:300;line-height:1.65';

const LEDE_P_OLD =
  `      <p style="font-size:17px;color:#EDE8DC;font-weight:300;line-height:1.65;margin-bottom:30px">{{ lede }}</p>`;

const LEDE_P_NEW =
  `      <p style="${BODY};margin-bottom:18px;text-wrap:pretty">{{ lede }}</p>\n` +
  `      <p style="${BODY};margin-bottom:28px;text-wrap:pretty">${CLAIM}</p>`;

/* ------------------------------------------------------------------ *
 * 2. Spectrum pill
 * ------------------------------------------------------------------ */

const PILL_TEXT = '520–530 NM';

/* Forest-green glass: the site's own background colour at 62%, blurred, with a
   thin gold border at low opacity. Quiet enough to sit on a photograph without
   reading as a promotional badge, and legible on all four heroes, which are
   dark in that corner. backdrop-filter degrades to a plain translucent panel
   where unsupported, which is still readable. */
const PILL = `<div style="position:absolute;top:14px;right:14px;padding:6px 12px;border-radius:999px;` +
  `background:rgba(15,23,18,.62);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);` +
  `border:1px solid rgba(217,179,104,.38);color:#EDE8DC;font-size:10px;font-weight:400;` +
  `letter-spacing:1.6px;white-space:nowrap;pointer-events:none">${PILL_TEXT}</div>`;

const FIGURE_OLD =
  `      <figure style="background:#16211B;border:1px solid rgba(198,207,196,.14);border-radius:16px;overflow:hidden">\n` +
  `        <div role="img" aria-label="{{ mainAlt }}" style="{{ mainStyle }}"></div>\n` +
  `      </figure>`;

const FIGURE_NEW =
  `      <figure style="position:relative;background:#16211B;border:1px solid rgba(198,207,196,.14);border-radius:16px;overflow:hidden">\n` +
  `        <div role="img" aria-label="{{ mainAlt }}" style="{{ mainStyle }}"></div>\n` +
  `        ${PILL}\n` +
  `      </figure>`;

/* ------------------------------------------------------------------ *
 * 3. Price and CTA on one row
 * ------------------------------------------------------------------ */

const PRICE_P_OLD =
  `      <p style="font-family:'Spectral',Georgia,serif;font-weight:300;font-size:clamp(30px,3.4vw,38px);color:#E7CE9B;margin-bottom:24px">{{ price }}</p>`;

const BUTTON =
  `      <button onClick="{{ addToCart }}" style="background:#D9B368;color:#0F1712;border:none;border-radius:10px;padding:17px 32px;font-family:inherit;font-weight:500;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer" style-hover="background:#E7CE9B">Add to cart</button>`;

/* flex-wrap is the mobile fallback the brief asks for: where the two do not fit
   on one line the button drops beneath the price rather than being squeezed, and
   it still sits far higher than it did with three paragraphs above it. */
const CTA_ROW =
  `      <div style="display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap">\n` +
  `        <p style="font-family:'Spectral',Georgia,serif;font-weight:300;font-size:clamp(30px,3.4vw,38px);color:#E7CE9B;margin:0">{{ price }}</p>\n` +
  `      ${BUTTON.trimStart()}\n` +
  `      </div>`;

/* ------------------------------------------------------------------ *
 * 4. Title
 * ------------------------------------------------------------------ */

const H1_OLD = `font-size:clamp(34px,4.6vw,52px)`;
const H1_NEW = `font-size:clamp(32px,3.2vw,46px)`;

const RULES = [
  {
    file: FILE,
    label: 'hero: two body paragraphs, spectrum prose removed',
    from: LEDE_P_OLD,
    to: LEDE_P_NEW,
    count: 1
  },
  {
    file: FILE,
    label: 'hero: 520–530 NM pill over the main image',
    from: FIGURE_OLD,
    to: FIGURE_NEW,
    count: 1
  },
  {
    file: FILE,
    label: 'hero: price and Add to cart share a row',
    from: PRICE_P_OLD + '\n' + BUTTON,
    to: CTA_ROW,
    count: 1
  },
  {
    file: FILE,
    label: 'hero: title sized to hold one line at desktop',
    from: H1_OLD,
    to: H1_NEW,
    count: 1
  }
].concat(
  Object.keys(COPY).map(sku => ({
    file: FILE,
    label: `${sku}: hero copy`,
    from: `    lede: '${COPY[sku].oldLede}',`,
    to: `    lede: '${COPY[sku].lede}',`,
    count: 1
  }))
);

module.exports = { RULES, COPY, CLAIM, BODY, PILL_TEXT };
