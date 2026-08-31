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
`[FACTS]` notes are hidden from visitors. Append `?debug` to any URL to reveal them
(e.g. `products/handheld.html?debug`). Spec rows whose only value is a `[FACTS]` note
carry `class="facts-row"` and hide the entire row, so no empty cell is ever shown.
`index.html` gained the same `?debug` script on 2026-08-29; before that the homepage
had no review view at all.
The homepage accepts both #haven and legacy #/haven hashes; arriving on a mode
hash skips the intro gate.

**The counsel banner on `learn/green-light.html` is no longer `?debug`-gated.** As of
2026-08-29 `.counsel` in `assets/site.css` is `display:block`, so the banner renders on
a normal page load. This is deliberate and temporary: health-claim copy is staged on
the site pending counsel review, and a status banner nobody sees is worse than none —
a reviewer would load the page, see no marking, and reasonably conclude the copy was
cleared.

## GO-LIVE CHECKLIST — claim-copy staging (added 2026-08-29)
Do **all** of these in one atomic change, or none. None of it is authorised yet;
publication requires counsel's written approval of page context and net impression,
claim-to-SKU mapping, disclaimer strategy, and regulatory posture.
1. Restore `.counsel { display:none }` in `assets/site.css` (search: `REVERT AT GO-LIVE`).
2. Remove the `.counsel` banner from all **7** HTML files (it was on 1 until 2026-08-29).
3. Lift `noindex,nofollow` from all 7 HTML files — same commit, not before.
4. Resolve every `<!-- COUNSEL REVIEW 2026-08-29 -->` marker per counsel's adjudication.
   Unresolved markers mean the copy is not cleared. `grep -rn "COUNSEL REVIEW" .`
5. Confirm every `class="claim-staged"` block. `grep -rn "claim-staged" .` — expect
   **exactly two**, on `learn/green-light.html` and `learn/faq.html`. More than two means
   claim copy has leaked back onto product pages, which counsel de-mapped on 2026-08-29.
6. JSON-LD:
   - `Product` `"category": "Wellness lighting"` on all four PDPs is **still unresolved** —
     counsel gave a direction, not a value. Proposals are with Jake; nothing applied.
   - `"image"` and `"offers.url"` were **removed** from all four `Product` schemas on
     2026-08-29 because they held `[FACTS:]` placeholder text. Restore both with real
     absolute URLs once the domain is live. `grep -rn "D-4 2026-08-29" .`
   - `learn/faq.html` `FAQPage` now **contains the claim language** (the green-light-therapy
     Q&A was added to mirror visible copy per counsel). JSON-LD is what search engines
     consume — this is part of the go-live decision, not a detail to discover after it.
7. Restore commented-out `<link rel="canonical">` and `og:image` tags on the 6 subpages
   with real absolute URLs. `grep -rn "TODO: set canonical" .`

### LAUNCH BLOCKER — box contents are invisible on 3 of 4 product pages (2026-08-29)
`tr.facts-row` is `display:none` in `assets/site.css`, and the **"In the box" row uses it on
the Handheld, Belt, and Mask.** Only `products/panel.html:194` has a plain `<tr>`, so the
Panel is the only SKU whose contents a customer can actually see.

This started as an internal-notes hygiene issue with no customer impact. It is now a
product-information gap with one: the FAQ's "What comes in the box?" answer states contents
"typically include ... protective glasses", which is **false for the Mask**, and a customer
who wants to check has nowhere to look. The FAQ answer cannot be written accurately while
the per-SKU lists it should point to do not render.

Resolve **before** launch, not after:
1. Confirm actual box contents for Handheld and Belt (still `[FACTS:]`).
2. Convert the "In the box" rows to visible `<tr>` on all four PDPs.
3. Then the FAQ answer can point at them instead of routing customers to email.

### LAUNCH BLOCKER — `hello@calmlyte.com` must be a real, monitored inbox (2026-08-29)
Still flagged `[FACTS: replace with real monitored inbox]`, and **its status changed on
2026-08-29 from decorative to load-bearing.** The FAQ's "What comes in the box?" answer now
routes customers there, because the per-SKU contents lists it used to point at do not render
(see the blocker above). For a Handheld or Belt buyer it is currently **the only path to
finding out what ships in their box** — a question the page itself can no longer answer.

Both blockers resolve together: confirm the contents, make the rows visible, point the FAQ
back at the product pages, and the email stops being load-bearing. Until then the inbox has
to be real and monitored before this page ships.

### Superseded instructions — do not follow the older document (2026-08-29)
Two live briefs disagreed about safety language. Recording the resolution so nobody
re-applies the retired one:

- **Brief C §2.6 is SUPERSEDED by Brief E §1.** C 2.6 said the light-triggered-migraine
  consult language "stays regardless of clearance." Counsel subsequently directed its
  removal. The migraine clause is gone from all five safety locations. Everything else in
  those blocks — photosensitivity, eye conditions, epilepsy, photosensitizing medications,
  do-not-stare, discontinue-use — is unchanged and stays.
- **Brief C §1.7 is SUPERSEDED by Brief E §1 and §3** for safety blocks only. C 1.7 said
  not to touch them in Track 1; Brief E authorises exactly two edits (the migraine clause,
  and the Mask glasses instruction). No other safety edit is authorised by anything.

**Option-label divergence — read before acting on the written record.** Brief E §1 says
"counsel selected option (b)". In the counsel memo of the same date, **(b) meant deleting
the safety block entirely** and (a) meant removing the migraine clause only. Brief E
describes and supplies replacement text for **(a)**, and (a) is what was executed. The
memo and the brief numbered the options differently. The underlying record is an undated,
unsigned call summary. **Anyone reading "counsel selected (b)" against the memo would
conclude the epilepsy and photosensitivity warnings were authorised for deletion. They
were not.** Get this corrected in writing before it is relied on.

### Known divergence, logged deliberately (Brief D §5)
Counsel elected on 2026-08-29 to keep the existing **10–45 minute** session guidance.
That is a materially different usage pattern from the protocols in the literature the
pain and migraine claims rest on. This was a decision, not an oversight. It is recorded
here so it is not rediscovered later and mistaken for a defect.

The equivalent entry in Brief A, D-6 lives outside this repo and needs the same items
added by whoever holds it — this section is not a substitute for that.

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

**All four are purchasable** as of 2026-08-22. Belt was the holdout with a "Coming
soon" chip; it now has Add to cart on both the card and the PDP, and its ship line
matches the others. That line is not invented — the homepage footer already commits
site-wide to "made to order and delivered in 10-14 business days", so Belt is being
brought into line with published policy rather than given a new promise.

Checkout is still stubbed for every SKU. `CHECKOUT_LINKS` are all null, so Add fills
the in-memory cart and the toast points at the contact address. Nothing can actually
be bought yet.

**Still open on Belt:** its "In the box" row remains an unanswered FACTS note. That
was one of the two reasons it was held back, and unlike the ship window it has not
been resolved — it is just no longer blocking the button. A buyable product with
unknown box contents is a fulfilment problem, not a web problem.

The `.soonbtn` component in site.css is now unused. Left in place deliberately: this
lineup has churned repeatedly and a coming-soon state is likely wanted again.

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
- **mask-worn.webp** — the worn shot, and it **is our mould**: single pinched
  aperture, temple pucks and perforated cheek band all match the hero and the package
  shot. No brand mark. Carried with `data-fit="square"` so nothing is cropped.

  **Replaced 2026-08-22 with a green unit** — measured rgb(87,186,103) on the lit
  cheek band, from a 1254px source rather than the earlier 768px one. The first
  version of this file was the red unit and has been deleted, which **clears the
  blocking colour flag** that stood here. Do not reinstate a red one; this is a
  520-530 nm green product.

  The red file had arrived named after the supplier's model — the same model whose
  sheet lists 460/665/850/1064 nm and no green. **That contradiction is unaffected by
  swapping the photo**: a green render does not make the sourced hardware green. The
  model number stays recorded in this file and out of the page markup, because a
  served HTML comment is readable by anyone viewing source and naming the OEM there
  hands over the white-label source.

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
- **belt-inuse.webp** — belt **worn and fastened** in an everyday setting. Replaced
  2026-08-22; the earlier version had it held open across a bare midriff. Measured
  rgb(180,217,180) on the glow, so green and on-spec. Cropped from a square source to
  4:3; only dead wall came off the top.

  **Materially better on the copy rule.** The green shows at the band's top and bottom
  edges, falling on a shirt and skirt rather than on bare skin — it reads as a lit
  object being worn, not as light being applied to a body.
- **belt-lit.webp** — opened flat, LED panel lit.
- **belt-outer.webp** — fastened, seen from outside.

Both new shots are padded onto a 4:3 canvas in their own white, matching the
figure's default frame so nothing is cropped. This PDP had no gallery before; one
was added here.

**On the 150-LED spec:** the earlier held-open belt image put the visible-emitter
count anywhere from 53 to 171 depending on detection threshold — no defensible
figure. That image is gone, and the current one shows the belt closed, so it says
nothing about the count at all. Neither could source the number. Only the supplier
can.

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
magnification. The crop cuts that strip off while keeping the whole LED face.

Measured in the source: the green LED array ends at **x=1102** and the first glyph of
the lockup begins at **x=1127** — 25 px of clearance, and that is the entire budget.
The crop window is now **x 290-1122, y 320-944**, so the right edge sits 20 px past
the last LED and 5 px short of the first glyph. Every LED is in frame with a little
bezel around it.

**The right edge cannot move.** Pushing it further to show the whole panel pulls in
the control screen and the lockup with it, so the panel body right of the LED array
is permanently out of frame — that is the trade for using this image at all. To make
the panel larger, crop the LEFT. Do not swap in the original.

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
