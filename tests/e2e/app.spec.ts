import { test, expect } from "@playwright/test";
test("logs, recovers offline, finishes, corrects history and exports/restores", async ({
  page,
  context,
}) => {
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Your next rep starts here." }),
  ).toBeVisible();
  await page.getByRole("button", { name: /A UP NEXT/ }).click();
  await page
    .getByRole("button", { name: "Complete set 1", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reopen set 1", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "A — Push", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reopen set 1", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Reopen set 1", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".exercise-image img")
        .first()
        .evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
        ),
    )
    .toBe(true);
  await page
    .getByRole("button", { name: "Complete set 2", exact: true })
    .click();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Finish workout", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your training, recorded." }),
  ).toBeVisible();
  await page.getByRole("button", { name: /A — Push.*completed sets/ }).click();
  if (
    !(await page
      .getByRole("button", { name: "Decrease reps", exact: true })
      .first()
      .isVisible())
  )
    await page.getByRole("button", { name: /01 Incline Dumbbell/ }).click();
  await page
    .getByRole("button", { name: "Decrease reps", exact: true })
    .first()
    .click();
  await expect(page.locator(".stepper b").first()).toHaveText("11");
  await page
    .getByRole("button", { name: "History", exact: true })
    .first()
    .click();
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "Settings" })
    .click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export all data" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/reptrack-backup/);
  const path = await file.path();
  expect(path).toBeTruthy();
  await page.locator("input[type=file]").first().setInputFiles(path!);
  await expect(
    page.getByRole("heading", { name: "Backup ready for review" }),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Merge new records" }).click();
  await expect(page.getByRole("status")).toContainText("Merged successfully");
  await context.setOffline(false);
});
test("customization persists and malformed imports do not replace data", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "Settings" })
    .click();
  await page
    .getByRole("button", { name: "Move Barbell Bench Press up" })
    .click();
  await expect(page.locator(".template-exercises li").first()).toContainText(
    "Barbell Bench Press",
  );
  await page.reload();
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "Settings" })
    .click();
  await expect(page.locator(".template-exercises li").first()).toContainText(
    "Barbell Bench Press",
  );
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "broken.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"version":100}'),
    });
  await expect(page.getByRole("alert")).toContainText("Backup rejected");
  await expect(page.locator(".library-item")).toHaveCount(19);
});
test("saving failures are visible and transactions preserve the last saved state", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: /A UP NEXT/ }).click();
  await expect(
    page.getByRole("button", { name: "Complete set 1", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("Test: storage is full", "QuotaExceededError");
    };
  });
  await page
    .getByRole("button", { name: "Complete set 1", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Could not save");
  await expect(
    page.getByRole("button", { name: "Complete set 1", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Complete set 1", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("0 of 18 sets logged · 6 exercises"),
  ).toBeVisible();
});
test("configured progression requires confirmation and leaves session targets intact", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: /A UP NEXT/ }).click();
  await page
    .getByRole("button", { name: "Details for Incline Dumbbell Press (bar)" })
    .click();
  await page.getByRole("button", { name: "Edit exercise settings" }).click();
  await page.getByLabel("Weight increment (kg)", { exact: true }).fill("2.3");
  await page.getByRole("button", { name: "Save exercise settings" }).click();
  await expect(
    page.getByLabel("Weight increment (kg)", { exact: true }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  for (let i = 1; i <= 3; i++) {
    await page
      .getByRole("button", { name: `Complete set ${i}`, exact: true })
      .click();
    if (i < 3)
      await expect(
        page.getByRole("button", { name: `Reopen set ${i}`, exact: true }),
      ).toBeVisible();
  }
  await page
    .getByRole("button", { name: /Incline Dumbbell Press.*Ready to progress/ })
    .click();
  await expect(page.getByText("5 → 7.3 kg", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Increase next time", exact: true })
    .click();
  await expect(
    page.getByText("Your updated weight is saved for next time."),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Weight for set 1" }),
  ).toHaveValue("5");
  await page
    .getByRole("button", { name: "Details for Incline Dumbbell Press (bar)" })
    .click();
  await expect(page.locator(".detail-stats").first()).toContainText("7.3");
  await expect(page.locator(".legacy-note")).toContainText("5 kg");
});

test("Pages installation metadata and assets stay inside the deployment path", async ({
  page,
  baseURL,
}) => {
  await page.goto("./");
  const base = new URL(baseURL!);
  const manifestUrl = await page
    .locator('link[rel="manifest"]')
    .getAttribute("href");
  const manifestResponse = await page.request.get(
    new URL(manifestUrl!, base).href,
  );
  const manifest = await manifestResponse.json();
  expect(new URL(manifest.start_url, base).pathname).toBe(base.pathname);
  expect(new URL(manifest.scope, base).pathname).toBe(base.pathname);
  for (const icon of manifest.icons) {
    const url = new URL(icon.src, base);
    expect(url.pathname.startsWith(base.pathname)).toBe(true);
    const result = await page.request.get(url.href);
    expect(result.headers()["content-type"]).toContain("image/png");
  }
  const apple = await page
    .locator('link[rel="apple-touch-icon"]')
    .getAttribute("href");
  expect(new URL(apple!, base).pathname).toBe(
    `${base.pathname}apple-touch-icon.png`,
  );
  await expect
    .poll(() =>
      page
        .locator(".workout-art img")
        .evaluateAll((imgs: HTMLImageElement[]) =>
          imgs.every((img) => img.complete && img.naturalWidth > 0),
        ),
    )
    .toBe(true);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  const scope = await page.evaluate(
    async () => (await navigator.serviceWorker.ready).scope,
  );
  expect(new URL(scope).pathname).toBe(base.pathname);
});

test("decimal weights apply to every set and survive reload", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: /A UP NEXT/ }).click();
  const weight = page.getByRole("textbox", {
    name: "Weight for set 1",
    exact: true,
  });
  await weight.fill("7.5");
  await weight.press("Tab");
  await expect(
    page.getByRole("textbox", { name: "Weight for set 3" }),
  ).toHaveValue("7.5");
  await weight.fill("8,25");
  await weight.press("Tab");
  await expect(
    page.getByRole("textbox", { name: "Weight for set 2" }),
  ).toHaveValue("8.25");
  await page.reload();
  for (let i = 1; i <= 3; i++)
    await expect(
      page.getByRole("textbox", { name: `Weight for set ${i}`, exact: true }),
    ).toHaveValue("8.25");
});

test("switches routines and protects logged sets before replacing a workout", async ({
  page,
}) => {
  await page.goto("./");
  await page.locator(".workout-choice").filter({ hasText: "Pull" }).click();
  await page.getByRole("button", { name: "All workouts", exact: true }).click();
  await page.locator(".workout-choice").filter({ hasText: "Push" }).click();
  await expect(
    page.getByRole("heading", { name: "A — Push", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Complete set 1", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reopen set 1", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "All workouts", exact: true }).click();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.locator(".workout-choice").filter({ hasText: "Pull" }).click();
  await page.locator(".resume-banner").click();
  await expect(
    page.getByRole("button", { name: "Reopen set 1", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "All workouts", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator(".workout-choice").filter({ hasText: "Pull" }).click();
  await expect(
    page.getByRole("heading", { name: "B — Pull", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "B — Pull", exact: true }),
  ).toBeVisible();
});

test("history corrections persist and deletion supports cancel and undo", async ({
  page,
}) => {
  await page.goto("./");
  await page.locator(".workout-choice").filter({ hasText: "Push" }).click();
  await page
    .getByRole("button", { name: "Complete set 1", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reopen set 1", exact: true }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Finish workout", exact: true })
    .click();
  await page.getByRole("button", { name: /A — Push.*completed sets/ }).click();
  await page
    .getByRole("button", { name: "Decrease reps", exact: true })
    .first()
    .click();
  await expect(page.locator(".stepper b").first()).toHaveText("11");
  await page.reload();
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "History" })
    .click();
  await page.getByRole("button", { name: /A — Push.*completed sets/ }).click();
  await expect(page.locator(".stepper b").first()).toHaveText("11");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("button", { name: "Delete workout", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A — Push", exact: true }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Delete workout", exact: true })
    .click();
  await expect(page.getByText("Your story starts with one set.")).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: /A — Push.*completed sets/ }).click();
  await expect(page.locator(".stepper b").first()).toHaveText("11");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Delete workout", exact: true })
    .click();
  await expect(page.getByText("Your story starts with one set.")).toBeVisible();
  await page.reload();
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "History" })
    .click();
  await expect(page.getByText("Your story starts with one set.")).toBeVisible();
});
