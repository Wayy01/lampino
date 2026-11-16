// Admin: order status changes move stock, the shipment dialog renders (never
// submitted — that would mint a real waybill), the delivery card edits the
// row checkout charges, and Ligatto agents can be created.
import type { Page } from "@playwright/test";
import { Prisma } from "../lib/generated/prisma";
import { test, expect } from "./fixtures";
import { E2E, cleanupOrders, fixtures, prisma, stockOf } from "./db";

test.use({ storageState: "e2e/.auth/admin.json" });

let plain: Awaited<ReturnType<typeof fixtures>>["plain"];

test.beforeAll(async () => {
  ({ plain } = await fixtures());
});

test.afterAll(async () => {
  await cleanupOrders();
  await prisma.ligattoAgent.deleteMany({ where: { name: { startsWith: "e2e-" } } });
  await prisma.$disconnect();
});

/** A pending storefront order, as checkout leaves it. */
async function pendingOrder(quantity: number, extra: Partial<Prisma.OrderCreateInput> = {}) {
  return prisma.order.create({
    data: {
      customerName: `${E2E} admin`,
      customerEmail: "contact@lampino.md",
      customerPhone: "+373 60 000 060",
      status: "pending",
      stockReserved: false,
      deliveryMethod: "pickup",
      totalPrice: new Prisma.Decimal(Number(plain.price) * quantity),
      items: { create: [{ productId: plain.id, quantity, priceEach: plain.price }] },
      ...extra,
    },
  });
}

async function setStatus(page: Page, label: string) {
  await page.getByRole("combobox", { name: "Status" }).click();
  await page.getByRole("option", { name: label }).click();
  await page.getByRole("button", { name: "Actualizează" }).click();
}

test.describe("pages", () => {
  for (const path of [
    "/admin/ro",
    "/admin/ro/orders",
    "/admin/ru/orders",
    "/admin/ro/products",
    "/admin/ro/settings",
    "/admin/ro/integrations",
    "/admin/ro/integrations/ligatto",
    "/admin/ro/integrations/fan-courier",
    "/admin/ro/integrations/nova-post",
  ]) {
    test(`${path} renders without browser errors`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page).toHaveURL(new RegExp(path.replace(/\//g, "\\/") + "$"));
      await expect(page.locator("main")).toBeVisible();
    });
  }
});

test.describe("order status", () => {
  test("confirm takes the units, cancel gives them back", async ({ page }) => {
    const order = await pendingOrder(2);
    const before = await stockOf(plain.id);
    await page.goto(`/admin/ro/orders/${order.id}`);

    await setStatus(page, "Confirmată");
    await expect(page.getByRole("combobox", { name: "Status" })).toHaveText("Confirmată");
    await expect.poll(() => stockOf(plain.id)).toBe(before - 2);

    await setStatus(page, "Expediată");
    await expect(page.getByRole("combobox", { name: "Status" })).toHaveText("Expediată");
    expect(await stockOf(plain.id)).toBe(before - 2);

    await setStatus(page, "Anulată");
    await expect(page.getByRole("combobox", { name: "Status" })).toHaveText("Anulată");
    await expect.poll(() => stockOf(plain.id)).toBe(before);
  });

  test("confirming with too little stock shows the refusal and changes nothing", async ({ page }) => {
    const before = await stockOf(plain.id);
    const order = await pendingOrder(before + 1);
    await page.goto(`/admin/ro/orders/${order.id}`);
    await setStatus(page, "Confirmată");
    await expect(page.getByText(/Stocul nu mai ajunge/)).toBeVisible();
    const row = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row).toMatchObject({ status: "pending", stockReserved: false });
    expect(await stockOf(plain.id)).toBe(before);
  });
});

test.describe("shipment dialog", () => {
  test("both courier forms open; Fan Courier COD defaults to the order total", async ({ page }) => {
    const order = await pendingOrder(1, {
      deliveryMethod: "delivery",
      deliveryRegion: "chisinau",
      city: "Chișinău",
      address: "str. Testului 5",
      country: "Moldova",
    });
    await page.goto(`/admin/ro/orders/${order.id}`);
    await page.getByRole("button", { name: "Creează expediere" }).click();
    const picker = page.getByRole("dialog", { name: "Alege curierul" });
    await picker.getByRole("button", { name: /Fan Courier/ }).click();

    const fan = page.getByRole("dialog");
    await expect(fan.getByRole("heading", { name: "Fan Courier" })).toBeVisible();
    await expect(fan.getByRole("spinbutton", { name: "Sumă ramburs (lei)" })).toHaveValue(String(Number(order.totalPrice)));
    // Insurance is opt-in: empty until the order-total button fills it.
    const declared = fan.getByRole("spinbutton", { name: "Valoare declarată (lei)" });
    await expect(declared).toHaveValue("");
    await fan.getByRole("button", { name: /Totalul comenzii/ }).click();
    await expect(declared).toHaveValue(String(Number(order.totalPrice)));

    await fan.getByRole("button", { name: "Înapoi" }).click();
    await page.getByRole("dialog", { name: "Alege curierul" }).getByRole("button", { name: /Nova Post/ }).click();
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Nova Post" })).toBeVisible();
    await page.keyboard.press("Escape");

    expect(await prisma.shipment.count({ where: { orderId: order.id } })).toBe(0);
  });
});

test.describe("delivery settings", () => {
  let backup: Prisma.DeliverySettingsCreateManyInput[] = [];

  test.beforeEach(async () => {
    backup = await prisma.deliverySettings.findMany({ orderBy: { id: "asc" } });
    // The shape production has: an earlier app left inactive rows below the live one.
    await prisma.deliverySettings.deleteMany();
    await prisma.deliverySettings.createMany({
      data: [
        { freeDeliveryThreshold: 1500, deliveryCostChisinau: 50, deliveryCostOutside: 90, isActive: false },
        { freeDeliveryThreshold: 1500, deliveryCostChisinau: 70, deliveryCostOutside: 90, isActive: false },
        { freeDeliveryThreshold: 1000, deliveryCostChisinau: 70, deliveryCostOutside: 120, isActive: true },
      ],
    });
  });

  test.afterEach(async () => {
    await prisma.deliverySettings.deleteMany();
    await prisma.deliverySettings.createMany({ data: backup });
  });

  test("the card edits the row the storefront charges", async ({ page }) => {
    await page.goto("/admin/ro/settings");
    const card = page.locator("form").filter({ has: page.getByRole("button", { name: "Salvează livrarea" }) });
    await expect(card.getByRole("spinbutton", { name: "Prag livrare gratuită" })).toHaveValue("1000");
    await expect(card.getByRole("spinbutton", { name: "Cost în afara orașului" })).toHaveValue("120");
    await expect(card.getByRole("checkbox", { name: "Secțiune activă" })).toBeChecked();

    await card.getByRole("spinbutton", { name: "Prag livrare gratuită" }).fill("1200");
    await card.getByRole("button", { name: "Salvează livrarea" }).click();
    await expect
      .poll(async () => Number((await prisma.deliverySettings.findFirst({ where: { isActive: true } }))?.freeDeliveryThreshold))
      .toBe(1200);

    // The storefront cart now quotes the saved threshold.
    await page.goto(`/ro/product/${plain.id}/x`);
    await page.locator("main button", { hasText: "Adaugă în coș" }).first().click();
    await expect(page.getByRole("dialog", { name: "Coșul tău" })).toContainText(/1\.?200\s*lei/);
  });

  test("switching the section off hides the hint and keeps the same row in the card", async ({ page }) => {
    await page.goto("/admin/ro/settings");
    const card = page.locator("form").filter({ has: page.getByRole("button", { name: "Salvează livrarea" }) });
    // The checkbox is visually hidden under a switch track; users click the label.
    await card.getByText("Secțiune activă").click();
    await expect(card.getByRole("checkbox", { name: "Secțiune activă" })).not.toBeChecked();
    await card.getByRole("button", { name: "Salvează livrarea" }).click();
    await expect.poll(() => prisma.deliverySettings.count({ where: { isActive: true } })).toBe(0);

    await page.reload();
    await expect(card.getByRole("spinbutton", { name: "Prag livrare gratuită" })).toHaveValue("1000");
    await expect(card.getByRole("checkbox", { name: "Secțiune activă" })).not.toBeChecked();

    await page.goto(`/ro/product/${plain.id}/x`);
    await page.locator("main button", { hasText: "Adaugă în coș" }).first().click();
    await expect(page.getByRole("dialog", { name: "Coșul tău" })).not.toContainText("Livrare gratuită");
  });
});

test.describe("ligatto agents", () => {
  for (const name of ["web", "Web"]) {
    test(`the name "${name}" is refused`, async ({ page }) => {
      await page.goto("/admin/ro/integrations/ligatto");
      await page.getByRole("textbox", { name: "Nume agent" }).fill(name);
      await page.getByRole("button", { name: "Adaugă agent" }).click();
      await expect(page.getByText(/rezervat/)).toBeVisible();
      expect(await prisma.ligattoAgent.count({ where: { name } })).toBe(0);
    });
  }

  test("a new agent is created and its token shown once", async ({ page }) => {
    const name = `e2e-${Date.now()}`;
    await page.goto("/admin/ro/integrations/ligatto");
    await page.getByRole("textbox", { name: "Nume agent" }).fill(name);
    await page.getByRole("button", { name: "Adaugă agent" }).click();
    await expect.poll(() => prisma.ligattoAgent.count({ where: { name } })).toBe(1);
    // The token is 24 random bytes, base64url: 32 characters, revealed once.
    const token = page.getByText(/^[A-Za-z0-9_-]{32}$/);
    await expect(token).toBeVisible();
    await page.reload();
    await expect(page.getByText(name).first()).toBeVisible();
    await expect(token).toHaveCount(0);
  });
});
