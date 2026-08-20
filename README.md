# Calmlyte Storefront — Deploy Notes

## What this is
Production-prepped static storefront. No backend required. Payments are stubbed
(buttons show a "checkout opens soon" toast) until you paste Stripe links in.

## Structure
```
index.html          Intro gate + interactive mode-switcher hero
                    (Haven/Focus/Stillness/Dusk), two-form product grid, learn teaser
products/           2 product pages (handheld, mask). The separate shop index was
                    removed 2026-08-20: it duplicated the homepage products block.
                    Nav Shop now points at index.html#top.
learn/              green-light.html (counsel-cleared spectrum article), faq.html
assets/
  forest-*.webp     4 scene backgrounds (forest-haven doubles as the intro gate)
  handheld.webp     Handheld product scene shot
  mask.webp         Mask product scene shot
```
Orphaned assets from the retired 5-SKU lineup (belt / panel-pro / panel-<mode> /
sig-*) were deleted 2026-07-06 — recoverable from git history if the lineup returns.

## Internal review view
`[FACTS]` notes and the counsel banner on `learn/green-light.html` are hidden from
visitors. Append `?debug` to any URL to reveal them (e.g.
`products/handheld.html?debug`). Spec rows whose only value is a `[FACTS]` note carry
`class="facts-row"` and hide the entire row, so no empty cell is ever shown.
The homepage accepts both #haven and legacy #/haven hashes; arriving on a mode
hash skips the intro gate.

## Product lineup (2026-07-06)
The line is **Handheld ($450) and Mask ($400) only.** Signature Panel, Belt, and
Panel Pro were retired and their pages deleted — recoverable from git history if
the lineup changes back.

**Mode → product mapping** comes straight from each PDP's spec table and must not
be widened without supplier confirmation:
- **Handheld** — Focus, Haven (spectrum: 520–530 nm green; no amber/cyan confirmed)
- **Mask** — Dusk, Stillness (spectrum: 520–530 nm green + 590 nm amber)

The hero presents the four modes as *environment*, not hardware channels, so the
homepage makes no per-device spectrum claims; those live on the PDPs behind their
existing `[FACTS]` flags. Haven's character line had its "gentle amber tone" clause
removed because Haven now ships only on the Handheld, whose amber channel is
unconfirmed — see the comment in the `MODES` block.

## Counsel / launch list
- The Legal Review drafts still list all five SKUs and their prices (Terms §2,
  questionnaire A15). **Do not edit those drafts directly** — route the lineup
  change through Emma/counsel with the copy re-review.
- Checkout remains stubbed (`CHECKOUT_LINKS` all null) — Handheld and Mask show
  add-to-cart with a "checkout opens soon" toast; no Stripe links pasted.
- Whole site is `noindex,nofollow` on every page, parked pre-launch.

## Deploy (GitHub Pages — same flow as NeuroHome)
```powershell
cd site
git init; git add .; git commit -m "Calmlyte storefront v1"
git branch -M main
git remote add origin https://github.com/<you>/calmlyte.git
git push -u origin main
# Repo Settings > Pages > Deploy from branch > main / root
```
Hash routing (`#/haven`, `#/focus`, `#/stillness`, `#/dusk`) works on any static
host — no server config needed. Deep links and back button work.

## Turning on payments later (~10 min)
1. Stripe Dashboard → Products → create the 5 SKUs → generate a Payment Link each.
2. In `index.html`, find `CHECKOUT_LINKS` at the top of the `<script>` block and
   paste each link in place of `null`. Done — buttons redirect to Stripe.

## Before you flip payments on (required)
- **Legal pages**: privacy policy, terms, and a shipping/returns policy.
  Stripe requires these and card networks will flag their absence. Do not
  generate boilerplate — have Emma or counsel produce them.
- **Spec bands** currently read "Pending clinical and legal review." Resolve
  the review and remove the note, or remove the spec bands. A live checkout
  next to that disclaimer is a liability problem.
- **Contact email**: `hello@calmlyte.com` is a placeholder in the footer and in
  the checkout toast (`CONTACT_EMAIL` in the script). Set up the real inbox.
- **Domain**: once live, uncomment the canonical tag in `<head>` and change
  `og:image` to an absolute URL so link previews work.

## What was changed from the mockup
- Extracted 30 embedded base64 images → 9 unique files, deduped, converted to
  WebP (2.1 MB → 1.34 MB), semantic filenames.
- Real hash routing with per-page titles (was display:none toggles with no URLs).
- SEO: meta description, Open Graph, Twitter card, theme-color, SVG favicon.
- All product images `loading="lazy"`; scene backgrounds hydrate on navigation.
- Buy buttons wired to `data-sku` + central `CHECKOUT_LINKS` config; graceful
  toast while links are null.
- Removed ~2 KB of dead CSS from an earlier mockup iteration (.intro/.moment/
  .closer/.buycard/.modeband blocks, one of which referenced a 300 KB image).
- Design, copy, and layout untouched.
