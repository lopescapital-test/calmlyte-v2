/* The Shop card's View product button no longer overflows the card.
 *
 * Jake, 2026-09-02: the button "appears clipped/truncated" at some desktop
 * widths. Measured before touching anything, and the diagnosis is not the one
 * the symptom suggests.
 *
 * What was actually happening
 * --------------------------
 * The button never clipped its own text — its scrollWidth matched its width at
 * every width tested. The price/button row overflowed the card's content
 * column, and the <article> has overflow:hidden, so the card cut the button's
 * right-hand edge off. On screen that reads as "VIEW PRODUC".
 *
 * The row could not shrink to fit because the button is white-space:nowrap: a
 * flex item's default min-width:auto floors it at min-content, so it held its
 * full 135px and pushed past the edge instead of compressing.
 *
 * Overflow past the content edge, measured at 10px font with 1.5px tracking:
 *
 *     width   Handheld / Panel / Belt    Studio Panel
 *     1024          +43px                   +55px
 *     1100          +29px                   +41px
 *     1280           +7px                   +19px
 *     1366            ok                    +11px
 *     1440            ok                     +2px
 *     1600            ok                      ok
 *
 * Studio Panel is always worst because "$6,000" is the widest price, so it eats
 * 14px more of the row than "$450" does. Any fix judged on the Handheld alone
 * would have looked complete at 1366 and still been broken.
 *
 * The fix, in the four places the brief allows
 * -------------------------------------------
 *   1. the image column narrows from 46% to 40%, widening the content area
 *   2. the content padding tightens slightly
 *   3. the button loses 4px of horizontal padding either side and 0.35px of
 *      tracking — the smallest change that reads identically at a glance
 *   4. the row may wrap
 *
 * Why wrap rather than another breakpoint
 * ---------------------------------------
 * 1-3 buy back enough width for every desktop size, but a 1024px window with
 * the widest price is still tight, and any fixed breakpoint is a guess about
 * font metrics that will be wrong on some machine. flex-wrap:wrap needs no
 * breakpoint: while the row fits, nothing moves; when it cannot, the button
 * drops below the price instead of being cut. It is also the pattern the
 * product page's own price/CTA row already uses, so the behaviour is not new to
 * the site.
 *
 * flex:none on the button states what was already true — it never shrinks — so
 * that a future change to white-space cannot silently turn "does not fit" back
 * into "cut in half".
 *
 * The label, the routes, the card layout, the images, the prices and the order
 * are untouched. Every rule here is an exact-match substitution with an
 * asserted count of 4, one per card, so a rule that stops matching fails the
 * build rather than fixing three cards and leaving the fourth clipped.
 */

'use strict';

const FILE = 'Shop.dc.html';
const CARDS = 4;

/* ------------------------------------------------------------------ *
 * 1. Image column: 46% -> 40%
 * ------------------------------------------------------------------ */
const IMG_OLD = 'style="display:block;position:relative;flex:none;width:min(46%,100%);min-height:0;background:#16211B"';
const IMG_NEW = 'style="display:block;position:relative;flex:none;width:min(40%,100%);min-height:0;background:#16211B"';

/* ------------------------------------------------------------------ *
 * 2. Content column padding, horizontal only. The vertical value is
 *    untouched so the card's internal rhythm does not move.
 * ------------------------------------------------------------------ */
const PAD_OLD = 'padding:clamp(14px,1.8vh,22px) clamp(14px,1.4vw,20px);display:flex;flex-direction:column;justify-content:center;gap:clamp(10px,1.4vh,16px)';
const PAD_NEW = 'padding:clamp(14px,1.8vh,22px) clamp(12px,1vw,16px);display:flex;flex-direction:column;justify-content:center;gap:clamp(10px,1.4vh,16px)';

/* ------------------------------------------------------------------ *
 * 3. The row may wrap. row-gap is set explicitly so a wrapped button sits
 *    a deliberate distance below the price rather than touching it.
 * ------------------------------------------------------------------ */
const ROW_OLD = 'style="display:flex;align-items:center;justify-content:space-between;gap:10px"';
const ROW_NEW = 'style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:9px 10px"';

/* ------------------------------------------------------------------ *
 * 4. The button: tighter, and explicitly unshrinkable.
 * ------------------------------------------------------------------ */
const BTN_OLD = 'letter-spacing:1.5px;text-transform:uppercase;padding:9px 17px;cursor:pointer;white-space:nowrap';
const BTN_NEW = 'letter-spacing:1.15px;text-transform:uppercase;padding:9px 13px;cursor:pointer;white-space:nowrap;flex:none';

/* ------------------------------------------------------------------ *
 * 5. All four cards wrap at the same width.
 *
 * With 1-4 in place the overflow is gone everywhere, but the four cards stopped
 * agreeing with each other: at 1100 the Studio Panel's row wrapped while the
 * other three stayed inline, because "$6,000" is 12px wider than "$450". Four
 * sibling cards in one grid, one of them laid out differently — not broken, but
 * visibly not intended.
 *
 * A floor on the price box makes the wrap threshold identical for all four, so
 * they break together or not at all. It costs nothing at wide widths:
 * justify-content:space-between already holds the button against the right
 * edge, so a wider price box changes no visible position until the row is
 * actually short of room.
 *
 * In em, not px, so the floor tracks the price's own clamped font size instead
 * of drifting away from it at one end of the range. 3em clears "$6,000" in
 * Spectral at both ends of clamp(16px,1.35vw,19px).
 * ------------------------------------------------------------------ */
const PRICE_OLD = "<span style=\"font-family:'Spectral',Georgia,serif;font-size:clamp(16px,1.35vw,19px);font-weight:300;color:#EDE8DC\">";
const PRICE_NEW = "<span style=\"font-family:'Spectral',Georgia,serif;font-size:clamp(16px,1.35vw,19px);font-weight:300;color:#EDE8DC;min-width:3em\">";

const RULES = [
  { file: FILE, label: 'card image column 46% -> 40%', from: IMG_OLD, to: IMG_NEW, count: CARDS },
  { file: FILE, label: 'card content padding tightened', from: PAD_OLD, to: PAD_NEW, count: CARDS },
  { file: FILE, label: 'price/button row may wrap', from: ROW_OLD, to: ROW_NEW, count: CARDS },
  { file: FILE, label: 'button padding + tracking tightened, never shrinks', from: BTN_OLD, to: BTN_NEW, count: CARDS },
  { file: FILE, label: 'price floor so all four cards wrap together', from: PRICE_OLD, to: PRICE_NEW, count: CARDS }
];

module.exports = {
  RULES, FILE, CARDS,
  IMG_NEW, PAD_NEW, ROW_NEW, BTN_NEW, PRICE_NEW
};
