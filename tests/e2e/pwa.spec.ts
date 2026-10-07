import { test, expect, BrowserContext, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";

const headers = { "X-Baxi-Request": "1" };
const baseURL = process.env.BAXI_BASE_URL || "http://127.0.0.1:4173";
async function post(context: BrowserContext, path: string, data: unknown) {
  const response = await context.request.post("/api" + path, { headers, data });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}
async function login(context: BrowserContext, role: string, phone: string) {
  const code = await post(context, "/auth/code", { phone });
  await post(context, "/auth/verify", { role, phone, code: code.demo_code });
}
async function accessible(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
}
async function screenshot(page: Page, name: string) {
  mkdirSync("docs/screenshots", { recursive: true });
  await page.screenshot({
    path: `docs/screenshots/${name}.png`,
    fullPage: true,
  });
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
}

test("minimal RTL login, manifest, offline shell and private cache boundary", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "سفر بعدی، ساده‌تر." }),
  ).toBeVisible();
  await accessible(page);
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await noOverflow(page);
  }
  await screenshot(page, "login-desktop");
  const manifest = await (
    await page.request.get("/manifest.webmanifest")
  ).json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.dir).toBe("rtl");
  for (const icon of manifest.icons)
    expect((await page.request.get(icon.src)).ok()).toBeTruthy();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("آفلاین هستید.", { exact: false })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "دریافت کد ورود" }),
  ).toBeDisabled();
  expect(
    await page.evaluate(async () => {
      const names = await caches.keys();
      const urls = (
        await Promise.all(
          names.map(async (n) =>
            (await (await caches.open(n)).keys()).map((r) => r.url),
          ),
        )
      ).flat();
      return urls.some((u) => new URL(u).pathname.startsWith("/api"));
    }),
  ).toBeFalsy();
  await context.setOffline(false);
});

test("passenger and driver complete a real persisted journey, rating and wallet", async ({
  page,
  context,
  browser,
}) => {
  await login(context, "client", "09120000010");
  // Clean only this dedicated synthetic account's unstarted requests on a rerun.
  for (const trip of await (await context.request.get("/api/history")).json())
    if (["requested", "accepted"].includes(trip.state))
      await post(context, `/requests/${trip.id}/cancel`, {});
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "کجا می‌ریم؟" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await accessible(page);
  await screenshot(page, "passenger-desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow(page);
  await screenshot(page, "passenger-mobile");
  await expect(
    page.getByRole("button", { name: "درخواست بکسی", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "درخواست بکسی", exact: true }).click();
  await expect(
    page.getByText("در انتظار راننده", { exact: true }),
  ).toBeVisible();
  const driverContext = await browser.newContext({
    baseURL,
  });
  try {
    await login(driverContext, "driver", "09120000030");
    const driver = await driverContext.newPage();
    await driver.goto("/");
    await driver.getByRole("button", { name: "شروع کار", exact: true }).click();
    await driver
      .getByRole("button", { name: "پذیرش درخواست", exact: true })
      .first()
      .click();
    await expect(
      driver.getByRole("button", { name: "شروع سفر", exact: true }),
    ).toBeEnabled();
    await screenshot(driver, "driver-desktop");
    await driver.getByRole("button", { name: "شروع سفر", exact: true }).click();
    await driver
      .getByRole("button", { name: "پایان سفر و تسویه", exact: true })
      .click();
    await expect(
      driver.getByRole("button", { name: "خروج از سرویس", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "کجا می‌ریم؟" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "سفرهای من", exact: true })
      .filter({ visible: true })
      .click();
    await page
      .getByRole("button", { name: "ثبت امتیاز", exact: false })
      .first()
      .click();
    await expect(
      page.getByText("امتیاز شما: ۵", { exact: false }).first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "کیف پول", exact: true })
      .filter({ visible: true })
      .click();
    await page.getByLabel("مبلغ، ریال").fill("10000");
    const before = (await (await context.request.get("/api/me")).json()).account
      .wallet_balance;
    const keys: string[] = [];
    await page.route("**/api/wallet/demo", async (route) => {
      keys.push(route.request().postDataJSON().key);
      const response = await route.fetch();
      expect(response.ok()).toBeTruthy();
      // The database commits, then the first response is lost in transit.
      if (keys.length === 1) await route.abort("failed");
      else await route.fulfill({ response });
    });
    await page
      .getByRole("button", { name: "شارژ آزمایشی", exact: false })
      .click();
    await expect(page.getByRole("alert")).toBeVisible();
    await page
      .getByRole("button", { name: "شارژ آزمایشی", exact: false })
      .click();
    await expect(page.getByText("با موفقیت ثبت شد.")).toBeVisible();
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    expect(
      (await (await context.request.get("/api/me")).json()).account
        .wallet_balance,
    ).toBe(before + 10000);
    await accessible(page);
    await screenshot(page, "wallet-mobile");
  } finally {
    await driverContext.close();
  }
});

test("driver onboarding, four documents, staff approval and keyboard installation help", async ({
  page,
  context,
  browser,
}) => {
  const phone = "09" + String(Math.floor(Math.random() * 1e9)).padStart(9, "0");
  const code = await post(context, "/auth/code", { phone });
  await post(context, "/auth/verify", {
    phone,
    code: code.demo_code,
    role: "driver",
    signup: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "مشخصات راننده" }),
  ).toBeVisible();
  const name = "آزمون " + Date.now();
  await page.getByLabel("نام", { exact: true }).fill(name);
  await page.getByLabel("نام خانوادگی", { exact: true }).fill("ساختگی");
  await page.getByLabel("نام وسیله", { exact: true }).fill("خودروی نمونه");
  await page.getByLabel("رنگ", { exact: true }).fill("سفید");
  await page.getByLabel("پلاک", { exact: true }).fill("E2E-" + Date.now());
  await page.getByLabel("کد ملی", { exact: true }).fill("0000000000");
  await page
    .getByLabel("شمارهٔ شبا", { exact: true })
    .fill("IR" + String(Date.now()).padStart(24, "0"));
  await page
    .getByRole("button", { name: "استفاده از مدارک ساختگی دمو" })
    .click();
  await noOverflow(page);
  await accessible(page);
  await page.getByRole("button", { name: "ساخت حساب", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "در انتظار بررسی", exact: true }),
  ).toBeVisible();
  const staffContext = await browser.newContext({
    baseURL,
  });
  try {
    await post(staffContext, "/auth/staff", {
      code: 9001,
      password: "BaxiDemo!2026",
    });
    const staff = await staffContext.newPage();
    await staff.goto("/");
    await staff.locator(".driver-row").filter({ hasText: name }).click();
    await expect(staff.locator(".document-previews img")).toHaveCount(4);
    await staff
      .getByRole("button", { name: "تأیید راننده", exact: false })
      .click();
    await expect(
      staff.getByText("بررسی مدارک با موفقیت ثبت شده است."),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "شروع کار", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "حساب من", exact: true })
      .filter({ visible: true })
      .click();
    await page.getByRole("button", { name: "نصب روی دستگاه" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await accessible(page);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  } finally {
    await staffContext.close();
  }
});

test("female service and cargo quotes stay responsive at narrow widths", async ({
  page,
  context,
}) => {
  await login(context, "client", "09120000020");
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "کجا می‌ریم؟" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "بانوان همراه رانندهٔ خانم" }).click();
  await expect(
    page.getByRole("button", { name: "درخواست بکسی بانوان" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "باکس بسته‌های سبک" }).click();
  await page.getByLabel("ارزش بار، ریال").fill("100000");
  await expect(
    page.getByText("شامل ۲٬۰۰۰ ریال بیمهٔ آزمایشی، معادل ۲٪ ارزش بار"),
  ).toBeVisible();
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await noOverflow(page);
  }
  await accessible(page);
});

test("staff documents and all twenty reports render without client-side errors", async ({
  page,
  context,
}) => {
  await post(context, "/auth/staff", { code: 9001, password: "BaxiDemo!2026" });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "بررسی رانندگان", exact: true }),
  ).toBeVisible();
  await page.locator(".driver-row").first().click();
  await expect(page.locator(".document-previews img").first()).toBeVisible();
  await accessible(page);
  await screenshot(page, "staff-desktop");
  await page
    .getByRole("button", { name: "گزارش‌ها", exact: true })
    .filter({ visible: true })
    .click();
  await expect(page.getByLabel("انتخاب گزارش").locator("option")).toHaveCount(
    20,
  );
  for (let i = 1; i <= 20; i++) {
    await page.getByLabel("انتخاب گزارش").selectOption(String(i));
    await expect(page.getByText("در حال دریافت گزارش")).toHaveCount(0);
    await expect(page.locator(".workspace .panel h2")).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
  }
  await page.setViewportSize({ width: 360, height: 800 });
  await noOverflow(page);
  await accessible(page);
  await page
    .getByRole("button", { name: "خروج از حساب", exact: true })
    .filter({ visible: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "سفر بعدی، ساده‌تر." }),
  ).toBeVisible();
});
