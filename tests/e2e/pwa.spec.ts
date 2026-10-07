import { test, expect, BrowserContext, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";

const headers = { "X-Baxi-Request": "1" };
const testSessions = new Map<
  string,
  Awaited<ReturnType<BrowserContext["cookies"]>>
>();
const baseURL = process.env.BAXI_BASE_URL || "http://127.0.0.1:4173";
// Never fetch public OSM tiles from automated panning/zooming tests.
test.beforeEach(async ({ context }) => {
  await context.route("https://tile.openstreetmap.org/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#f1f0ed"/><path d="M0 80H256M80 0V256M0 180H256M180 0V256" stroke="white" stroke-width="8"/><text x="16" y="40" fill="#645c70" font-size="12">TEST MAP TILE</text></svg>',
    }),
  );
});
async function chooseRoute(page: Page) {
  await expect(page.getByTestId("request-ride")).toHaveCount(0);
  await page.getByRole("button", { name: "تأیید مبدأ", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "تأیید مقصد", exact: true }),
  ).toBeDisabled();
  const before = await page
    .locator(".pin-selection")
    .getAttribute("data-longitude");
  await page.locator(".city-map").focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => page.locator(".pin-selection").getAttribute("data-longitude"))
    .not.toBe(before);
  await page.getByRole("button", { name: "تأیید مقصد", exact: true }).click();
}
async function post(context: BrowserContext, path: string, data: unknown) {
  const response = await context.request.post("/api" + path, { headers, data });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}
async function login(context: BrowserContext, role: string, phone: string) {
  const key = role + phone;
  const cached = testSessions.get(key);
  if (cached) {
    await context.addCookies(cached);
  } else {
    const code = await post(context, "/auth/code", { phone });
    await post(context, "/auth/verify", { role, phone, code: code.demo_code });
    testSessions.set(key, await context.cookies());
  }
  // Reruns spend demo balances. Top up only these dedicated synthetic accounts
  // through the normal idempotent demo API; never reset shared database rows.
  if (role === "client" && ["09120000010", "09120000020"].includes(phone)) {
    const me = await (await context.request.get("/api/me")).json();
    if (me.demo && me.account.wallet_balance < 2000000)
      await post(context, "/wallet/demo", {
        amount: 5000000 - me.account.wallet_balance,
        key: crypto.randomUUID().replaceAll("-", ""),
      });
  }
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
  mkdirSync("artifacts/screenshots", { recursive: true });
  await page.screenshot({
    path: `artifacts/screenshots/${name}.png`,
    fullPage: true,
  });
}

test("Tehran map selection uses the moved pin, rejects outside geolocation and allows editing", async ({
  page,
  context,
}) => {
  await login(context, "client", "09120000020");
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 34.798, longitude: 48.515 });
  await page.goto("/");
  await page.getByRole("button", { name: "استفاده از موقعیت من" }).click();
  await expect(page.getByRole("alert")).toContainText("خارج از تهران");
  const map = page.locator(".city-map");
  const before = await page
    .locator(".pin-selection")
    .getAttribute("data-longitude");
  await map.focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => page.locator(".pin-selection").getAttribute("data-longitude"))
    .not.toBe(before);
  const pickup = [
    Number(await page.locator(".pin-selection").getAttribute("data-latitude")),
    Number(await page.locator(".pin-selection").getAttribute("data-longitude")),
  ];
  await page.getByRole("button", { name: "تأیید مبدأ", exact: true }).click();
  await context.setGeolocation({ latitude: pickup[0], longitude: pickup[1] });
  await page.getByRole("button", { name: "استفاده از موقعیت من" }).click();
  await expect(page.getByText("مقصد باید با مبدأ متفاوت باشد.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "تأیید مقصد", exact: true }),
  ).toBeDisabled();
  await context.setGeolocation({ latitude: 35.7112, longitude: 51.3786 });
  await page.getByRole("button", { name: "استفاده از موقعیت من" }).click();
  const quoted = page.waitForRequest((request) =>
    request.url().endsWith("/api/quote"),
  );
  await page.getByRole("button", { name: "تأیید مقصد", exact: true }).click();
  const payload = (await quoted).postDataJSON();
  expect(payload.pickup[0]).toBeCloseTo(pickup[0], 6);
  expect(payload.pickup[1]).toBeCloseTo(pickup[1], 6);
  expect(payload.dropoff[1]).toBeCloseTo(51.3786, 6);
  await expect(
    page.getByRole("button", { name: "درخواست بکسی", exact: true }),
  ).toBeEnabled();
  await accessible(page);
  await page.getByRole("button", { name: "ویرایش مبدأ" }).click();
  await expect(page.getByTestId("request-ride")).toHaveCount(0);
  await accessible(page);
});
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
    page.getByRole("heading", { name: "مبدأ سفر کجاست؟" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await chooseRoute(page);
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
    await driverContext.route("https://tile.openstreetmap.org/**", (route) =>
      route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#eee"/></svg>',
      }),
    );
    const driver = await driverContext.newPage();
    await driver.goto("/");
    await driver
      .getByRole("button", { name: "تغییر موقعیت", exact: true })
      .click();
    await expect(driver.getByRole("dialog")).toBeVisible();
    await accessible(driver);
    await driver
      .getByRole("button", { name: "تأیید موقعیت راننده", exact: true })
      .click();
    await driver.getByRole("button", { name: "شروع کار", exact: true }).click();
    await expect(driver.getByText("دریافتی خالص شما").first()).toBeVisible();
    await expect(driver.getByText("کمیسیون بکسی").first()).toBeVisible();
    await driver
      .getByRole("button", { name: "پذیرش درخواست", exact: true })
      .first()
      .click();
    await expect(
      driver.getByRole("button", { name: "شروع سفر", exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByRole("heading", { name: "راننده سفرت را پذیرفت", exact: true }),
    ).toBeVisible();
    const assigned = (
      await (await context.request.get("/api/history")).json()
    ).find((trip: any) => trip.state === "accepted");
    await expect(page.locator(".vehicle-plate")).toContainText(
      assigned.vehicle_plate,
    );
    await expect(page.locator(".driver-identity h2")).toContainText(
      assigned.driver_first_name,
    );
    await accessible(page);
    await screenshot(driver, "driver-desktop");
    await driver.getByRole("button", { name: "شروع سفر", exact: true }).click();
    await driver
      .getByRole("button", { name: "پایان سفر و تسویه", exact: true })
      .click();
    await expect(
      driver.getByRole("button", { name: "خروج از سرویس", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "رسیدی؛ سفر تمام شد" }),
    ).toBeVisible();
    await page.getByRole("radio", { name: "۵ ستاره", exact: true }).check();
    await page.getByRole("button", { name: "ثبت امتیاز", exact: true }).click();
    await expect(
      page.getByText("امتیاز شما: ۵", { exact: false }).first(),
    ).toBeVisible();
    await accessible(page);
    await page
      .getByRole("button", { name: "کیف پول", exact: true })
      .filter({ visible: true })
      .click();
    await page.getByLabel("مبلغ، تومان").fill("10000");
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
    ).toBe(before + 100000);
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
    page.getByRole("heading", { name: "مبدأ سفر کجاست؟" }),
  ).toBeVisible();
  await chooseRoute(page);
  await page.getByRole("radio", { name: /بانوان همراه رانندهٔ خانم/ }).check();
  await expect(
    page.getByRole("button", { name: "درخواست بکسی بانوان" }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "ارسال بسته و بار", exact: true })
    .click();
  await page.getByLabel("ارزش اظهارشدهٔ بار، تومان").fill("100000");
  await expect(
    page.getByText(
      "ارزش بار صرفاً اظهار شماست؛ هزینهٔ بیمه دریافت نمی‌شود و پوشش بیمهٔ واقعی نداریم.",
    ),
  ).toBeVisible();
  await expect(page.getByTestId("request-ride")).toBeEnabled();
  const lightFare = await page.locator(".ride-total strong").innerText();
  await page.getByLabel("وزن بار، کیلوگرم").fill("6");
  await expect(page.getByTestId("request-ride")).toBeEnabled();
  await expect(page.locator(".ride-total strong")).not.toHaveText(lightFare);
  await page.getByText("جزئیات قیمت", { exact: true }).click();
  await expect(page.getByText("اضافهٔ وزن بار", { exact: true })).toBeVisible();
  await screenshot(page, "pricing-cargo-desktop");
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await noOverflow(page);
  }
  await accessible(page);
});

test("expired quote requires a fresh price and a separate confirmation", async ({
  page,
  context,
}) => {
  await login(context, "client", "09120000010");
  const start = new Date();
  await page.clock.install({ time: start });
  let quotes = 0;
  let bookings = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/requests")) bookings++;
  });
  await page.route("**/api/quote", async (route) => {
    const first = ++quotes <= 4;
    const response = await route.fetch();
    const value = await response.json();
    value.expires_at = new Date(
      start.getTime() + (first ? 2000 : 300000),
    ).toISOString();
    if (!first) value.cost += 100000;
    await route.fulfill({ json: value });
  });
  await page.goto("/");
  await chooseRoute(page);
  await expect(page.getByTestId("request-ride")).toBeEnabled();
  const original = await page.locator(".ride-total strong").innerText();
  await page.clock.fastForward(3000);
  await expect(page.getByTestId("request-ride")).toHaveText("دریافت قیمت تازه");
  await page.getByTestId("request-ride").click();
  await expect.poll(() => quotes).toBe(8);
  await expect(page.locator(".ride-total strong")).not.toHaveText(original);
  await expect(page.getByTestId("request-ride")).toHaveText(/درخواست بکسی/);
  expect(bookings).toBe(0);
  await accessible(page);
});

test("legacy wallet amounts retain fractional tomans", async ({
  page,
  context,
}) => {
  await login(context, "client", "09120000010");
  await page.route("**/api/me", async (route) => {
    const response = await route.fetch();
    const value = await response.json();
    value.account.wallet_balance = 123457;
    await route.fulfill({ json: value });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "کیف پول", exact: true })
    .filter({ visible: true })
    .click();
  await expect(page.locator(".wallet-card strong")).toHaveText("۱۲٬۳۴۵٫۷تومان");
  await expect(page.getByLabel("مبلغ، تومان")).toBeVisible();
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

test("explicit place search, viewport actions, payment choice, saved draft and reversible cancellation", async ({
  page,
  context,
}) => {
  await login(context, "client", "09120000020");
  let searches = 0;
  await page.route("**/api/places?*", (route) => {
    searches++;
    return route.fulfill({
      json: [{ label: "میدان انقلاب، تهران", point: [35.701, 51.391] }],
    });
  });
  await page.goto("/");
  await page.setViewportSize({ width: 360, height: 640 });
  await page.getByLabel("جست‌وجوی مکان در تهران").fill("میدان انقلاب");
  expect(searches).toBe(0);
  await page
    .getByRole("button", { name: "جست‌وجوی مکان", exact: true })
    .click();
  await page
    .getByRole("button", { name: "میدان انقلاب، تهران", exact: true })
    .click();
  expect(searches).toBe(1);
  for (const size of [
    { width: 360, height: 640 },
    { width: 390, height: 844 },
    { width: 768, height: 900 },
    { width: 1440, height: 1000 },
  ]) {
    await page.setViewportSize(size);
    await noOverflow(page);
    await expect(page.locator(".pin-selection")).toHaveAttribute(
      "data-longitude",
      "51.391",
    );
    const rect = await page
      .getByRole("button", { name: "تأیید مبدأ", exact: true })
      .boundingBox();
    expect(rect!.y).toBeGreaterThanOrEqual(0);
    expect(rect!.y + rect!.height).toBeLessThanOrEqual(size.height);
  }
  await chooseRoute(page);
  await expect(page.getByTestId("request-ride")).toBeEnabled();
  const draftQuotes: any[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/quote"))
      draftQuotes.push(request.postDataJSON());
  });
  await page
    .getByRole("button", { name: "کیف پول", exact: true })
    .filter({ visible: true })
    .click();
  await page
    .getByRole("button", { name: "سفر جدید", exact: true })
    .filter({ visible: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "انتخاب سرویس", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("request-ride")).toBeEnabled();
  expect(draftQuotes.at(-1).pickup).toEqual([35.701, 51.391]);
  await page
    .getByRole("button", { name: "تغییر روش پرداخت", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("radio", { name: /نقدی/ }).check();
  await accessible(page);
  await page
    .getByRole("button", { name: "تأیید روش پرداخت", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "تغییر روش پرداخت" }),
  ).toContainText("نقدی");
  for (const size of [
    { width: 360, height: 640 },
    { width: 390, height: 844 },
    { width: 768, height: 900 },
    { width: 1440, height: 1000 },
  ]) {
    await page.setViewportSize(size);
    await noOverflow(page);
    const rect = await page.getByTestId("request-ride").boundingBox();
    expect(rect!.y + rect!.height).toBeLessThanOrEqual(size.height);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("request-ride").click();
  await expect(
    page.getByRole("heading", { name: "در انتظار راننده", exact: true }),
  ).toBeVisible();
  const history = await (await context.request.get("/api/history")).json();
  const trip = history.find((trip: any) => trip.state === "requested");
  expect(trip.preferred_payment).toBe("cash");
  expect(trip.pickup_label).toBe("میدان انقلاب، تهران");
  await page.getByRole("button", { name: "لغو درخواست", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await accessible(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(
    (await (await context.request.get("/api/history")).json()).find(
      (t: any) => t.id === trip.id,
    ).state,
  ).toBe("requested");
  await page.getByRole("button", { name: "لغو درخواست", exact: true }).click();
  await page
    .getByRole("button", { name: "بله، لغو درخواست", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "مبدأ سفر کجاست؟" }),
  ).toBeVisible();
  expect(
    (await (await context.request.get("/api/history")).json()).find(
      (t: any) => t.id === trip.id,
    ).state,
  ).toBe("cancelled");
});

test("late quotes cannot overwrite a new fare and wallet shortfall has a cash recovery", async ({
  page,
  context,
}) => {
  await login(context, "client", "09120000010");
  await page.route("**/api/me", async (route) => {
    const response = await route.fetch();
    const value = await response.json();
    value.account.wallet_balance = 0;
    await route.fulfill({ json: value });
  });
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let count = 0,
    delivered = 0;
  await page.route("**/api/quote", async (route) => {
    const first = ++count <= 4;
    if (first) await held;
    await route.fulfill({
      json: {
        cost: first ? 1110000 : 2220000,
        km: 1,
        quote_id: "a".repeat(32),
        expires_at: new Date(Date.now() + 300000).toISOString(),
        breakdown: [],
        policy_version: "test",
      },
    });
    delivered++;
  });
  try {
    await page.goto("/");
    await chooseRoute(page);
    await expect.poll(() => count).toBe(4);
    await page.getByRole("checkbox", { name: /رفت و برگشت/ }).check();
    await expect(page.locator(".ride-total strong")).toContainText("۲۲۲٬۰۰۰");
    release();
    await expect.poll(() => delivered).toBe(8);
    await expect(page.locator(".ride-total strong")).toContainText("۲۲۲٬۰۰۰");
    await expect(page.getByTestId("request-ride")).toBeDisabled();
    await expect(page.getByRole("alert")).toContainText("موجودی کافی نیست");
    await page
      .getByRole("button", { name: "تغییر روش پرداخت", exact: true })
      .click();
    await page.getByRole("radio", { name: /نقدی/ }).check();
    await page
      .getByRole("button", { name: "تأیید روش پرداخت", exact: true })
      .click();
    await expect(page.getByTestId("request-ride")).toBeEnabled();
    await expect(page.getByRole("radio", { name: /بانوان/ })).toBeDisabled();
    await accessible(page);
  } finally {
    release();
  }
});
