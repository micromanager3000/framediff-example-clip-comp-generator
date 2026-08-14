# Clip Comp Generator

This focused example starts with one untranscribed Clip composition and one empty Edit composition.

1. Open `Garden Selects`.
2. Drag across the source filmstrip or switch to **Frame grid** to make a visual selection without a transcript.
3. Choose **Add clip**, or choose **Transcribe video** to populate word timings from the example's mock provider.
4. Drag across contiguous transcript words and add another clip.
5. Open a generated Edit comp beneath `Garden Selects` in the composition rail.
6. Drag either timeline edge to expand the working source range, or drag the generated Edit comp into `Assembly`.

The provider hook is public and provider-neutral. This example returns a fabricated normalized transcript after a short delay; the bundled garden video stays local, so no upload or paid API request occurs.

```sh
npm run dev --workspace @framediff/example-clip-comp-generator -- --host 0.0.0.0
```
