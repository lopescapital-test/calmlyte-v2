# Calmlyte Storefront — Deploy Notes

## What this is
Production-prepped static storefront. No backend required. Payments are stubbed
(buttons show a "checkout opens soon" toast) until you paste Stripe links in.

## Structure
```
index.html          Intro gate + interactive mode-switcher hero
                    (Haven/Focus/Stillness/Dusk), four-form product grid, learn teaser
products/           4 product pages (panel, handheld, belt, mask). The separate
                    shop index was removed 2026-08-20: it duplicated the homepage
                    products block. Nav Shop now points at index.html#top.
learn/              green-light.html (counsel-cleared spectrum article), faq.html
assets/
  site.css          Shared design system: tokens, nav, footer, PDP + learn layout
  site.js           Shared page behaviour: reveal observer + PDP image gallery
  forest-*.webp     4 scene backgrounds (forest-haven doubles as the intro gate)
  handheld/         Handheld: hero, in-use, front, profile (4 files)
  mask/             Mask: hero, worn, held, package (4 files)
  belt/             Belt: hero, in-use, lit flat, fastened (4 files)
  panel/            Panel: hero, Dusk, room, back, controls (5 files)
```
Product photography moved into per-product folders on 2026-08-20 so each SKU's
shots sit together. The PDP gallery is markup-only: give the main image
`id="pdpMain"` and add `.pdp-thumb` buttons carrying `data-full` + `data-alt`.
site.js wires the swap and needs more than one thumb to activate, so a
single-image PDP degrades to a plain figure.
Assets are pruned when they stop being referenced rather than left orphaned in the
tree; git history is the recovery path. Removed so far: the retired-lineup assets on
2026-07-06 (panel-pro, sig-*), `mask-worn.webp` on 2026-08-20, and the four
per-setting Panel renders plus three `stage-*.webp` on 2026-08-22.

## Internal review view
`[FACTS]` notes and the counsel banner on `learn/green-light.html` are hidden from
visitors. Append `?debug` to any URL to reveal them (e.g.
`products/handheld.html?debug`). Spec rows whose only value is a `[FACTS]` note carry
`class="facts-row"` and hide the entire row, so no empty cell is ever shown.
The homepage accepts both #haven and legacy #/haven hashes; arriving on a mode
hash skips the intro gate.

## Product lineup (2026-08-22)
The line is **Panel ($600), Handheld ($450), Belt ($200) and Mask ($400).**

The Panel and the Belt were both retired on 2026-07-06 and brought back on
2026-08-22 out of git history. **Panel Pro ($2,000) stays retired** and exists only
in history.

**Naming:** the panel is now just **"Panel"**. It has had three names — the Legal
Review drafts call it **"Small Panel"**, the site called it **"Signature Panel"**
until 2026-08-22, and its internal SKU key is still `small-panel`. The SKU key was
deliberately left alone: it is a stable identifier and changing it would desync
from counsel's drafts for no gain. **Route the name to Emma** so the drafts and the
site agree on one.

**Mode -> product mapping** comes straight from each PDP's spec table and must not
be widened without supplier confirmation:
- **Panel** — all four settings (520-530 nm green core, plus a *claimed* 490-500 nm
  cyan-green and 590 nm amber support)
- **Handheld** — Focus, Haven (520-530 nm green; no amber/cyan confirmed)
- **Belt** — Stillness, Haven (520-530 nm green; amber unconfirmed, and its own
  FACTS note says to drop Stillness if the amber channel does not exist)
- **Mask** — Dusk, Stillness (520-530 nm green + 590 nm amber)

The homepage sells on **form** (room / portable / wearable / personal) rather than
on settings, because the Panel claims all four and would otherwise make the other
three look redundant. That tension is a positioning question worth deciding: a SKU
that does everything undercuts the reason to buy any of the others.

**Belt is not purchasable.** Its PDP shows a "Coming soon" chip rather than
add-to-cart, and the homepage card matches with a non-interactive chip instead of an
Add button. Reasons, both unresolved: its "In the box" row is still an open FACTS
note, and it has no ship window ("Shipping details available at launch" against
"Ships in 10-14 business days" everywhere else). Do not give it an Add button until
both are settled.

## Mask photography (2026-08-20)
Three images, all the same mould — single pinched eye aperture, temple pucks,
perforated cheek band. `mask-package.webp` corroborates it: its 640 x 220 mm
callouts match the spec table's 25.2 x 8.7 in exactly.

- **mask.webp** — hero. Rendered from `mask6.png`, which supersedes the 2.0 and
  5.0 renders. Kept at this filename so the homepage product card, the PDP hero
  and the first gallery thumb all track it with no markup change.
- **mask-held.webp** — marketplace-style composite on a coral background, off the
  forest palette. **Counsel:** it renders the light as beams travelling into a
  face, which is exactly what the copy rule forbids showing. It is in the gallery
  at the owner's explicit direction — Emma signs off or it comes out. Removing it
  is one button block in `products/mask.html`.
- **mask-package.webp** — carries its contents as baked-in image text, so the
  "In the box" spec row still needs that list as real text. It is also the one
  image that must not be cropped, which is what `data-fit="square"` on its thumb
  and `.pdp-figure.fit-square` in site.css are for.
- **mask-worn.webp** (added 2026-08-22) — the worn shot that had been missing, and it
  **is our mould**: single pinched aperture, temple pucks and perforated cheek band all
  match the hero and the package shot. No brand mark on it. Copied verbatim rather than
  re-encoded (the source is only 768px square) and carried with `data-fit="square"`
  so nothing is cropped. At 768px it is barely 1x for the rendered figure, so it will
  look slightly soft on high-DPI screens.

  **BLOCKING — its light is RED.** Measured rgb(212,147,124) on the lit rim. This is a
  green product: 520-530 nm green with 590 nm amber. This is exactly why the previous
  worn shot was deleted on 2026-08-20. Replace with a green unit before launch.

  **It also corroborates the spec problem.** The file arrived named
  `TLM300PRO-L-LED-Face-Mask2-768x768.webp` — the same model whose supplier sheet
  lists 460/665/850/1064 nm and **no green at all**. So there are now two independent
  artifacts saying the sourced mask is a red/near-IR unit: the sheet, and a product
  photo of it. The green claim needs supplier confirmation, not another render.

  Renamed on copy, and the model number is deliberately kept out of the page markup —
  a served HTML comment is readable by anyone who views source, and naming the OEM
  there would hand over the white-label source. It lives in this file instead.

Unused source renders sit untracked in `assets/mask/`: `mask 2.0.png`,
`mask3.0.png`, `mask4.0.png`, `mask5.0.png`, `1b093d0d-….png`.

## Handheld photography (2026-08-20)
- **handheld.webp** — hero. Product render.
- **handheld-inuse.webp** — cropped from supplier photo `7eee2cc2-….png`. The crop
  is load-bearing, not cosmetic: the original frames a trade-show booth whose back
  wall carries a "light therapy" history timeline poster with legible dated claims
  and a family-with-children marketing poster. Both sit above the counter line, so
  the crop clears them. **Do not re-crop wider.**
  **Counsel:** it still shows green light on skin, which the copy rule forbids
  depicting. In the gallery at the owner's explicit direction, same standing as
  `mask-held.webp`. Emma signs off or it comes out.
- **Not added:** `dce274c3-….png` (untracked). The poster child sits directly
  behind the device, so every crop that keeps the product also keeps the child.
  It cannot be salvaged by cropping.
- **handheld-front.webp / handheld-side.webp** — studio shots, face-on and in
  profile. Padded onto a 1:1 canvas in their own white and carried with
  `data-fit="square"`, so nothing is cropped.
- **Still wanted:** our own in-use photography, shot against the brand's surfaces
  rather than a booth.

### Device identity
This was called wrong twice and the current reading lives in **"Handheld device
identity — reopened"** further down. Short version: the booth photos have a hinge
bracket our render does not, so they are different devices, which makes
`handheld-inuse.webp` suspect. Do not re-add the retraction that used to sit
here — it argued front and back views were compatible, which a visible hinge defeats.

The LED count and weight discrepancies below are unaffected and still open.

## Belt photography (2026-08-22)
- **belt.webp** — hero. Coiled on wood, LEDs lit.
- **belt-inuse.webp** — belt held open at the waist. Cropped from a square source
  to 4:3; only dead wall came off the top, nothing of the product or the figure.
  **The first belt image showing green light**, which is on-spec where the mask and
  handheld supplier shots were red. Light does fall on skin here — incidental spill
  from a held-open belt rather than a treatment pose, but the copy rule draws no
  such distinction.
- **belt-lit.webp** — opened flat, LED panel lit.
- **belt-outer.webp** — fastened, seen from outside.

Both new shots are padded onto a 4:3 canvas in their own white, matching the
figure's default frame so nothing is cropped. This PDP had no gallery before; one
was added here.

**On the 150-LED spec:** counting emitters on `belt-inuse.webp` lands anywhere from 53
to 171 depending on detection threshold, so unlike belt-lit it is not obviously
inconsistent with 150 — but it is synthetic too and must not be used to source the
number either.

**Caveat:** `belt-lit.webp` shows a dense, perfectly uniform LED grid far denser
than the spec table's **150 LEDs**. Do not use it to source or defend that number.
It comes from the set documented below as AI-generated.

## Specs still unresolved with the supplier
From the sheet for model TLM300PRO-L: **236 LEDs vs the site's 72**, and
**408 g vs 375 g**. Dimensions and battery do match. Green is being made custom,
which resolves the sheet's 460/665/850/1064 nm spectrum but not the count or
the weight.

Two contradictions the package shot exposes:
- **Protective glasses.** The box holds mask, USB cable, manual, remote, storage
  bag — no glasses. Both PDPs say "Use the included protective glasses." Either
  the glasses ship or that sentence is false; it is counsel-cleared safety copy,
  so route the correction through Emma rather than editing it here.
- **Control row.** Mask specs say "Bluetooth app"; the box ships a physical remote
  and lists no app. Confirm whether both exist.

## Panel photography (2026-08-22)
Three images only, per the owner's instruction. Sources live in
`assets/panel/Panel New/` and are gitignored.

| file | what it is |
| --- | --- |
| `panel.webp` | Hero. Wide beauty shot, 1600x895, also the homepage card image. |
| `panel-dusk.webp` | The Dusk setting. |
| `panel-inuse.webp` | A room scene. **Cropped — see below.** |
| `panel-back.webp` | Rear view: vent grille and folding stand. |
| `panel-controls.webp` | Side view with the control screen. **See caveat.** |

### panel-inuse.webp: the crop is load-bearing
The uncropped frame shows a **third-party logo lockup reading "DEARDOO"** on the
panel's control strip at the right edge — a mark plus wordmark, plainly legible at
magnification. The crop cuts that strip off while keeping the whole LED face, and
the tighter framing reads better anyway. Re-cropped tighter again on 2026-08-22 to
enlarge the panel and drop dead space on the left: the window is now x 215-1115,
y 265-940 of the source. **x cannot go past 1115 — that is where the control strip
starts. Do not re-crop wider, and do not swap in
the original.**

Two things the crop does not fix, both raised and both overridden by explicit
instruction, so they need Emma rather than another pass from me:
1. **It is not the same panel** as the other two images. It has a front-mounted
   control screen, side vents, a stone base and oval faceted lenses. Ours has a
   plain white face, a white folding stand and round lenses. A visitor clicking
   through the three thumbs sees two different products.
2. **It shows light falling on skin** (a raised palm), which the copy rule forbids
   depicting.

### panel-controls.webp caveat
Its touchscreen carries AI-generated gibberish — "CoUKoons", "Time atore ka",
"IrafutRoood". Illegible at render size, obvious to anyone who zooms. Separately,
the spec table lists control as **a Bluetooth app** and mentions no on-device
screen, so this image shows an interface the specs do not claim. Added on
instruction; both points are for Emma.

### Deleted here
The four per-setting renders (`panel-haven`, `panel-focus`, `panel-stillness`) and the three
unused `stage-*.webp` shots were removed rather than left orphaned in the tree.
All are recoverable from git history.

### On generated imagery generally
This is not an "AI images are unusable" rule — generated imagery is what this whole
site runs on, including the panel hero. What disqualifies an image is a third-party
mark, a product that is not ours, fabricated spec detail presented as fact, or light
shown acting on a body. See the greenlightpics section below for a set that failed
on three of those four.

## assets/greenlightpics — investigated 2026-08-22, DO NOT USE
Nine JPEGs, extracted from `assets/Green light pics .zip`. Five panels, two
handheld, two belt, all on white. They look like clean catalogue photography and
they are not usable. **At least the panel set is AI-generated.**

Evidence:
1. **Garbled UI text.** The panel control screen in `original-C1662637` reads
   "CoUKoons", "MraUCnGihea", "Time atore ka", "IrafutRoood" at magnification —
   crisp letterforms forming non-words, with malformed seven-segment digits. That is
   a diffusion-model signature. Blurry real text degrades differently, and a 3D
   render would use a real font with real strings.
2. **No camera provenance on any of the nine.** No Make, Model, DateTimeOriginal,
   exposure, ISO or focal length. `original-*` files carry no APP segments at all —
   completely bare JPEGs. `processed-*` files carry a 190-byte Exif block and an
   Apple AROT marker (an iOS pipeline touched them) but still zero camera tags.
3. **Two mutually incompatible panels in one set.** `original-D70A4F6D` is a
   6 x 15 grid of 90 small LEDs. `original-555DB222` is a 5 x 12 staggered grid of
   60 large reflector lenses. Both are presented as the panel. Counted
   programmatically by blob detection, not by eye.
4. **No count matches any spec.** Signature Panel claims 72 LEDs, Panel Pro 216,
   Belt 150. The images give 90, 60, and a uniform dot grid far denser than 150.

**Do not treat the detail in these images as facts about the product.** The LED
counts above are fabricated, so they are not evidence of a spec discrepancy — they
are evidence the images are synthetic. They are kept on disk, untracked and
gitignored, purely as a record of what was reviewed.

## Handheld device identity — reopened, and I got this wrong twice
Current state of the evidence:
- `handheld.webp` (our render): thick wand, round 13-lens head, LCD on the grip,
  four buttons, **no hinge**.
- Supplier booth photos (`7eee2cc2`, `dce274c3`, untracked): thin flat disc head
  with leaf-shaped vent cutouts, **a separate hinge bracket with a visible pin**, and
  a thin slab grip. Confirmed at high magnification on the neck joint.
- `assets/handheld/handheld-front.webp` and `handheld-side.webp` (now IN the
  gallery): thick wand, round multi-lens head, LCD, four buttons, and in profile a
  single continuous moulding with **no hinge** — matches our render. They may be
  synthetic too, so they are not independent proof of the real hardware, but they do
  put our render's device and the booth photo's device side by side in one gallery.

**A visitor clicking through the Handheld gallery now sees two different products.**
That was a documentation problem before; it is a visible one now.

A hinge is visible from any angle. Our render has none and the booth photo plainly
has one, so those are different devices. I first called that out, then retracted it
on the reasoning that front and back views were compatible — the retraction was
wrong, because the hinge does not depend on which side you photograph.

**Blocking:** `assets/handheld/handheld-inuse.webp` is cropped from `7eee2cc2` and
is live on the Handheld PDP. It therefore probably shows a device we do not sell.
It should come off that page unless the supplier confirms a folding variant. It was
added at the owner's explicit request, so it has not been removed unilaterally.

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
