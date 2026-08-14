# Clip Comp Generator

This focused example starts with one Clip composition and one empty Edit composition.

1. Open `Garden Selects`.
2. Drag across contiguous transcript words.
3. Preview the exact clip-local range and choose **Add clip**.
4. Open the generated Edit comp beneath `Garden Selects` in the composition rail.
5. Drag either timeline edge to expand the working source range, or drag the generated Edit comp into `Assembly`.

The transcript is a fabricated normalized fixture. The bundled garden video is local, so no upload or transcription API is required.

```sh
npm run dev --workspace @framediff/example-clip-comp-generator -- --host 0.0.0.0
```
