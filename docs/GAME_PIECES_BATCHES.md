# Game piece asset batches

The numbered contact sheets are source references for a one-time manual production step. Each piece is generated as its own transparent PNG with the built-in image generation tool, then copied into `public/tokens/`. Leader only reads those files. The final common canvas is 1254×1254 pixels; the prompt aims for approximately 7% transparent margin and the shared gallery CSS handles display size.

## Batch 1 — Colorful Collectible Figurine Grid

Number 1 (Tux) was a reference only. The already supplied hand-painted Tux portrait was cut out separately as `tux-hand-painted.png`.

| Number | Piece | File |
| --- | --- | --- |
| 2 | Race car | `public/tokens/race-car.png` |
| 3 | Propeller plane | `public/tokens/propeller-plane.png` |
| 4 | Tugboat | `public/tokens/tugboat.png` |
| 5 | Steam train | `public/tokens/steam-train.png` |
| 6 | Lucky cat | `public/tokens/lucky-cat.png` |
| 7 | Puppy | `public/tokens/puppy.png` |
| 8 | Rocket | `public/tokens/rocket.png` |
| 9 | Globe | `public/tokens/globe.png` |
| 10 | Treasure chest | `public/tokens/treasure-chest.png` |

## Batch 2 — Ten Enamel Miniature Collectibles

| Number | Piece | File | Status |
| --- | --- | --- | --- |
| 1 | Rabbit | `public/tokens/rabbit.png` | Finished |
| 2 | Lion | `public/tokens/lion.png` | Finished |
| 3 | Hippo | `public/tokens/hippo.png` | Finished |
| 4 | Parrot | `public/tokens/parrot.png` | Finished |
| 5 | Pelican | `public/tokens/pelican.png` | Finished |
| 6 | Double-decker bus | `public/tokens/double-decker-bus.png` | Finished |
| 7 | Apple | — | Pending image generation limit reset |
| 8 | Pineapple | — | Pending image generation limit reset |
| 9 | Sheep | — | Pending image generation limit reset |
| 10 | Scientist | — | Pending image generation limit reset |

## Final prompt set

For each numbered item, the built-in image generation tool received the relevant whole contact sheet as an exact visual reference and this prompt, with the bracketed subject and number replaced for that item:

> Use case: background-extraction. Asset: one final collectible game figurine PNG for the user's separate one-off asset preparation. The attached numbered contact sheet is the exact visual reference. Extract ONLY figurine number [number, subject] and refine it into a clean, complete, standalone miniature. Preserve its original pose, silhouette, hand-painted worn enamel texture, metallic accents, color palette and proportions. Place on a genuinely transparent square canvas, centered, with the COMPLETE figurine occupying about 86% of both its relevant width/height and a consistent 7% transparent margin, matching the other pieces in this batch. No tabletop, gray backdrop, cast shadow, number, label, other figurines, new pedestal, or text.

The same composition and transparency constraints were used for Batch 1, with each respective figurine's defining details named in its prompt. Tux used the dedicated cutout prompt recorded in `MASCOT.md`.
