# Leader game pieces

The default piece is the user's hand-painted Tux figurine in `public/tokens/tux-hand-painted.png`. The source image was supplied with a black background; the project asset is a transparent cutout made with the built-in image generation tool. The prompt preserved the figure's pose, painted surface, and colors while removing only the background. No piece has an added UI pedestal or circular base; details that belong to the source illustration remain part of its PNG.

`src/GameTokens.tsx` defines 72 local choices: 40 finished transparent figurines and 32 preview icons that will be replaced as the user supplies more contact sheets. The chosen ID is stored in this browser under `leader.gameToken`. The gallery offers search and category filters, with five large columns on wide screens and four on medium screens. Lucky cat is grouped under Mascot. A single click previews a piece; a double click or the “Use this piece” button selects it. Holding a piece for 350 ms doubles that same figure in place with a slow, slight wobble; release springs it back. No second figure or floating preview is created. The chosen piece beside Leader behaves the same way, and clicking it opens the gallery. All pieces work offline; no user content or selection is sent to an external service.

The conversion of each contact sheet into separate polished PNGs is a one-time asset preparation process outside Leader. Leader contains no image-splitting or generation workflow. See [GAME_PIECES_BATCHES.md](GAME_PIECES_BATCHES.md) for the source-to-file manifest and prompt set. Every finished file has a 1254×1254 transparent canvas with a similar figure scale; the gallery displays them through one shared image style.

## Tux cutout prompt

Use case: background-extraction. Input image is the exact hand-painted Tux penguin figurine provided. Remove only the pure black backdrop, producing a genuinely transparent PNG cutout. Preserve the penguin's exact pose, silhouette, proportions, face, orange feet, hand-painted glossy surface, subtle texture, and all original colors. Keep the black body opaque and clearly separated from transparent background. No pedestal, no cast shadow, no added objects or text. Center the complete figurine with a narrow transparent margin, square canvas.

See [GAME_PIECE_LIGHTING.md](GAME_PIECE_LIGHTING.md) for the pointer-directed lighting investigation.
