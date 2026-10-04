# Mouse-directed light for game pieces

All 60 finished pieces, including Tux, are transparent, hand-painted PNGs. Their highlights and shadows are baked into the pixels. They can respond to pointer position, but a flat image alone cannot reveal surfaces that were never modeled.

## Practical first experiment

Use `pointermove` on the large sidebar piece to express the pointer position as percentages of its bounding box. Update two CSS custom properties once per animation frame. A clipped radial gradient can create a small moving highlight; a softer opposite gradient and a changing drop shadow can suggest depth. Keep the gallery thumbnails static. On pointer leave, return to the default light position. Skip the effect for touch pointers and `prefers-reduced-motion`.

This is inexpensive and reversible, but Tux's existing painted reflections will remain fixed. The result should be judged visually before adding it to the app.

## More realistic lighting

For the PNG, a WebGL shader plus a manually reviewed normal map can calculate light per pixel. A normal map generated automatically from the single front view would only approximate the figurine's shape. A true 3D model (for example GLB) with a physically based material and a light tied to pointer position would give the most convincing result, including changing highlights on curved surfaces, but requires separate 3D assets for each piece and more rendering work.

Recommendation: prototype the CSS highlight only on the large selected piece first; move to normal maps or 3D only if the visual test shows a clear benefit.

References: [MDN pointermove](https://developer.mozilla.org/en-US/docs/Web/API/Element/pointermove_event), [MDN requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame), [MDN radial gradients](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/gradient/radial-gradient), [Three.js MeshStandardMaterial and normal maps](https://threejs.org/docs/pages/MeshStandardMaterial.html).
