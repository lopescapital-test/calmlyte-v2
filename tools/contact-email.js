/* The public contact address, in one place.
 *
 * Changed 2026-09-01 from hello@calmlyte.com to hello@mail.calmlyte.com so that
 * customer email lands in GoHighLevel Conversations: mail.calmlyte.com's MX
 * records point at Mailgun, which hands inbound mail to LeadConnector. The root
 * address is a plain GoDaddy mailbox and is invisible to the CRM.
 *
 * The address appears in two kinds of place, so it is defined here and consumed
 * by both rather than written out twice:
 *
 *   - the "Questions?" line in the footer of three approved artboards, changed
 *     by the rules below at build time
 *   - the checkout failure message in tools/checkout-wiring.js, which imports
 *     PUBLIC_EMAIL directly
 *
 * Deliberately not changed
 * ------------------------
 * The inert checkout stub in Cart.dc.html also names the old address:
 *
 *   this.setState({ toast: 'Checkout opens soon — email hello@calmlyte.com' });
 *
 * That string never ships — the whole handler is replaced by the live checkout —
 * but it is also the literal that tools/verify-build.js matches to assert the
 * stub is gone while the commerce gate is open. Rewriting the address inside it
 * would leave that assertion matching nothing, so it would pass whether or not
 * the stub was really replaced. The rules below target the footer line only.
 *
 * FAQ.dc.html names the old address twice as well. That artboard is no longer
 * built, so nothing ships from it; the build's dormant-rule report is where that
 * would surface if the page is ever restored.
 */

'use strict';

const PUBLIC_EMAIL = 'hello@mail.calmlyte.com';
const OLD_EMAIL = 'hello@calmlyte.com';

/* The footer line, byte-identical in all three built artboards that carry it.
   One substitution covers both the mailto href and the visible text, so no
   display alias can be left pointing at the old address. */
const FOOTER_OLD = `<a href="mailto:${OLD_EMAIL}">${OLD_EMAIL}</a>`;
const FOOTER_NEW = `<a href="mailto:${PUBLIC_EMAIL}">${PUBLIC_EMAIL}</a>`;

const PAGES = ['Cart.dc.html', 'Product.dc.html', 'Research.dc.html'];

const RULES = PAGES.map(file => ({
  file,
  label: 'footer: public contact address',
  from: FOOTER_OLD,
  to: FOOTER_NEW,
  count: 1
}));

module.exports = { RULES, PUBLIC_EMAIL, OLD_EMAIL, FOOTER_NEW, PAGES };
