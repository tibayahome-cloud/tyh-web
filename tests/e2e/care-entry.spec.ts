import { expect, test } from "@playwright/test";

for (const width of [320, 390, 768, 1440]) {
  test(`care entry layouts and routes at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/v1/**", async route => {
      const path = new URL(route.request().url()).pathname;
      const data = path.endsWith("/auth/me") ? {
        id: "preview-client", full_name: "Review Client", roles: ["client"],
        country_code: "KE", phone: "+254700000001", permissions: []
      } : [];
      await route.fulfill({ json: { data, meta: { legal_consent: { required: false, complete: true, documents: [] } } } });
    });
    await page.goto("/");
    const hero = page.locator("section").first();
    const photo = hero.locator("img");
    await expect(photo).toBeVisible();
    await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    const dimensions = await photo.boundingBox();
    expect(dimensions!.width / dimensions!.height).toBeCloseTo(4 / 3, 1);
    await expect(hero.getByRole("button", { name: "Talk to a Doctor Online", exact: true })).toBeVisible();
    await expect(hero.getByRole("button", { name: "Book Home Care", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`landing-${width}.png`) });

    await page.evaluate(() => {
      localStorage.setItem("tiba.auth.tokens", JSON.stringify({ accessToken: "preview", refreshToken: "preview", persist: true }));
      localStorage.setItem("tiba.auth.user", JSON.stringify({ id: "preview-client", fullName: "Review Client", roles: ["client"], permissions: [], countryCode: "KE" }));
    });
    await page.goto("/app/home");
    const care = page.getByRole("region", { name: "Choose your care" });
    await expect(care).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`client-${width}.png`) });
    await care.getByRole("button", { name: /Talk to a Doctor Online/ }).click();
    await expect(page).toHaveURL(/\/app\/telemedicine$/);
    await page.goto("/app/home");
    await care.getByRole("button", { name: /Book Home Care/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
}
