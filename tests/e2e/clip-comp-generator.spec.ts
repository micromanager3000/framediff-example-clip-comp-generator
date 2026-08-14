import { expect, test } from "@playwright/test";
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const exampleRoot = fileURLToPath(new URL("../../", import.meta.url));
const configFile = `${exampleRoot}src/config.ts`;
const collectionFile = `${exampleRoot}src/compositions/GardenSelects.clips.json`;
const assemblyTimelineFile = `${exampleRoot}src/compositions/Assembly.timeline.json`;
const generatedDirectory = `${exampleRoot}src/generated-clips`;
const exampleUrl = process.env.FRAMEDIFF_CLIP_EXAMPLE_URL ?? "http://127.0.0.1:4181/";
let originals: Record<string, string>;
let originalGeneratedFiles = new Set<string>();

test.beforeAll(async () => {
  originals = Object.fromEntries(await Promise.all([configFile, collectionFile, assemblyTimelineFile]
    .map(async (file) => [file, await readFile(file, "utf8")] as const)));
  originalGeneratedFiles = new Set(await readdir(generatedDirectory).catch(() => []));
});

test.afterAll(async () => {
  await Promise.all(Object.entries(originals).map(([file, text]) => writeFile(file, text)));
  const generatedFiles = await readdir(generatedDirectory).catch(() => []);
  await Promise.all(generatedFiles
    .filter((file) => !originalGeneratedFiles.has(file))
    .map((file) => rm(`${generatedDirectory}/${file}`, { force: true })));
});

test("creates visual clips without a transcript, transcribes, creates word clips, and reuses the edits", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(exampleUrl);

  await expect(page.locator(".clip-composition-workbench")).toBeVisible();
  await expect(page.locator(".clip-transcript-empty")).toContainText("No transcript yet");
  await expect(page.locator(".clip-filmstrip .video-frame-thumbnail")).toHaveCount(12);
  await expect(page.locator(".generated-clips-empty")).toContainText("No clips yet");

  await page.getByRole("tab", { name: "FRAME GRID" }).click();
  await expect(page.locator(".clip-frame-grid > button")).toHaveCount(16);
  await page.getByLabel("Select range on source timeline").fill("9.5");
  await expect(page.locator(".clip-range-readout")).toContainText("VISUAL RANGE");
  await page.getByRole("button", { name: "+ ADD CLIP" }).click();

  await expect.poll(async () => JSON.parse(await readFile(collectionFile, "utf8")).clips.length).toBe(1);
  const visualCollection = JSON.parse(await readFile(collectionFile, "utf8"));
  expect(visualCollection.clips[0].selectedWordIds).toEqual([]);
  expect(visualCollection.clips[0].originalRange[0]).toBeGreaterThan(2);
  expect(visualCollection.clips[0].originalRange[1]).toBeGreaterThan(visualCollection.clips[0].originalRange[0]);
  await expect(page.locator(".generated-clip-card")).toHaveCount(1);
  await expect(page.locator(".generated-clip-card .video-frame-thumbnail video")).toHaveCount(1);
  await expect.poll(() => page.locator(".generated-clip-card video").evaluate((video: HTMLVideoElement) => video.currentTime)).toBeGreaterThan(2);

  // Child creation changes the authored registry; reload after its HMR settles before the next write.
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.locator(".generated-clip-card")).toHaveCount(1);
  await page.getByRole("tab", { name: "TRANSCRIPT" }).click();
  await page.getByRole("button", { name: "TRANSCRIBE VIDEO" }).click();
  await expect(page.locator('[data-word-id="w13"]')).toBeVisible({ timeout: 15_000 });
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
  expect(transcribedCollection.words).toHaveLength(26);
  expect(transcribedCollection.clips[1]).toMatchObject({
    selectedWordIds: ["w13", "w14", "w15", "w16", "w17"],
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
