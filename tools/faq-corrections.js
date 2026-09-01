/* FAQ answers corrected at build time to match how the store actually behaves.
 *
 * These are not editorial rewrites. Each one is an answer that was true when the
 * artboard was drawn and has since been overtaken by a decision made elsewhere —
 * so the FAQ page contradicts the checkout, the policies, or both. The approved
 * artboard is not edited; each correction is an exact-match substitution with an
 * asserted count, so a rule that stops matching fails the build.
 *
 * Related: tools/studio-panel-swap.js already corrects three FAQ answers that
 * named the withdrawn Mask. Those belong with the product swap that caused them.
 * This file is for answers overtaken by a business or configuration decision
 * rather than by a change to the lineup.
 */

'use strict';

const FILE = 'FAQ.dc.html';

/* International shipping.
 *
 * The artboard answered "Yes. Duties and import taxes are the responsibility of
 * the recipient." Since then the business decided US-only, and that decision is
 * enforced and published in three places:
 *
 *   - the live checkout offers exactly one country, United States
 *     (Storefront API localization.availableCountries returns ["US"])
 *   - the published Shopify shipping policy §1 reads "Calmlyte currently ships
 *     within the United States only. At this time, we do not ship internationally."
 *   - the international cost-allocation sections were removed from the shipping,
 *     terms and refund policies
 *
 * Leaving the FAQ saying "Yes" meant a customer outside the US could read that
 * page, believe they could order, and then find no country to select. The
 * replacement wording is the shipping policy's own sentence, so the FAQ and the
 * policy now say the same thing in the same words.
 *
 * Wording supplied by Jake, 2026-09-01. */
const INTERNATIONAL = {
  file: FILE,
  label: 'FAQ: international shipping answer -> US-only',
  from: `    ['Do you ship internationally?', 'Yes. Duties and import taxes are the responsibility of the recipient.'],`,
  to: `    ['Do you ship internationally?', 'Calmlyte currently ships within the United States only. At this time, we do not ship internationally.'],`,
  count: 1
};

const RULES = [INTERNATIONAL];

/* Phrases that must not survive anywhere in the built output while the store is
   US-only. Asserted in tools/verify-build.js. */
const FORBIDDEN = [
  'Duties and import taxes are the responsibility of the recipient',
  'Yes. Duties and import taxes'
];

/* The answer that must be present on the FAQ page instead. */
const US_ONLY_ANSWER =
  'Calmlyte currently ships within the United States only. At this time, we do not ship internationally.';

module.exports = { RULES, FORBIDDEN, US_ONLY_ANSWER };
