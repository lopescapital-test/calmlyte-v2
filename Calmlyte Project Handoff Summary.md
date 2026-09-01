# Calmlyte Project Handoff Summary

Date: 2026-09-01
Primary repo: lopescapital-test/calmlyte-v2
Live domain: https://www.calmlyte.com
Shopify store: e6hqgs-hu.myshopify.com
Current production branch: main
Current latest deployed commit: c38aaf8
Current status: live on real domain, still staged/pre-launch because noindex is still active and real payments/CRM are not finalized.

> **Corrections applied 2026-09-01.** Two factual errors in the original were corrected
> **in place**, in §1 and §13, rather than only in the addendum — both are the kind that
> bite someone reading a single section in isolation, which is how a reference document
> actually gets read. Every correction and addition is also recorded in full in
> **§20**, so the audit trail survives. Nothing else in the body was changed.

## 1. Core architecture

Calmlyte is now built as:

Vercel frontend:
- Hosts the custom Calmlyte marketing/storefront experience.
- Public domain is https://www.calmlyte.com.
- Vercel builds from GitHub main.
- **Build command: `SHOPIFY_STOREFRONT_TOKEN=<public storefront token> node tools/build-site.js`**
  — **corrected, see §20.1.** The bare `node tools/build-site.js` **fails** now that
  checkout is wired. On Vercel this works because `SHOPIFY_STOREFRONT_TOKEN` is already set
  in environment variables. **Do not remove the env-var requirement.** The build fails
  without the token on purpose, so a dead checkout button is never shipped.
- Output directory: build
- Framework preset: Other
- Install command: blank / none required
- Node: 22.x
- build/ is generated and not committed.

Shopify:
- Used for product records, cart creation, checkout, payment flow, taxes, shipping, orders, and customer records.
- Shopify is not the public marketing storefront.
- Shopify storefront is reachable but noindexed through theme.liquid.
- Shopify password is OFF because password protection breaks checkout.
- Shopify checkout is reachable and working.

GitHub Pages:
- Ignore old GitHub Pages URL.
- GitHub Pages previously showed old root-site files.
- Vercel is now the deployment source of truth.

## 2. Current route structure

Vercel routes:

```
/                       Shinrin Yoku homepage
/shop.html              Shop
/product.html           Product detail page with ?sku=
/cart.html              Cart
/light.html             Spectrum
/studies.html           Studies
/research.html          Research
/faq.html               FAQ
```

The homepage is Shinrin Yoku, not Shop.

Shop is /shop.html.

Logo links to /.

Product breadcrumb:
Calmlyte → /
Shop → /shop.html
Product name → current product page

## 3. Current product lineup

Active products:

1. Calmlyte Handheld
   SKU: handheld
   Shopify handle: calmlyte-handheld
   Price: $450
   Variant GID: gid://shopify/ProductVariant/49423562440859

2. Calmlyte Studio Panel
   SKU: studio-panel
   Shopify handle: calmlyte-studio-panel
   Price: $6,000
   Variant GID: gid://shopify/ProductVariant/49423562768539

3. Calmlyte Panel
   SKU: small-panel
   Shopify handle: calmlyte-panel
   Price: $600
   Variant GID: gid://shopify/ProductVariant/49423562997915

4. Calmlyte Belt
   SKU: belt
   Shopify handle: calmlyte-belt
   Price: $200
   Variant GID: gid://shopify/ProductVariant/49423572598939

Removed product:
- Calmlyte Mask was removed from active product lineup.
- No active Mask product should appear on Shop, PDP, Cart, or checkout.
- Old ?sku=mask falls back safely and should not display the Mask.
  Verified 2026-09-01: `/product.html?sku=mask` renders **Calmlyte Panel at $600**,
  breadcrumb "Calmlyte / Shop / Panel", no occurrence of "mask" in the rendered page,
  Add to Cart functional. It falls back to a real sellable product, not an error state.

Panel Pro:
- Not active.
- Not present in the approved master.
- Do not reintroduce unless specifically instructed.

## 4. Product pricing and cart math

Expected one-each cart:

```
Handheld       $450
Studio Panel   $6,000
Panel          $600
Belt           $200
Total          $7,250
```

This has been repeatedly verified on:
- Vercel cart
- Shopify cartCreate
- Shopify checkout

The build includes price parity assertions across:
- Shop cards
- Product data
- Cart metadata
- Shopify variant mapping

Do not change prices without updating all relevant surfaces and rerunning verification.

## 5. Claims and copy status

All copy and claims have been signed off by legal/medical per Jake.

Do not reopen, question, soften, rewrite, bracket, or flag approved copy/claims as blockers.

Approved claim direction includes green light therapy language and the social-preview language.

Approved social preview phrases:
- "520–530 NM · GREEN LIGHT THERAPY"
- "A calmer kind of light."

Do not re-litigate "green light therapy" or health claim language unless Jake explicitly asks.

Current general claim areas include:
- sleep
- chronic pain
- migraine intensity
- surface-level skin discoloration / skin appearance
- relaxation/internal regulation

## 6. Studio Panel implementation

Studio Panel replaced the Mask.

Public product name:
Calmlyte Studio Panel

Public model/spec row:
Calmlyte Studio Panel

Do not publish:
- RL2000PRO
- 7waves
- PLATINUM
- OEM model details

Known Studio Panel specs shown publicly:
- Model: Calmlyte Studio Panel
- Light spectrum: 520–530 nm green core with 490–500 nm cyan-green and 590 nm amber support
- Irradiance: ≥2160 W/m² @ 3 inch
- LED type: 5W Dual Chip
- LED quantity: 1152 pcs dual chips
- Dimensions: 74.49″ × 22.83″ × 2.56″
- Power consumption: 5760W
- Warranty: 1-year limited warranty

Removed from visible PDP:
- Control method placeholder
- In the box placeholder
- Suggested use placeholder

Never ship visible [FACTS:] or [LEGAL:] markers. The build now fails if those appear in built output.

## 7. Studio Panel imagery

Current Studio Panel images:

`assets/studio-panel/studio-panel-card.webp`
- Used only on Shop card.
- Current widened crop from large panel hero image.
- Natural size: 900 × 958.
- Shows full panel/stand/room context.

`assets/studio-panel/studio-panel-hero.webp`
- Used on Studio Panel PDP hero and cart thumbnail.
- Newer better hero image.
- Full-room scene with panel standing upright.

`assets/studio-panel/studio-panel-side.webp`
`assets/studio-panel/studio-panel-rear.webp`
`assets/studio-panel/studio-panel-front.webp`
- Used as PDP thumbnails/detail images.
- Side/rear/front unchanged after hero update.

PDP image holders use per-image background colors:
hero: #FFFFFF
side: #DBDBDB
rear: #FEFEFE
front: #E0E0E0

Do not replace these unless Jake requests new product renders.

## 8. Shopify checkout status

Checkout is wired and live.

Implementation:
- Lazy cart creation only.
- Existing Calmlyte cart UI preserved.
- No continuous Shopify cart mirroring.
- Checkout click creates Shopify cart using current localStorage cart contents.
- Uses verified ProductVariant GIDs from tools/shopify-variants.json.
- Redirects to Shopify checkoutUrl.
- Empty cart is blocked.
- Stale withdrawn SKU is blocked.
- Duplicate checkout click is blocked.
- Subtotal mismatch blocks redirect.
- Failure leaves cart intact and shows friendly error.

Storefront token:
- Public Storefront API token is injected from Vercel environment variable:
  SHOPIFY_STOREFRONT_TOKEN
- Token is not committed to git.
- Admin tokens are refused by tooling.
- Do not use Admin API tokens.

Shopify checkout has been tested:
- Full cart reaches Shopify checkout.
- Four line items transfer correctly.
- Subtotal $7,250 confirmed.
- Test order completed successfully.
- Shopify order appeared in admin.
- Test order showed "Payment not processed."

Important:
Real payment setup is still a launch gate. See §20.4.
Do not assume real payments are ready.

## 9. Shopify store status

Shopify domain:
e6hqgs-hu.myshopify.com

Correct domain was previously mistyped as e6hggs-hu.myshopify.com. Use e6hqgs-hu.

Products:
- Four products are active.
- Inventory was set to 100 during setup.
- Product images appear in checkout.
- Calmlyte branding/logo appears in checkout/admin areas.

Password protection:
- OFF.
- Required for Shopify checkout to work.
- Do not turn Shopify password back on because it breaks checkout.
  Evidence, measured 2026-08-31 on the same cart: password ON gave
  `/cart/c/<id>` → 302 → 302 → **HTTP 403**; password OFF gave the same chain →
  **HTTP 200**, "Checkout - Calmlyte", $7,250.00.

Shopify storefront exposure:
- Shopify storefront is public/reachable.
- Shopify theme has noindex added in layout/theme.liquid.
- Shopify product pages are noindexed.
- Shopify checkout is unaffected by theme noindex.

Do not edit robots.txt to block Shopify storefront. Noindex needs crawlers to see the page.

Note: `/products.json` on the Shopify domain still returns the full catalogue as JSON
(titles, handles, SKUs, prices). `noindex` does not close it. Only unpublishing products
from the Online Store channel would, and that risks the Storefront API token's access —
test on one product first if it is ever attempted.

## 10. Shipping status

Current business decision:
US-only.

Shopify checkout:
- Country dropdown only shows United States.
- International market moved to draft/inactive.
- International shipping zone removed or not usable.
- Checkout is US-only.

Shipping rates:
- Standard shipping: FREE
- Express shipping: $15
- No transit-time estimates shown.
- No guaranteed delivery dates.

Verified 2026-09-01 via the Storefront API for a US address: Standard `0.0 USD`,
Express `15.0 USD`, both with an empty description field, which is where Shopify puts
transit-time text. `localization.availableCountries` returns exactly one entry, `US`.

Shipping policy:
- US-only.
- No international shipping language.
- No customs/VAT/duties/import-tax/brokerage language.
- No delivery date guarantees.

Important:
Do not reintroduce international shipping until the business explicitly decides to support international, configures Shopify Markets/rates, and updates policies.

## 11. Shopify policies

Policies are now entered in Shopify and look good.

Policy URLs:
- Privacy Policy: https://e6hqgs-hu.myshopify.com/policies/privacy-policy
- Terms of Service: https://e6hqgs-hu.myshopify.com/policies/terms-of-service
- Shipping Policy: https://e6hqgs-hu.myshopify.com/policies/shipping-policy
- Return Policy: https://e6hqgs-hu.myshopify.com/policies/refund-policy

Vercel footer:
- Footer policy links are live on all 8 Calmlyte pages.
- Vercel does not duplicate policy pages.
- Footer links point to Shopify policy pages.
- All policy URLs return 200.

Warranty:
- Shopify has no dedicated Warranty Policy slot.
- Warranty Policy is appended to Return & Refund Policy.
- Terms also includes a shorter warranty section.

Policy formatting:
- Shopify does not parse Markdown reliably.
- If formatting breaks, use HTML or Shopify toolbar formatting.

## 12. Marketing checkbox / Privacy Policy

Jake wants Shopify email marketing checkbox preselected.

Shopify Marketing opt-in:
- Email: Checkout and sign-in
- Preselect checkbox in certain regions: Automated / United States
- SMS: Don't show

Privacy Policy was updated to reflect this behavior.

Key privacy wording:
- Marketing preferences include whether the email marketing checkbox is selected at checkout.
- Marketing messages may be sent where permitted by law, including when the marketing checkbox is selected at checkout.
- Section 5 says the checkbox may be preselected where permitted, and customers can uncheck it at checkout or unsubscribe later.

Do not change this unless Jake changes the marketing strategy.

## 13. Favicon and social preview

Completed and live.

Source folder:
`assets/8.30.26/favicon/`

**This folder is intentionally tracked in git — see §20.2. Do not remove the
`.gitignore` exception `!assets/8.30.26/favicon/`.** The general `assets/*/*/` rule
would otherwise exclude it from a fresh checkout, which is what Vercel builds, and the
build would fail. The large source PNG folders alongside it remain ignored.

Files:
```
favicon.ico
favicon-16x16.png
favicon-32x32.png
apple-touch-icon.png
calmlyte-social-preview.jpg
```

Build output:
```
/favicon.ico
/favicon-16x16.png
/favicon-32x32.png
/apple-touch-icon.png
/assets/calmlyte-social-preview.jpg
```

Social preview image:
- 1200 × 630
- Uses approved wording:
  "520–530 NM · GREEN LIGHT THERAPY"
  "A calmer kind of light."

Open Graph and Twitter tags:
- Present on all 8 pages.
- Per-page og:title, og:description, og:url use page metadata.
- Homepage og:url uses https://www.calmlyte.com/ not /index.html.

Noindex does not suppress social preview cards. That is accepted.

## 14. Mobile status

Mobile is fixed and live.

Important mobile fixes:
- Shop header/nav cleaned up.
- Header height 96px at mobile.
- Logo/mark aligned.
- Nav links have 20px gaps.
- Active underline separated from rainbow rail by 10px.
- Cart pinned and visible on mobile.
- Product cards unchanged.
- No horizontal page scroll.
- Checkout works from mobile.

Do not regress this.

## 15. Policy footer status

Policy footer links are live on all 8 pages.

Footer links:
- Privacy
- Terms
- Shipping
- Returns

The footer is injected through build pipeline, not by editing approved artboards.
All links open to Shopify policy URLs.
All return 200.
Mobile footer displays on one line at 375px.

## 16. Current noindex / launch state

Vercel Calmlyte site:
- noindex,nofollow meta tag on all 8 pages
- X-Robots-Tag: noindex, nofollow from vercel.json

Shopify storefront:
- noindex,nofollow added in theme.liquid
- checkout pages unaffected

Do not remove noindex yet.

Noindex removal is the final launch action after:
- real payments are confirmed
- CRM/email capture is set up
- final checkout test is complete
- final review of public site is complete

## 17. Legal Review folder

There are uncommitted Legal Review draft files and a reconciliation note.

Status:
- Legal Review drafts are historical working drafts.
- Live Shopify policies are currently the operational source of truth.
- Do not commit Legal Review drafts without Jake's approval.
- Do not overwrite live Shopify policy language based on stale drafts.

Known uncommitted / held files:
```
Legal Review/00-REVIEW-MEMO.md
Legal Review/01-privacy-policy.md
Legal Review/02-terms-of-sale.md
Legal Review/03-shipping-policy.md
Legal Review/04-return-refund-policy.md
Legal Review/05-QUESTIONS-TO-ANSWER.md
Legal Review/README.md
Legal Review/06-RECONCILIATION-2026-09-01.md
```

`06-RECONCILIATION-2026-09-01.md` is the one to read first — it maps where the published
Shopify text agrees with the drafts, what it drops that had previously been decided, and
what it adds.

### 17.1 The committed drafts are stale — read this before opening them

The committed `Legal Review/` drafts are stale historical drafts from the earlier
Stripe/GitHub Pages phase. They are not the live policy source of truth. The live
Shopify policy pages are the operational source of truth for Privacy, Terms,
Shipping, Return/Refund, and Warranty language.

Do not update or commit the `Legal Review/` drafts unless Jake explicitly requests a
legal-doc reconciliation pass.

**Why this warning exists, concretely.** There are two different versions of these
files, and the one in git is the older one:

| `Legal Review/01-privacy-policy.md` | Stripe | GitHub Pages | Shopify | Vercel |
|---|---|---|---|---|
| **Committed on `main`** (from `3c15b8c`, 2026-07-02) | 5 | 1 | **0** | **0** |
| Corrected rewrite, held locally and uncommitted | 2 | 2 | 17 | 3 |

So a fresh clone opens a privacy policy describing **Stripe Payment Links on GitHub
Pages**, with the Mask and Panel Pro in the lineup — a stack that no longer exists.
The corrected rewrites and `06-RECONCILIATION-2026-09-01.md` are local-only and are
deliberately not committed.

The practical consequence: if you need to know what Calmlyte has told customers, read
the live Shopify policy pages listed in §11. Do not read these files for that purpose,
and do not port language out of them into Shopify.

## 18. Current outstanding launch items

Still needed before public launch / noindex removal:

**1. Real payment setup**
- Confirm Shopify Payments or chosen payment provider is fully configured.
- Turn off test gateway before accepting real orders.
- Confirm whether payments are live or test.

**2. CRM / email capture setup**
- Decide CRM/email platform.
- Ensure Shopify customers/orders sync to CRM or email platform.
- Ensure marketing opt-ins are captured.
- Configure abandoned checkout if desired.
- Configure welcome/order follow-up flows if desired.
- Confirm internal notification workflow.
- Confirm hello@calmlyte.com is monitored.

**3. Final checkout test**
- Add one of each product.
- Confirm subtotal $7,250.
- Confirm Standard free and Express $15.
- Confirm no delivery dates.
- Confirm checkout works.
- Confirm real/test payment state intentionally.
- Confirm order appears in Shopify.
- Confirm emails look acceptable.

**4. Optional polish**
- 404 page
- Analytics if desired
- Self-host fonts if desired
- Clean or disable stock Shopify theme presentation if desired, although Shopify storefront is noindexed.

**5. Remove noindex**
- Final public launch action.
- Remove both page meta noindex and Vercel X-Robots-Tag noindex.
- Consider sitemap/robots/analytics at same time.

## 19. Important guardrails for future Claude sessions

Do not re-open settled decisions:
- Claims and copy are signed off.
- Studio Panel replaces Mask.
- Product lineup is Handheld, Studio Panel, Panel, Belt.
- Site is Vercel frontend plus Shopify checkout.
- Shopify is checkout engine, not public storefront.
- US-only shipping is current policy.
- Marketing checkbox remains preselected.
- Noindex stays until final launch.
- Do not use Admin API tokens.
- Do not commit Storefront token to git.
- Do not edit approved artboards unless Jake explicitly approves.

When editing:
- Prefer build-time transformations.
- Do not modify approved source artboards.
- Keep assertions.
- Run build and verify.
- Verify live after Vercel deploy.
- Never use `git add .`
- Commit scoped changes only.
- Do not remove noindex unless explicitly instructed.
- Do not enable/alter payments unless explicitly instructed.

---

## 20. Corrections and additions — appended 2026-09-01

Approved by Jake. Items 1 and 2 are also applied in place, in §1 and §13.

### 20.1 Build command correction

The build command is not complete by itself now that Shopify checkout is wired.

Correct build instruction:

```bash
SHOPIFY_STOREFRONT_TOKEN=<public storefront token> node tools/build-site.js
```

On Vercel, this works because `SHOPIFY_STOREFRONT_TOKEN` is already set in environment
variables.

Do not remove this env-var requirement. The build intentionally fails without the token
so we do not ship a dead checkout button. The failure is explicit and names the fix:

```
BUILD FAILED

Checkout is enabled but SHOPIFY_STOREFRONT_TOKEN is not set, so the built page
would carry no token and the Checkout button could not work.
```

Configuration is also validated *before* `build/` is cleaned, so a failed build leaves
the previous output intact rather than destroying it to report a knowable problem.

### 20.2 Favicon source folder exception

The favicon/social preview source folder is intentionally tracked:

```
assets/8.30.26/favicon/
```

Do not remove the `.gitignore` exception for this folder.

Reason: the general `assets/*/*/` ignore rule would otherwise exclude the favicon folder
from a fresh checkout, causing Vercel builds to fail. The large source PNG folders remain
ignored, but the favicon/social assets must remain tracked.

The exception is written as a directory re-inclusion (`!assets/8.30.26/favicon/`) because
git will not descend into an excluded directory to pick individual files back out. About
150 KB total. Confirmed by cloning `--no-local --depth 1` and building cold: exit 0, all
five assets present in the output.

### 20.3 Assertion suite

The assertion suite is now a core safety layer.

Build and verify checks cover:
- no surviving design-tool routes
- resolved template bindings
- checkout gate consistency
- withdrawn Mask removal
- no `[FACTS:]` or `[LEGAL:]` markers in build output
- noindex presence
- policy footer presence
- favicon/social metadata
- price parity across Shop, PDP, Cart, and Shopify variant mapping
- Shopify variant GID integrity
- checkout wiring guardrails

Do not weaken, bypass, or delete assertions without explicit approval.

Run both:

```bash
SHOPIFY_STOREFRONT_TOKEN=<public storefront token> node tools/build-site.js
npm run verify
```

Every assertion was fault-injected before being trusted — the check was proven to fail on
a deliberately broken build, not merely to pass on a good one. Several caught real defects
that would otherwise have shipped, including a GID with a trailing character that a
substring check accepted, and a swapped SKU-to-GID mapping that would have charged a
customer for the wrong product.

### 20.4 Payment setup remains a launch gate

Checkout wiring works, but real payment configuration still needs confirmation.

Before removing noindex:
- confirm whether Shopify is using Bogus Gateway / test gateway or real payment processing
- turn off test gateway before accepting real orders
- confirm live payment provider is intentionally enabled
- run final checkout test in the intended payment mode

The specific place to look is Shopify → Settings → Payments. The recorded test order
showing "Payment not processed" is consistent with a test gateway being active. A test
gateway left on after launch silently accepts orders that never charge.

### 20.5 Resolved items

Do not re-raise these as open blockers:

- **Marketing checkbox / privacy mismatch — resolved.** Jake chose preselected email
  marketing, and the Privacy Policy was updated to match.
- **International shipping policy mismatch — resolved.** Checkout is US-only and policy
  language is US-only.

### 20.6 Still-open operational items

Keep these as open launch/ops items:

- Published Terms currently do not include governing-law or dispute-resolution language.
- Studio Panel return logistics are still unresolved. PO Box 15191 may not be suitable for
  a 74 inch panel return.
- Customer-pays return shipping on a $6,000 Studio Panel remains a business decision.
- CRM/email capture setup remains required before noindex removal.
- Final payment mode confirmation remains required before noindex removal.

### 20.7 Current repo state

Current latest deployed commit: **c38aaf8**

Verified 2026-09-01: local HEAD, local `main`, and remote `main` all at `c38aaf8`, and
live `shop.html` is byte-identical to the local build.

Legal Review folder remains held/uncommitted:
- historical working drafts
- not the current live Shopify policy source of truth
- do not commit or overwrite live Shopify policy language without approval.
