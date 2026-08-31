/* Mask -> Calmlyte Studio Panel product swap.
 *
 * Applied at build time by tools/build-site.js, in the same pattern as the logo
 * retarget and the breadcrumb reroute, because the approved artboards must not
 * be edited. The Mask's card markup, PDP data, and cart metadata all live inside
 * Shop.dc.html, Product.dc.html and Cart.dc.html, so the swap is expressed here
 * as exact string substitutions against those files.
 *
 * Every rule declares how many times it must match. tools/build-site.js fails
 * the build on any mismatch — a silent no-match would ship the Mask, which is
 * the one outcome this file exists to prevent.
 *
 * Sources: brief "Replace Mask with Calmlyte Studio Panel", with two points
 * resolved by Jake on 2026-08-31: public price $6,000 (the brief stated both
 * $5,000 and $6,000), and card eyebrow "Studio · anytime" to match the existing
 * card rhythm rather than "ROOM SCALE · STUDIO".
 */

'use strict';

const PRICE_DISPLAY = '$6,000';
const PRICE_NUMBER = 6000;
const SKU = 'studio-panel';
const CARD_NAME = 'Studio Panel';
const FULL_NAME = 'Calmlyte Studio Panel';

/* The Model spec row publishes this, not the supplier designation. Jake's
   decision, 2026-08-31: the OEM model stays internal. Two reasons it matters —
   the supplier code is searchable straight back to the OEM listing, and its
   suffix advertises a wavelength count that public copy deliberately does not
   claim. Keep the OEM string out of this file entirely: anything written inside
   PDP_ENTRY below is injected into the built page and served to visitors. */
const PUBLIC_MODEL = FULL_NAME;

/* Holder colour per image — the fourth element of each `images` entry. Sampled
   from each render's own corner pixel, so the holder meets the photograph's
   backdrop instead of cutting against it. The supplied renders do not share a
   backdrop, which is why a single value cannot work. Jake, 2026-08-31.

   The hero is background-size:cover, so its holder never shows; #FFFFFF is
   recorded for completeness and in case the fit ever changes. */
const HOLDER_HERO = '#FFFFFF';   // room scene, fills its box
const HOLDER_SIDE = '#DBDBDB';   // studio shot, light grey backdrop
const HOLDER_REAR = '#FEFEFE';   // studio shot, near-white backdrop
const HOLDER_FRONT = '#E0E0E0';  // studio shot, light grey backdrop

/* Alt text, written after viewing each supplied render so it describes what is
   actually in frame. Three of the four show the panel unlit on a studio
   background; only the hero is lit and in a room setting. */
const ALT_HERO = 'Calmlyte Studio Panel standing on its floor stand in a room with a window and two potted plants, its full-height green LED array lit and casting green light across the wood floor';
/* The card derivative is a tighter reframe of the hero, so its alt describes the
   closer view rather than repeating the full-room wording. */
const ALT_CARD = 'Calmlyte Studio Panel standing on its floor stand against a deep green wall between two potted plants, its full-height green LED array lit';
const ALT_SIDE = 'Calmlyte Studio Panel at an angle on its floor stand, unlit, showing the two control dials on its side edge';
const ALT_REAR = 'Calmlyte Studio Panel from behind on its floor stand, showing the cooling fan array across the rear housing';
const ALT_FRONT = 'Calmlyte Studio Panel face-on on its floor stand, unlit, showing the full LED lens array';

/* The PDP entry, replacing PRODUCTS.mask. Specs are exactly as supplied; the
   three unconfirmed rows keep [FACTS:] markers per the brief. */
const PDP_ENTRY = `  '${SKU}': {
    sku: '${SKU}', name: '${CARD_NAME}', title: '${FULL_NAME}', price: '${PRICE_DISPLAY}', priceN: ${PRICE_NUMBER},
    eyebrow: 'Room-scale green light',
    lede: 'A large-format green light panel designed for bigger rooms, wellness spaces, and full-room Calmlyte routines. The Studio Panel uses the same narrow-band Calmlyte spectrum architecture as the desktop panel, built around a 520–530 nm green core with cyan-green and amber support.',
    images: [
      ['assets/studio-panel-hero.webp', '${ALT_HERO}', 'cover', '${HOLDER_HERO}'],
      ['assets/studio-panel-side.webp', '${ALT_SIDE}', 'contain', '${HOLDER_SIDE}'],
      ['assets/studio-panel-rear.webp', '${ALT_REAR}', 'contain', '${HOLDER_REAR}'],
      ['assets/studio-panel-front.webp', '${ALT_FRONT}', 'contain', '${HOLDER_FRONT}']
    ],
    specs: [
      ['Model', '${PUBLIC_MODEL}'],
      ['Light spectrum', '520–530 nm green core, with 490–500 nm cyan-green and 590 nm amber support'],
      ['Irradiance', '≥2160 W/m² @ 3 inch'],
      ['LED type', '5W Dual Chip'],
      ['LED quantity', '1152 pcs dual chips'],
      ['Dimensions', '74.49″ × 22.83″ × 2.56″'],
      ['Power consumption', '5760W'],
      ['Control', '[FACTS: confirm control method]'],
      ['In the box', '[FACTS: confirm Studio Panel box contents]'],
      ['Suggested use', '[FACTS: confirm suggested use for Studio Panel]'],
      ['Warranty', '1-year limited warranty']
    ],
    safety: SAFETY_STD
  },`;

/* Each rule: { file, from, to, count }. `count` is asserted by the build. */
const RULES = [
  /* ---------------- Shop.dc.html : product card ---------------- */
  /* Shop card image — a dedicated card derivative, not the PDP hero.
   *
   * The hero render frames the panel full-height in a square, so the panel is
   * only 24% of the frame width and reads as a vertical strip at card size. No
   * CSS fixes that: in the 201x214 card box `cover` discards ~6% of the width,
   * which is the whole repositioning budget, and the panel already runs 94% of
   * the frame height so any zoom cuts its top or base.
   *
   * studio-panel-card.webp is a reframe of the same original render — an 845x900
   * crop at (131,0) of large panel.png — that brings the panel to 36% of the
   * frame width while keeping its top and the room context (wall shadows, plant,
   * console). Its aspect ratio (0.939) matches the widest card box, so no
   * viewport crops it vertically and the panel top is never lost; narrower
   * mobile boxes trim only side context, and the panel sits at 32–68% of the
   * width so it stays clear of those edges.
   *
   * Card only. The PDP gallery still uses studio-panel-hero.webp. */
  {
    file: 'Shop.dc.html',
    label: 'shop card image + alt (dedicated card derivative)',
    from: `<img src="assets/mask-hero.webp" alt="Calmlyte Mask on a wood console against a deep green wall, green LEDs lit"`,
    to: `<img src="assets/studio-panel-card.webp" alt="${ALT_CARD}"`,
    count: 1
  },
  {
    file: 'Shop.dc.html',
    label: 'shop card eyebrow',
    from: `<p style="{{ tagStyle }}">Personal · evening</p>`,
    to: `<p style="{{ tagStyle }}">Studio · anytime</p>`,
    count: 1
  },
  {
    file: 'Shop.dc.html',
    label: 'shop card name',
    from: `>Mask</a></h2>`,
    to: `>${CARD_NAME}</a></h2>`,
    count: 1
  },
  {
    file: 'Shop.dc.html',
    label: 'shop card price',
    from: `>$400</span>`,
    to: `>${PRICE_DISPLAY}</span>`,
    count: 1
  },
  {
    file: 'Shop.dc.html',
    label: 'shop ITEMS entry',
    from: `{ sku: 'mask', name: 'Mask', price: 400 },`,
    to: `{ sku: '${SKU}', name: '${CARD_NAME}', price: ${PRICE_NUMBER} },`,
    count: 1
  },

  /* ---------------- Cart.dc.html : also-in-the-range card ---------------- */
  {
    file: 'Cart.dc.html',
    label: 'cart range card aria-label',
    from: `aria-label="Calmlyte Mask">`,
    to: `aria-label="${FULL_NAME}">`,
    count: 1
  },
  {
    file: 'Cart.dc.html',
    label: 'cart range card image + alt',
    from: `<img src="assets/mask-hero.webp" alt="Calmlyte Mask"`,
    to: `<img src="assets/studio-panel-hero.webp" alt="${FULL_NAME}"`,
    count: 1
  },
  {
    file: 'Cart.dc.html',
    label: 'cart range card name',
    from: `>Mask</a>`,
    to: `>${CARD_NAME}</a>`,
    count: 1
  },
  {
    file: 'Cart.dc.html',
    label: 'cart range card price',
    from: `>$400</span>`,
    to: `>${PRICE_DISPLAY}</span>`,
    count: 1
  },
  {
    file: 'Cart.dc.html',
    label: 'cart add binding',
    from: `{{ add_mask }}`,
    to: `{{ add_studio_panel }}`,
    count: 1
  },
  {
    file: 'Cart.dc.html',
    label: 'cart META entry',
    from: `'mask': { img: 'assets/mask-hero.webp', tag: 'Personal · evening', price: 400, name: 'Mask' },`,
    to: `'${SKU}': { img: 'assets/studio-panel-hero.webp', tag: 'Studio · anytime', price: ${PRICE_NUMBER}, name: '${CARD_NAME}' },`,
    count: 1
  },
  {
    file: 'Cart.dc.html',
    label: 'cart add handler',
    from: `add_mask: () => this.add('mask'),`,
    to: `add_studio_panel: () => this.add('${SKU}'),`,
    count: 1
  },

  /* ---------------- Product.dc.html : PDP data ---------------- */
  {
    file: 'Product.dc.html',
    label: 'PDP ORDER array',
    from: `const ORDER = ['panel', 'handheld', 'mask', 'belt'];`,
    to: `const ORDER = ['panel', 'handheld', '${SKU}', 'belt'];`,
    count: 1
  },
  {
    file: 'Product.dc.html',
    label: 'PDP PRODUCTS entry',
    fromRe: /  mask: \{[\s\S]*?\n  \},\n/,
    to: PDP_ENTRY + '\n',
    count: 1
  },

  /* ---------------- FAQ.dc.html : range descriptions ----------------
   * Three approved answers name the Mask as part of the active range. With the
   * Mask withdrawn they state something untrue, so they fall under the brief's
   * one copy carve-out: "Mask-specific copy must be replaced by Studio Panel
   * copy". Edits are minimal and factual — the product is swapped and, where
   * the sentence divided the range by how the light reaches you, the grouping
   * is corrected. No claim, disclaimer, or safety wording is touched. */
  {
    file: 'FAQ.dc.html',
    label: 'FAQ "What is Calmlyte?" range list',
    from: `a panel for a room, a handheld for close work, a mask for the face, and a belt for the back or waist`,
    to: `a panel for a room, a handheld for close work, a studio panel for larger spaces, and a belt for the back or waist`,
    count: 1
  },
  {
    file: 'FAQ.dc.html',
    label: 'FAQ ambient-vs-contact grouping',
    from: `The panel and handheld are ambient — the light fills the space around you. The mask and belt sit against the body and treat one area directly.`,
    to: `The panels and handheld are ambient — the light fills the space around you. The belt sits against the body and treats one area directly.`,
    count: 1
  },
  {
    file: 'FAQ.dc.html',
    label: 'FAQ "which product" recommendation',
    from: `The Mask for face and wind-down.`,
    to: `The Studio Panel for larger rooms and studio spaces.`,
    count: 1
  }
];

/* Approved assets that no page references once the Mask is withdrawn. Left
   untouched in 'Calmlyte Approved Site/assets/'; simply not copied into the
   build, so the deployed site carries no orphaned Mask imagery. */
const EXCLUDED_ASSETS = [
  'mask-hero.webp',
  'mask-front.webp',
  'mask-rear.webp',
  'mask-side.webp',
  'mask-package.webp'
];

/* Applied after the rules above, to every artboard: any remaining ?sku=mask
   link points at a product that no longer exists. */
const SKU_LINK = { from: 'sku=mask', to: 'sku=' + SKU };

module.exports = {
  RULES, SKU_LINK, EXCLUDED_ASSETS,
  SKU, CARD_NAME, FULL_NAME, PRICE_DISPLAY, PRICE_NUMBER
};
