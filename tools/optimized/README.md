# Pre-generated build assets

Files here replace an approved source image in the deployed build. The image in
`Calmlyte Approved Site/assets/` is never modified — only the copy written to
`build/assets/`, and the references pointing at it.

`tools/build-site.js` performs the substitution via its `OPTIMIZED` map.

| Replaces | With | Before | After | How |
|---|---|---|---|---|
| `handheld-card.png` | `handheld-card.webp` | 2,599,792 B | 367,096 B (−85.9%) | Canvas `toBlob('image/webp', 0.95)`, 1283 x 1283, no resampling |

Re-encoded in a browser because this machine has no image library (no sharp,
cwebp, or ImageMagick). Dimensions are unchanged; only the container and
encoder differ. To regenerate, load the source PNG into a canvas at its natural
size and export WebP at quality 0.95.
