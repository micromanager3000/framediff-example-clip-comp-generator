import { expect, test } from "@playwright/test";
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const exampleRoot = fileURLToPath(new URL("../../", import.meta.url));
const configFile = `${exampleRoot}src/config.ts`;
const collectionFile = `${exampleRoot}src/compositions/GardenSelects.clips.json`;
const assemblyTimelineFile = `${exampleRoot}src/compositions/Assembly.timeline.json`;
const assetManifestFile = `${exampleRoot}framediff.assets.json`;
const assetsDirectory = `${exampleRoot}assets`;
const sourceVideoFile = `${exampleRoot}static/garden-observation.mp4`;
const generatedDirectory = `${exampleRoot}src/generated-clips`;
const creationSmokeHtmlFile = `${exampleRoot}src/ClipCreateSmoke.html`;
const creationSmokeFiles = [
  creationSmokeHtmlFile,
  `${exampleRoot}src/ClipCreateSmoke.ts`,
  `${exampleRoot}src/ClipCreateSmoke.comp.json`,
  `${exampleRoot}src/ClipCreateSmoke.schema.json`,
  `${exampleRoot}src/ClipCreateSmoke.timeline.json`,
];
const exampleUrl = process.env.FRAMEDIFF_CLIP_EXAMPLE_URL ?? "http://127.0.0.1:4181/";
let originals: Record<string, string>;
let originalGeneratedFiles = new Set<string>();
let originalAssetFiles = new Set<string>();

test.beforeAll(async () => {
  originals = Object.fromEntries(await Promise.all([configFile, collectionFile, assemblyTimelineFile, assetManifestFile]
    .map(async (file) => [file, await readFile(file, "utf8")] as const)));
  originalGeneratedFiles = new Set(await readdir(generatedDirectory).catch(() => []));
  originalAssetFiles = new Set(await readdir(assetsDirectory).catch(() => []));
});

test.afterEach(async () => {
  await Promise.all(Object.entries(originals).map(([file, text]) => writeFile(file, text)));
  await Promise.all(creationSmokeFiles.map((file) => rm(file, { force: true })));
  const generatedFiles = await readdir(generatedDirectory).catch(() => []);
  await Promise.all(generatedFiles
    .filter((file) => !originalGeneratedFiles.has(file))
    .map((file) => rm(`${generatedDirectory}/${file}`, { force: true })));
  const assetFiles = await readdir(assetsDirectory).catch(() => []);
  await Promise.all(assetFiles
    .filter((file) => !originalAssetFiles.has(file))
    .map((file) => rm(`${assetsDirectory}/${file}`, { force: true })));
});

test("prefills the composition name and creates the selected starter", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(exampleUrl);
  await page.getByRole("button", { name: "Create a new composition" }).click();

  const dialog = page.getByRole("dialog", { name: "New composition" });
  const name = dialog.getByRole("textbox", { name: "Name" });
  const create = dialog.getByRole("button", { name: "Create", exact: true });
  await expect(name).toHaveValue("TitleCard");
  await expect(create).toBeEnabled();
  await expect(dialog.getByText("Duration", { exact: true })).toHaveCount(0);
  await expect(dialog.locator('input[type="number"]')).toHaveCount(0);

  await dialog.getByText("Clip", { exact: true }).click();
  await expect(name).toHaveValue("Selects");
  await name.fill("ClipCreateSmoke");
  await dialog.getByText("Scene", { exact: true }).click();
  await expect(name).toHaveValue("ClipCreateSmoke");
  await dialog.getByText("Clip", { exact: true }).click();
  await create.click();

  await expect(dialog).toBeHidden();
  await expect(page.locator('.composition-row[data-composition-key="clip-create-smoke"]')).toBeVisible();
  await expect.poll(async () => readFile(configFile, "utf8")).toContain('"clip-create-smoke"');
  await expect.poll(async () => readFile(creationSmokeHtmlFile, "utf8")).toContain('data-fd-duration="150"');
});

test("creates visual clips without a transcript, transcribes, creates word clips, and reuses the edits", async ({ page }) => {
  const errors: string[] = [];
  const requestedModels: string[] = [];
  await page.setViewportSize({ width: 1440, height: 1000 });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/__framediff/transcribe?**", async (route) => {
    const model = new URL(route.request().url()).searchParams.get("model") ?? "";
    requestedModels.push(model);
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ words: model === "scribe_v1" ? [
        { id: "legacy-1", text: "A", start: 4, end: 4.2 },
        { id: "legacy-2", text: "legacy", start: 4.2, end: 4.6 },
        { id: "legacy-3", text: "take", start: 4.6, end: 5 },
      ] : [
        { id: "w13", text: "Tiny", start: 8.33, end: 8.55 },
        { id: "w14", text: "changes", start: 8.55, end: 8.82 },
        { id: "w15", text: "in", start: 8.82, end: 9.02 },
        { id: "w16", text: "color", start: 9.02, end: 9.31 },
        { id: "w17", text: "move", start: 9.31, end: 9.63 },
      ] }),
    });
  });
  await page.goto(exampleUrl);

  await expect(page.locator(".clip-composition-workbench")).toBeVisible();
  await expect(page.getByRole("button", { name: "CODE", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Collapse right panel" }).click();
  await expect(page.locator(".framediff-studio")).toHaveClass(/right-collapsed/);
  await expect(page.locator(".right-panel")).toBeHidden();
  await page.getByRole("button", { name: "Open Inspector panel" }).click();
  await expect(page.locator(".right-panel")).toBeVisible();
  await page.getByRole("button", { name: "Collapse left panel" }).click();
  await expect(page.locator(".framediff-studio")).toHaveClass(/left-collapsed/);
  await expect(page.locator(".left-panel")).toBeHidden();
  await page.getByRole("button", { name: "Open compositions and media" }).click();
  await expect(page.locator(".left-panel")).toBeVisible();
  await expect(page.locator(".clip-transcript-empty")).toContainText("No transcript yet");
  await expect(page.locator(".clip-source-filmstrip .video-frame-thumbnail")).toHaveCount(12);
  await expect(page.locator(".generated-clips-empty")).toContainText("No clips yet");
  await expect(page.getByRole("button", { name: "+ ADD CLIP" })).toHaveCount(0);

  const playerBeforeResize = await page.locator(".clip-source-player-shell").boundingBox();
  const browserSplitter = page.getByTestId("clip-browser-splitter");
  const browserSplitterBox = await browserSplitter.boundingBox();
  expect(playerBeforeResize).not.toBeNull();
  expect(browserSplitterBox).not.toBeNull();
  await page.mouse.move(browserSplitterBox!.x + browserSplitterBox!.width / 2, browserSplitterBox!.y + browserSplitterBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(browserSplitterBox!.x + browserSplitterBox!.width / 2, browserSplitterBox!.y + 44, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => (await page.locator(".clip-source-player-shell").boundingBox())?.height ?? 0).toBeGreaterThan(playerBeforeResize!.height + 20);

  const sourceBrowserBeforeResize = await page.locator(".clip-source-browser").boundingBox();
  const clipsSplitter = page.getByTestId("clip-clips-splitter");
  const clipsSplitterBox = await clipsSplitter.boundingBox();
  expect(sourceBrowserBeforeResize).not.toBeNull();
  expect(clipsSplitterBox).not.toBeNull();
  await page.mouse.move(clipsSplitterBox!.x + clipsSplitterBox!.width / 2, clipsSplitterBox!.y + clipsSplitterBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(clipsSplitterBox!.x + clipsSplitterBox!.width / 2, clipsSplitterBox!.y - 44, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => (await page.locator(".clip-source-browser").boundingBox())?.height ?? 0).toBeLessThan(sourceBrowserBeforeResize!.height - 20);

  await page.locator('input[type="file"][accept="video/*"]').setInputFiles(sourceVideoFile);
  await expect.poll(async () => JSON.parse(await readFile(assetManifestFile, "utf8")).assets).not.toEqual({});
  await expect.poll(async () => JSON.parse(await readFile(collectionFile, "utf8")).source.assetId).toBeTruthy();
  await expect(page.locator(".clip-browser-header")).toContainText("garden-observation.mp4");
  const importedAssetId = JSON.parse(await readFile(collectionFile, "utf8")).source.assetId as string;
  await page.getByRole("button", { name: "MEDIA", exact: true }).click();
  await page.locator(`.asset-row[title*="asset://${importedAssetId}"]`).dragTo(page.locator(".clip-source-player-shell"));
  await expect.poll(async () => JSON.parse(await readFile(collectionFile, "utf8")).source.assetId).toBe(importedAssetId);
  await page.getByRole("button", { name: "COMPS", exact: true }).click();

  await page.getByRole("tab", { name: "FRAME GRID" }).click();
  await expect(page.locator(".clip-frame-grid > button")).toHaveCount(16);
  const filmstrip = page.getByTestId("clip-source-timeline");
  const filmstripBox = await filmstrip.boundingBox();
  expect(filmstripBox).not.toBeNull();
  await page.mouse.move(filmstripBox!.x + filmstripBox!.width * .56, filmstripBox!.y + filmstripBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(filmstripBox!.x + filmstripBox!.width * .78, filmstripBox!.y + filmstripBox!.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator(".clip-range-readout")).toContainText("VISUAL RANGE");
  await expect(page.getByRole("button", { name: "+ ADD CLIP" })).toBeVisible();
  await page.locator(".clip-browser-header").click();
  await expect(page.locator(".clip-range-selection")).toHaveCount(0);
  await expect(page.locator(".clip-frame-grid > button.selected")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "+ ADD CLIP" })).toHaveCount(0);
  await page.mouse.move(filmstripBox!.x + filmstripBox!.width * .56, filmstripBox!.y + filmstripBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(filmstripBox!.x + filmstripBox!.width * .78, filmstripBox!.y + filmstripBox!.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole("button", { name: "+ ADD CLIP" })).toBeVisible();
  await page.getByRole("button", { name: "+ ADD CLIP" }).click();

  await expect.poll(async () => JSON.parse(await readFile(collectionFile, "utf8")).clips.length).toBe(1);
  const visualCollection = JSON.parse(await readFile(collectionFile, "utf8"));
  expect(visualCollection.clips[0].selectedWordIds).toEqual([]);
  expect(visualCollection.clips[0].originalRange[0]).toBeGreaterThan(2);
  expect(visualCollection.clips[0].originalRange[1]).toBeGreaterThan(visualCollection.clips[0].originalRange[0]);
  await expect(page.locator(".generated-clip-card")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "+ ADD CLIP" })).toHaveCount(0);
  await expect(page.locator(".generated-clip-card .video-frame-thumbnail video")).toHaveCount(1);
  await expect.poll(() => page.locator(".generated-clip-card video").evaluate((video: HTMLVideoElement) => video.currentTime)).toBeGreaterThan(2);

  // Child creation changes the authored registry; reload after its HMR settles before the next write.
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.locator(".generated-clip-card")).toHaveCount(1);
  await page.getByRole("tab", { name: "TRANSCRIPT" }).click();
  const model = page.getByRole("combobox", { name: "Transcription model" });
  await expect(model).toHaveValue("scribe_v2");
  await expect(page.locator(".clip-transcription-estimate")).toContainText("<$0.01 estimated");
  await expect(page.locator(".clip-transcription-estimate")).toContainText("$0.22/hour");
  await page.getByRole("button", { name: /TRANSCRIBE TAKE/ }).click();
  await expect(page.locator('[data-word-id="w13"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /TAKE 1.*Scribe v2.*IN USE/ })).toBeVisible();
  await model.selectOption("scribe_v1");
  await expect(page.locator(".clip-transcription-estimate")).toContainText("Estimate unavailable");
  await page.getByRole("button", { name: /TRANSCRIBE TAKE/ }).click();
  await expect(page.locator('[data-word-id="legacy-1"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /TAKE 2.*Scribe v1.*IN USE/ })).toBeVisible();
  await page.getByRole("button", { name: /TAKE 1.*Scribe v2/ }).click();
  await expect.poll(async () => JSON.parse(await readFile(collectionFile, "utf8")).activeTranscriptTakeId).toBe("transcript-take-1");
  await page.waitForTimeout(500);
  await browserSplitter.press("ArrowUp");
  await browserSplitter.press("ArrowUp");
  await browserSplitter.press("ArrowUp");
  await expect(page.locator('[data-word-id="w13"]')).toBeVisible();
  expect(requestedModels).toEqual(["scribe_v2", "scribe_v1"]);
  const first = page.locator('[data-word-id="w13"]');
  const last = page.locator('[data-word-id="w17"]');
  const firstBox = await first.boundingBox();
  const lastBox = await last.boundingBox();
  expect(firstBox).not.toBeNull();
  expect(lastBox).not.toBeNull();
  await page.mouse.move(firstBox!.x + firstBox!.width / 2, firstBox!.y + firstBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(lastBox!.x + lastBox!.width / 2, lastBox!.y + lastBox!.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator(".clip-range-actions blockquote")).toContainText("Tiny changes in color move");
  await page.getByRole("button", { name: "+ ADD CLIP" }).click();

  await expect.poll(async () => JSON.parse(await readFile(collectionFile, "utf8")).clips.length).toBe(2);
  const transcribedCollection = JSON.parse(await readFile(collectionFile, "utf8"));
  expect(transcribedCollection.words).toHaveLength(5);
  expect(transcribedCollection.transcriptTakes).toHaveLength(2);
  expect(transcribedCollection.activeTranscriptTakeId).toBe("transcript-take-1");
  expect(transcribedCollection.clips[1]).toMatchObject({
    selectedWordIds: ["w13", "w14", "w15", "w16", "w17"],
    transcriptTakeId: "transcript-take-1",
    originalRange: [8.33, 9.63],
    workingRange: [8.33, 9.63],
  });
  await expect(page.locator(".generated-clip-card")).toHaveCount(2);

  const transcriptKey = transcribedCollection.clips[1].compositionKey as string;
  const generatedRow = page.locator(`.composition-row[data-composition-key="${transcriptKey}"]`);
  await expect(generatedRow).toBeVisible({ timeout: 20_000 });
  await expect(generatedRow.locator(".ref-role")).toHaveText("CLIP");
  await generatedRow.click();
  const sourceClip = page.locator('.timeline .clip[data-item-id="source"]');
  await expect(sourceClip).toBeVisible();
  const leftHandle = sourceClip.locator(".trim-handle.left");
  const handleBox = await leftHandle.boundingBox();
  expect(handleBox).not.toBeNull();
  await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox!.x - 36, handleBox!.y + handleBox!.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => JSON.parse(await readFile(collectionFile, "utf8")).clips[1]?.workingRange[0]).toBeLessThan(8.33);

  await page.locator('.composition-row[data-composition-key="garden-selects"]').click();
  await expect(page.locator(".generated-clip-card em").nth(1)).toContainText("SOURCE");
  await page.locator('.composition-row[data-composition-key="assembly"]').click();
  await generatedRow.dragTo(page.locator(".timeline .tl-scroll"), { targetPosition: { x: 280, y: 130 } });
  await expect(page.locator(".timeline .clip-label").filter({ hasText: transcribedCollection.clips[1].compositionKey.split("-").map((part: string) => part[0].toUpperCase() + part.slice(1)).join("") })).toBeVisible();
  expect(errors).toEqual([]);
});
