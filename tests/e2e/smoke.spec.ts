import { expect, test } from "@playwright/test";

const basePath = process.env.PLAYWRIGHT_BASE_PATH ?? "";
const internal = (pathname: string) => `${basePath}${pathname}`;

const routes = [
  ["home", "/"],
  ["region", "/regions/068-region/"],
  ["district", "/districts/159/"],
  ["candidate", "/candidates/c159-pensioners-a5d830e020/"],
  ["methodology", "/methodology/"],
  ["search", "/search/"],
  ["changes", "/changes/"],
  ["address", "/address/"],
] as const;

for (const [name, route] of routes) {
  test(`${name} route renders without runtime errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    const response = await page.goto(internal(route));
    expect(response?.ok()).toBe(true);
    await expect(page.locator("h1").first()).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("catalog search reveals a navigable result", async ({ page }) => {
  await page.goto(internal("/"));
  const search = page.getByLabel("Поиск по каталогу");
  await search.fill("Самарская область");
  const results = page.getByRole("region", { name: "Результаты поиска" });
  await expect(results).toBeVisible();
  const regionResult = results.locator(`a[href="${internal("/regions/068-region/")}"]`);
  await expect(regionResult).toBeVisible();
  await regionResult.click();
  await expect(page).toHaveURL(/\/regions\/068-region\/?$/);
});

test("unknown route renders the application 404", async ({ page }) => {
  const response = await page.goto(internal("/definitely-not-a-route/"));
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Страница не найдена" })).toBeVisible();
});

test("discovery filters persist in a shareable URL", async ({ page }) => {
  await page.goto(internal("/search/"));
  await page.getByLabel("Тип результата").selectOption("candidate");
  await page.getByLabel("Регион").selectOption("082-region");
  await page.getByLabel("Статус", { exact: true }).selectOption("registered");
  await page.getByLabel("Основание статуса").selectOption("decision");
  await page.getByRole("button", { name: "Применить и сохранить ссылку" }).click();
  await expect(page).toHaveURL(/type=candidate/);
  await expect(page).toHaveURL(/region=082-region/);
  await expect(page.getByText("Найдено: 16")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Статус", { exact: true })).toHaveValue("registered");
  await expect(page.getByText("Найдено: 16")).toBeVisible();
});

test("changes page exposes status transitions and source links", async ({ page }) => {
  await page.goto(internal("/changes/"));
  await expect(page.getByRole("heading", { name: "Изменения статусов" })).toBeVisible();
  await expect(page.locator(".change-row")).toHaveCount(16);
  await expect(page.locator(".change-row .source-link").first()).toHaveAttribute("href", /mosgorizbirkom/);
});

test("source-backed candidate separates evidence classes and direct links", async ({ page }) => {
  await page.goto(internal("/candidates/c201-united-russia-7940cb4d34/"));
  await expect(page.getByRole("heading", { name: "Проверенные сведения" })).toBeVisible();
  await expect(page.locator('[data-source-class="government_official"]')).toHaveCount(3);
  await expect(page.getByRole("link", { name: /Профиль Дмитрия Саблина/ })).toHaveAttribute("href", "https://duma.gov.ru/duma/persons/99109963/");
  await expect(page.getByRole("link", { name: /Вячеслав Володин поздравил/ })).toHaveAttribute("href", "https://duma.gov.ru/news/62604/");
});

test("candidate without enrichment shows truthful category-specific gaps", async ({ page }) => {
  await page.goto(internal("/candidates/c159-pensioners-a5d830e020/"));
  await expect(page.getByText("Биографические сведения ещё не проверены.")).toBeVisible();
  await expect(page.getByText("Проверенных публичных контактов нет.")).toBeVisible();
  await expect(page.getByText("Подтверждённых ресурсов пока нет.")).toBeVisible();
  await expect(page.getByText("Проверенных публикаций пока нет.")).toBeVisible();
});

test("address lookup falls back without fabricating an exact district", async ({ page }) => {
  await page.route("https://nominatim.openstreetmap.org/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ display_name: "Самара, Самарская область, Россия", lat: "53.1959", lon: "50.1002" }]) }));
  await page.goto(internal("/address/"));
  await page.getByLabel("Адрес или населённый пункт").fill("Самара");
  await page.getByRole("button", { name: "Найти" }).click();
  await expect(page.getByText("Точный округ не определён")).toBeVisible();
  await expect(page.getByText(/нет проверенной геометрии/)).toBeVisible();
  await expect(page.getByText("Округ № 159")).toBeVisible();
  await expect(page.getByText("Границы требуют проверки").first()).toBeVisible();
  await page.screenshot({ path: "docs/screenshots/address-desktop.png", fullPage: true });
});

test("address lookup remains usable on a mobile viewport", async ({ page }) => {
  await page.route("https://nominatim.openstreetmap.org/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ display_name: "Самара, Самарская область, Россия", lat: "53.1959", lon: "50.1002" }]) }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(internal("/address/"));
  await page.getByLabel("Адрес или населённый пункт").fill("Самара");
  await page.getByRole("button", { name: "Найти" }).click();
  await expect(page.getByText("Точный округ не определён")).toBeVisible();
  await page.screenshot({ path: "docs/screenshots/address-mobile.png", fullPage: true });
});

test("address lookup keeps local fallback on provider error", async ({ page }) => {
  await page.route("https://nominatim.openstreetmap.org/**", (route) => route.fulfill({ status: 503, body: "unavailable" }));
  await page.goto(internal("/address/"));
  await page.getByLabel("Адрес или населённый пункт").fill("Самара");
  await page.getByRole("button", { name: "Найти" }).click();
  await expect(page.getByText("Не удалось получить координаты", { exact: true })).toBeVisible();
  await expect(page.getByText("Округ № 159")).toBeVisible();
});

test("keyboard, reduced motion, labels, and responsive layouts remain accessible", async ({ page }) => {
  await page.goto(internal("/"));
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "К основному содержанию" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => page.locator(".desktop-nav a").first().evaluate((element) => parseFloat(getComputedStyle(element).transitionDuration))).toBeLessThanOrEqual(0.00001);
  await page.goto(internal("/"));
  await page.screenshot({ path: "docs/screenshots/final-home-desktop.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  for (const [, route] of [...routes, ["corrections", "/corrections/"] as const, ["not-found", "/definitely-not-a-route/"] as const]) {
    await page.goto(internal(route));
    await expect(page.locator("h1").first()).toBeVisible();
    const audit = await page.evaluate(() => {
      const controls = [...document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea")];
      const unlabelled = controls.filter((control) => !(
        control.getAttribute("aria-label")
        || control.getAttribute("aria-labelledby")
        || (control.id && document.querySelector(`label[for="${CSS.escape(control.id)}"]`))
        || control.closest("label")
      ));
      const unsafeBlankLinks = [...document.querySelectorAll<HTMLAnchorElement>('a[target="_blank"]')]
        .filter((link) => !/(^|\s)(noopener|noreferrer)(\s|$)/.test(link.rel));
      return {
        horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        mainCount: document.querySelectorAll("main").length,
        unlabelled: unlabelled.length,
        unsafeBlankLinks: unsafeBlankLinks.length,
      };
    });
    expect(audit).toEqual({ horizontalOverflow: 0, mainCount: 1, unlabelled: 0, unsafeBlankLinks: 0 });
  }
  await page.goto(internal("/candidates/c198-united-russia-52c3369c3e/"));
  await page.screenshot({ path: "docs/screenshots/final-candidate-mobile.png", fullPage: true });
});
