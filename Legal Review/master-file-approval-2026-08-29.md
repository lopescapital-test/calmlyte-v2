# Master file approval — record of sign-off

**Status: INCOMPLETE. The hash and file identity below are recorded and verified.
The approval particulars are NOT recorded because they were not supplied. Do not
treat this document as evidence of approval until Jake fills §2–§5.**

---

## 1. File identity (verified)

| Field | Value |
|---|---|
| File as received | `C:\Users\jaker\Downloads\Calmlyte Shop.html` |
| Size | 6,355,682 bytes |
| SHA-256 | `be421c9f162eeb301ec22c5fc065aee4b1228c0f41896d357c201c12ce8bd71c` |
| Hash computed | 2026-08-30, before any edit, on the file exactly as received |
| Copied into repo at | `_incoming/master-2026-08-29/Calmlyte Shop.html` (byte-identical; hash re-verified after copy) |

Single file. No other files were supplied with the brief.

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

**NOT SUPPLIED.** Email, signed document, call, or meeting — not stated. Per the
brief, a documented verbal approval is worth recording plainly; it cannot be
recorded because the form is unknown.

## 5. What exactly was approved

**NOT ESTABLISHED.** The brief says "the file as attached, or a version of it."
No approved-version identifier, no counter-hash, and no approval artifact were
supplied, so the file received cannot be tied to the thing approved by anything
stronger than assertion.

This matters more than usual here because of what the file actually is (§6).

## 6. What the file is — recorded for the record

The attached file is **not a website**. It is a self-extracting bundle of a
**single Claude Design canvas artboard** (`.dc.html`, `<x-dc>` markup, `{{ }}`
template bindings, an `<x-dc>` editor props block). It unpacks in the browser to
a React 18.3.1 single-page mockup of **one screen — the Shop / product grid**.

It contains no product detail pages, no FAQ page, no spectrum or studies page and
no cart page. Its navigation links to `Product.dc.html`, `FAQ.dc.html`,
`Light.dc.html`, `Studies.dc.html`, `Cart.dc.html` and `Shinrin Yoku.dc.html`;
the bundle's `page_order` island is empty, so **none of those sibling artboards
are present** and every one of those links is dead.

Anyone later relying on this record should understand that whatever Kyle and
counsel reviewed, it was one screen of a design mockup, not the seven-page site
in this repository.

## 7. Chain of custody

| When | What |
|---|---|
| 2026-08-30 | Received from Jake as an attachment to Brief G. Hashed before any edit. Unpacked read-only into a scratch directory for inspection. Copied byte-identical into `_incoming/master-2026-08-29/`. No site file was modified. |

---

*Record created 2026-08-30 under Brief G §0. Sections 2–5 are open and must be
completed by Jake before this file has evidentiary value.*
