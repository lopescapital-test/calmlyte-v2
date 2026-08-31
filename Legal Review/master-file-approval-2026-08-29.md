# Master file approval — record of sign-off

**Status: INCOMPLETE. File identity below is recorded and verified. The approval
particulars are NOT recorded because they were not supplied. Do not treat this
document as evidence of approval until Jake fills §2–§5.**

---

## 1. File identity (verified)

Received in two deliveries. The second supersedes the first in scope; the first
is a subset of it.

### 1a. Brief G attachment (2026-08-30)

| Field | Value |
|---|---|
| As received | `C:\Users\jaker\Downloads\Calmlyte Shop.html` |
| Size | 6,355,682 bytes |
| SHA-256 | `be421c9f162eeb301ec22c5fc065aee4b1228c0f41896d357c201c12ce8bd71c` |

A self-extracting browser bundle of a **single artboard** — the Shop page. It is
the bundled export of `Shop Standalone.dc.html` from the full set below, with all
assets inlined.

### 1b. Full approved set (2026-08-30) — `Calmlyte Approved Site/`

Hashes computed before any edit, on the files exactly as received.

| SHA-256 | Bytes | File |
|---|---|---|
| `be421c9f162eeb301ec22c5fc065aee4b1228c0f41896d357c201c12ce8bd71c` | 6,355,682 | `Calmlyte Shop.html` |
| `3f616189af120814ceb3d9181eec0bb94be777b7395aeb2fb08e46998f7769c8` | 19,890 | `Shop.dc.html` |
| `86487b942df166fbdb4510143a7fd078d45dc85356cc655c4dd04625dd51752b` | 20,981 | `Shop Standalone.dc.html` |
| `38fae8aaf9931cfc74b8a8fd5ef4575cfd788ac0d7bb76923470902c7d5c5b33` | 19,818 | `Product.dc.html` |
| `96cfb6d8bf67f150040ce7f7c9802b10ce07c315ac1fcfdf53d6af2ae0def68c` | 18,938 | `FAQ.dc.html` |
| `35c9a5d13f8e3e193080553db461294f209f43d6495b993f98957d625d9c39cb` | 21,393 | `Cart.dc.html` |
| `f0560968a60c7d6faa834d1a298b16b3ec05454e7b34ba610f3cc4ba0526f08c` | 19,418 | `Light.dc.html` |
| `00d778c626a37923aa4d58d259180c9d5a89a2ab0b391bf2f23d06df1704b1b2` | 38,648 | `Studies.dc.html` |
| `fc7e4ee39b097564e19e77f99df88c77194d38538d3b68950e43044e6caccad6` | 58,590 | `Research.dc.html` |
| `c3034bfc3a3d88a7d0f7dce11a0e0de0f48890d3c79030ff7282b4dd59a800f4` | 13,621 | `Shinrin Yoku.dc.html` |
| `8fe7df74405f3c55f49b7249c74ea1397e65d07dea2b1bd3b4a489bec2e28cbe` | 69,150 | `support.js` (Claude Design runtime; generated, not authored copy) |
| `138c294242c42af0ca661e6b4f43af6eeebd48cec2d0fe98fbb54af2b8271756` | 24,156 | `.thumbnail` |

Plus `assets/` (23 files) and `uploads/` (45 files). All 18 product images in
`assets/` and all 4 forest scenes are **byte-identical to images already in this
repository**; `handheld-card.png` (2,599,792 bytes) is the only new image. All 45
files in `uploads/` are unreferenced by any page.

### 1c. `uploads/` removed from version control, 2026-08-31

The 45 files in `uploads/` were received as part of the delivered set and remain
on disk, but are **no longer tracked in git**. None was ever part of the approval
proof:

| Group | Count | Size | Disposition |
|---|---|---|---|
| `pasted-*.png` | 27 | 15.0 MB | Design-tool paste dumps — screenshots at aspect ratios like 1635×75 and 1606×52. Referenced by no page. None is byte-identical to any shipped asset. |
| `*.webp` | 18 | 1.4 MB | **Byte-identical duplicates** of `Calmlyte Approved Site/assets/`, which stays tracked. No bytes are lost by untracking them. |

Neither group is hashed anywhere in this record, neither is referenced by any
artboard or by `support.js`, and `tools/build-site.js` never reads `uploads/` —
the build copies only `assets/`. The single `uploads/` string in the approved
source (`Studies.dc.html:279`) is part of an external citation URL
(`accurateclinic.com/wp-content/uploads/2021/…`), not a local path.

The ten artboard hashes and `support.js` in §1b are unaffected and still verify.

## 2. Date of approval

**NOT SUPPLIED.** Brief G is dated 2026-08-29. Whether that is the approval date
is not stated.

## 3. Who approved

**NOT SUPPLIED.** Brief G states "Kyle and counsel signed off on this file" and
asks for names. Kyle's surname was not supplied. Counsel is not named anywhere in
the brief or in `Legal Review/`.

- Clinical: Kyle [surname not supplied]
- Legal: [counsel not named]

## 4. Form of approval

**NOT SUPPLIED.** Email, signed document, call, or meeting — not stated.

## 5. What exactly was approved

**NOT ESTABLISHED, and now materially ambiguous.** Brief G said "the file as
attached." The attachment is one artboard. The folder is ten. Whether sign-off
covered the Shop page alone or the whole set changes what is governed here, and
nothing supplied answers it.

This matters most for `Research.dc.html`, a 58 KB clinical white paper carrying
specific numeric efficacy figures, a health-economics comparison against CGRP
monoclonal antibodies, and the phrase "side-effect-free therapeutic modality." If
counsel did not read that document specifically, it is not approved in any
meaningful sense regardless of what was said about "the file."

## 6. What the set is — recorded for the record

Not a website. Ten **Claude Design canvas artboards** (`.dc.html`, `<x-dc>`
markup, `{{ }}` bindings, editor-props blocks) driven by `support.js`, a generated
React 18.3.1 runtime. They render as a browsable seven-page mockup with a working
`localStorage` cart. Checkout is a stub that shows "Checkout opens soon."

There is no `noindex` on any page, no JSON-LD on any page, and no trace of the
four Calmlyte settings (Haven, Focus, Stillness, Dusk) anywhere in the set.

## 7. Chain of custody

| When | What |
|---|---|
| 2026-08-30 | Brief G attachment received. Hashed before any edit. Unpacked read-only into a scratch directory for inspection. |
| 2026-08-30 | `Calmlyte Approved Site/` received in the repo working tree. All 12 top-level files hashed; `Calmlyte Shop.html` confirmed byte-identical to the attachment. No file in the folder was modified. No site file was modified. |

---

*Record created 2026-08-30 under Brief G §0, updated the same day when the full
artboard set arrived. Sections 2–5 are open and must be completed by Jake before
this file has evidentiary value.*
