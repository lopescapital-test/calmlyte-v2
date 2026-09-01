/* Product hero copy, rewritten at build time.
 *
 * Jake's copy, 2026-09-01, used verbatim. Each product hero becomes three
 * paragraphs of equal weight under the title:
 *
 *   1. what the product is, in one short product-specific sentence
 *   2. "Built around Calmlyte's narrow-band 520–530 nm green spectrum, ..."
 *   3. the claim paragraph, identical across all four products
 *
 * The approved artboard is not edited. Every rule is an exact-match substitution
 * with an asserted count, so a rule that stops matching fails the build.
 *
 * On the claim paragraph's size
 * -----------------------------
 * An earlier pass set it at 14.5px, deliberately subordinate to the 17px lede.
 * Jake's instruction reverses that: the claim paragraph must not be smaller than
 * the main body copy, and must match its size and weight on all four pages. So
 * all three paragraphs now carry the lede's own style — 17px, weight 300, the
 * same colour — and the only difference between them is the space beneath.
 *
 * On the title
 * ------------
 * "Keep product names on one line at desktop where possible", Calmlyte Handheld
 * and Calmlyte Studio Panel especially.
 *
 * Measured at 1440: the hero text column is 448px, and "Calmlyte Studio Panel"
 * needs 489px at the artboard's 52px maximum, so it wrapped to two lines.
 * "Calmlyte Handheld" needed 430px and already fitted.
 *
 * The fix is not simply a smaller maximum. The column is a fixed fraction of the
 * viewport (~31vw), so a fixed pixel cap only holds at one width; below it the
 * column shrinks faster than a capped font does and the title wraps again. The
 * font has to track the column, which means a vw-based value.
 *
 * At 1440, one line needs about 9.4px of width per 1px of font size, and the
 * column is 0.311 × vw. "Calmlyte Studio Panel" needs 9.52px of width per 1px of
 * font, so the largest size that holds is 0.311 / 9.52 = 3.27vw. A first attempt
 * at 3.3vw looked right and was not: measured across widths it still wrapped at
 * 1280, 1150 and 1030, by three or four pixels each time. 3.2vw clears it with a
 * small margin at every width.
 *
 * The floor moved too, 34px to 30px, for the same reason at the other end. At
 * 34px the title needs 324px, which fits the 327px column of a 375px phone by
 * three pixels and does not fit the 312px column of a 360px one — so the widest
 * title wrapped on smaller Android screens. At 30px it needs 286px and holds a
 * single line on both, and from about 920px upward on desktop; below 900px the
 * artboard collapses the hero to one full-width column anyway.
 */

'use strict';

const FILE = 'Product.dc.html';

/* Note the apostrophe in "Calmlyte's" is U+2019 throughout, as supplied and as
   the rest of the site sets it — so none of this needs escaping inside the
   single-quoted JS string literals these values are written into. */
const CLAIM =
  'Early research suggests green light may support sleep, chronic pain management, ' +
  'migraine intensity reduction, and the appearance of surface-level skin tone.';

/* oldLede is matched exactly. Three come from the artboard; the Studio Panel's
   comes from tools/studio-panel-swap.js, which runs before these rules. */
const COPY = {
  'small-panel': {
    oldLede: 'A compact green-forward LED panel built around a narrow-band 520–530 nm green spectrum, with optional cyan-green and amber support. Designed for desks, side tables, nightstands, wellness rooms, and quiet spaces.',
    lede: 'A compact green-light panel for daily wellness routines at your desk, bedside, or in a quiet room.',
    spectrum: 'Built around Calmlyte’s narrow-band 520–530 nm green spectrum, the Panel brings green light into a simple desktop format with optional cyan-green and amber support.'
  },
  'handheld': {
    oldLede: 'A portable green-light reset built around a narrow-band 520–530 nm green spectrum. Designed for short daytime sessions at your desk, in your office, or on the go.',
    lede: 'A portable green-light device for daily wellness routines at home, at your desk, or on the go.',
    spectrum: 'Built around Calmlyte’s narrow-band 520–530 nm green spectrum, the Handheld is designed for short, focused sessions when you want the benefits of green light in a smaller, portable format.'
  },
  'studio-panel': {
    oldLede: 'A large-format green light panel designed for bigger rooms, wellness spaces, and full-room Calmlyte routines. The Studio Panel uses the same narrow-band Calmlyte spectrum architecture as the desktop panel, built around a 520–530 nm green core with cyan-green and amber support.',
    lede: 'A room-scale green-light panel for larger spaces, wellness rooms, studios, and full-room routines.',
    spectrum: 'Built around Calmlyte’s narrow-band 520–530 nm green spectrum, the Studio Panel brings green light into a larger format with cyan-green and amber support.'
  },
  'belt': {
    oldLede: 'A wearable green-light wrap built around a narrow-band 520–530 nm green spectrum. Designed to be worn quietly during decompression, for a calmer, lower-stimulation moment.',
    lede: 'A wearable green-light device for quiet daily routines at home.',
    spectrum: 'Built around Calmlyte’s narrow-band 520–530 nm green spectrum, the Belt brings green light into a wearable format for more personal use.'
  }
};

/* ------------------------------------------------------------------ *
 * Markup
 * ------------------------------------------------------------------ */

/* The artboard's lede paragraph. Its 30px bottom margin was the only gap in the
   hero; with three paragraphs it becomes the gap between them, so the first two
   tighten to 18px and the last keeps 30px before the price. */
const LEDE_P_OLD =
  `      <p style="font-size:17px;color:#EDE8DC;font-weight:300;line-height:1.65;margin-bottom:30px">{{ lede }}</p>`;

const BODY = 'font-size:17px;color:#EDE8DC;font-weight:300;line-height:1.65';

const LEDE_P_NEW =
  `      <p style="${BODY};margin-bottom:18px;text-wrap:pretty">{{ lede }}</p>\n` +
  `      <p style="${BODY};margin-bottom:18px;text-wrap:pretty">{{ spectrum }}</p>\n` +
  `      <p style="${BODY};margin-bottom:30px;text-wrap:pretty">${CLAIM}</p>`;

const H1_OLD = `font-size:clamp(34px,4.6vw,52px)`;
const H1_NEW = `font-size:clamp(30px,3.2vw,46px)`;

const RULES = [
  {
    file: FILE,
    label: 'hero: three equal-weight paragraphs under the title',
    from: LEDE_P_OLD,
    to: LEDE_P_NEW,
    count: 1
  },
  {
    file: FILE,
    label: 'hero: title sized to hold one line at desktop',
    from: H1_OLD,
    to: H1_NEW,
    count: 1
  },
  {
    file: FILE,
    label: 'renderVals: expose spectrum',
    from: `      lede: p.lede,`,
    to: `      lede: p.lede,\n      spectrum: p.spectrum,`,
    count: 1
  }
].concat(
  Object.keys(COPY).map(sku => ({
    file: FILE,
    label: `${sku}: hero copy`,
    from: `    lede: '${COPY[sku].oldLede}',`,
    to: `    lede: '${COPY[sku].lede}',\n    spectrum: '${COPY[sku].spectrum}',`,
    count: 1
  }))
);

module.exports = { RULES, COPY, CLAIM, BODY };
