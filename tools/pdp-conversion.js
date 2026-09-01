/* Product page conversion changes, applied at build time.
 *
 * Two changes, per Jake 2026-09-01:
 *
 *   1. A green-light paragraph in the hero, between the product description and
 *      the price, so the mechanism is stated before the ask.
 *
 *   2. The Specifications module stops linking out to the FAQ page. The relevant
 *      questions are answered on the product page instead, below the specs, so
 *      an objection is handled without navigating away from the buy button.
 *
 * The approved artboards are not edited. Every rule below is an exact-match
 * substitution with an asserted count, so a rule that stops matching fails the
 * build rather than silently doing nothing.
 *
 * On the FAQ copy
 * ---------------
 * No new question or answer text is written here. Every pair is lifted verbatim
 * from the approved GROUPS array in FAQ.dc.html. That artboard is no longer built
 * — the FAQ page was retired once these modules replaced it, see
 * tools/faq-retire.js — so it now serves purely as the approved source of this
 * copy rather than as a page anyone reads.
 *
 * Which pairs appear is a per-product decision, because not every approved answer
 * is true of every active product, and one is no longer true of the store at all.
 *
 * Excluded from every product page:
 *
 *   "Do you ship internationally?"  answers "Yes. Duties and import taxes are the
 *                                   responsibility of the recipient." Checkout offers
 *                                   only the United States and the published shipping
 *                                   policy says so explicitly. It was a live defect
 *                                   on faq.html; that page has since been corrected
 *                                   and then retired altogether.
 *   "What is Calmlyte?"             brand-level; the hero above already says it.
 *   "Which product should I start   a cross-sell. On a product page the visitor has
 *    with?"                         already chosen, and "the rest of the range" module
 *                                   below already offers the alternatives.
 *   "What comes in the box?"        true of the Panel, Handheld and Belt, false of the
 *                                   5760W Studio Panel, and already in the spec table
 *                                   for the three where it holds.
 *   "How long is a session?"        already answered in each spec table as "Suggested
 *    "Can I control brightness      session", and "Control" — repeating them below the
 *    and timing?"                   table adds length without adding information. Also
 *                                   neither is established for the Studio Panel, whose
 *                                   session length and control method were never
 *                                   supplied and whose spec rows are withheld for that
 *                                   reason.
 *
 * Note on the Mask: three answers named it in the artboard, and all three are already
 * rewritten for the current lineup by tools/studio-panel-swap.js before this module
 * runs. The built FAQ says "a studio panel for larger spaces" and drops the mask from
 * the ambient-versus-contact grouping, so those answers are safe to reuse here. This
 * was checked against the built output, not the artboard.
 *
 * The per-SKU structure below is kept even though all four lists currently coincide:
 * the Studio Panel differs in what can be said about it, so the moment a
 * product-specific question is wanted the shape is already right.
 */

'use strict';

const FILE = 'Product.dc.html';

/* Hero copy — including the claim paragraph that used to live here — moved to
   tools/pdp-hero-copy.js when Jake rewrote it, so all four products' hero text
   sits in one place rather than being split across two modules. */

/* ------------------------------------------------------------------ *
 * 1. The outbound FAQ link
 * ------------------------------------------------------------------ */

/* Removed, not disabled — a visible link that does nothing is worse than no
   link. The safety sentence it sat beside is untouched. */
const MORE_QUESTIONS = ` <a href="FAQ.dc.html" style="white-space:nowrap">More questions →</a>`;

/* ------------------------------------------------------------------ *
 * 2. The questions module
 * ------------------------------------------------------------------ */

/* Anchor: the opening tag of the section that follows Specifications. Unique in
   the artboard. */
const NEXT_SECTION =
  `  <section style="border-top:1px solid rgba(198,207,196,.14);padding-top:clamp(36px,3.5vw,56px)">`;

/* Answers are shown open rather than as accordions. The point is to answer an
   objection where the reader already is; a click to reveal is a smaller version
   of the same problem as a click to leave.
 *
 * Box styling matches the Specifications module exactly — same background,
 * border, radius and padding — so the two read as one stack. */
const FAQ_SECTION = `  <section>
    <h2 style="font-family:'Spectral',Georgia,serif;font-weight:300;font-size:clamp(22px,2.6vw,28px);color:#EDE8DC;margin-bottom:20px">Questions</h2>
    <div style="background:#141F19;border:1px solid rgba(198,207,196,.14);border-radius:14px;padding:clamp(22px,3vw,40px)">
      <sc-for list="{{ faqs }}" as="qa" hint-placeholder-count="6">
        <div style="padding:15px 0;border-bottom:1px solid rgba(198,207,196,.14)">
          <p style="font-size:14px;color:#EDE8DC;font-weight:400;line-height:1.5;margin-bottom:9px">{{ qa.q }}</p>
          <p style="font-size:13.5px;color:#C6CFC4;font-weight:300;line-height:1.7;text-wrap:pretty">{{ qa.a }}</p>
        </div>
      </sc-for>
    </div>
  </section>

`;

/* Verbatim from the approved GROUPS array in FAQ.dc.html. Keys are the question
   text so a change on the FAQ page is caught by the parity check in
   tools/verify-build.js rather than drifting unnoticed. */
const A = {
  device: ['Is Calmlyte a medical device?', 'No. Calmlyte is a general wellness product. It is not intended to diagnose, treat, cure, or prevent any condition. Follow the user manual and stop using it if you feel discomfort.'],
  vsRed: ['How is this different from red light therapy?', 'Wavelength. Red and near-infrared devices work at roughly 630 to 850 nm and are studied mainly for tissue and skin outcomes. Calmlyte works at 520 to 530 nm, where the research points instead toward pain, migraine, and sleep.'],
  spectrum: ['What spectrum does Calmlyte use?', 'A narrow band of visible green light, around 520 to 530 nm. Green sits in the middle of the visible spectrum, between blue and yellow, giving it a softer visual profile than blue light and a cooler tone than amber or red.'],
  ambient: ['Do I look at the light, or does it shine on me?', 'Both, depending on the product. The panels and handheld are ambient — the light fills the space around you. The belt sits against the body and treats one area directly.'],
  eyes: ['Is it safe for my eyes?', 'Do not stare directly into the LEDs at close range. If you have photosensitivity, an eye condition, light-triggered migraine or epilepsy, or take photosensitising medication, speak to a qualified healthcare professional before use.'],
  returns: ['What is your return policy?', 'Thirty days from delivery. Return the product unused and in its original packaging for a full refund, less return shipping.'],
  warranty: ['What is the warranty?', 'One year limited, covering manufacturing defects from the date of delivery.']
};

/* Objection order: what it is, how it differs, is it safe, is it medical, how do
   I use it, what if I change my mind, what if it breaks. */
const COMMON = ['spectrum', 'vsRed', 'ambient', 'eyes', 'device'];
const COMMERCE = ['returns', 'warranty'];

/* All four currently carry the same seven. Every statement in them is true of
   every active product, and none repeats a row from the spec table above. */
const PER_SKU = {
  'small-panel':  COMMON.concat(COMMERCE),
  'handheld':     COMMON.concat(COMMERCE),
  'belt':         COMMON.concat(COMMERCE),
  'studio-panel': COMMON.concat(COMMERCE)
};

/* The first line of each product's entry — unique per product, and stable. The
   Studio Panel's line is injected by tools/studio-panel-swap.js, so these rules
   must run after that swap; build-site.js orders them last for that reason. */
const ENTRY_LINE = {
  'small-panel': `    sku: 'small-panel', name: 'Panel', title: 'Calmlyte Panel', price: '$600', priceN: 600,`,
  'handheld': `    sku: 'handheld', name: 'Handheld', title: 'Calmlyte Handheld', price: '$450', priceN: 450,`,
  'belt': `    sku: 'belt', name: 'Belt', title: 'Calmlyte Belt', price: '$200', priceN: 200,`,
  'studio-panel': `    sku: 'studio-panel', name: 'Studio Panel', title: 'Calmlyte Studio Panel', price: '$6,000', priceN: 6000,`
};

const esc = s => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

function faqLiteral(sku) {
  const rows = PER_SKU[sku].map(k => `      ['${esc(A[k][0])}', '${esc(A[k][1])}']`);
  return `    faqs: [\n${rows.join(',\n')}\n    ],`;
}

const RULES = [
  {
    file: FILE,
    label: 'specs: remove the outbound "More questions" link',
    from: MORE_QUESTIONS,
    to: '',
    count: 1
  },
  {
    file: FILE,
    label: 'questions module below Specifications',
    from: NEXT_SECTION,
    to: FAQ_SECTION + NEXT_SECTION,
    count: 1
  },
  {
    file: FILE,
    label: 'renderVals: expose faqs',
    from: `      specs: p.specs.map(r => ({ k: r[0], v: r[1] })),`,
    to: `      specs: p.specs.map(r => ({ k: r[0], v: r[1] })),\n      faqs: (p.faqs || []).map(r => ({ q: r[0], a: r[1] })),`,
    count: 1
  }
].concat(
  Object.keys(ENTRY_LINE).map(sku => ({
    file: FILE,
    label: `${sku}: ${PER_SKU[sku].length} question(s)`,
    from: ENTRY_LINE[sku],
    to: ENTRY_LINE[sku] + '\n' + faqLiteral(sku),
    count: 1
  }))
);

module.exports = { RULES, A, PER_SKU, MORE_QUESTIONS };
