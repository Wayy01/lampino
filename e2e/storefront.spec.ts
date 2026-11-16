// Storefront: pages render cleanly, and cart / buy-now checkout create the
// orders the drawers promise.
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { E2E, cleanupOrders, fixtures, latestOrder, prisma, stockOf } from "./db";

let plain: Awaited<ReturnType<typeof fixtures>>["plain"];
let variant: Awaited<ReturnType<typeof fixtures>>["variant"];
let delivery: { freeDeliveryThreshold: number; deliveryCostChisinau: number; deliveryCostOutside: number };

test.beforeAll(async () => {
  ({ plain, variant } = await fixtures());
  const row = await prisma.deliverySettings.findFirstOrThrow({
    where: { isActive: true },
    orderBy: { id: "desc" },
  });
  delivery = {
    freeDeliveryThreshold: Number(row.freeDeliveryThreshold),
    deliveryCostChisinau: Number(row.deliveryCostChisinau),
    deliveryCostOutside: Number(row.deliveryCostOutside),
  };
});

test.afterAll(async () => {
  await cleanupOrders();
  await prisma.$disconnect();
});

const lei = (n: number) => new RegExp(`${n.toLocaleString("ro-RO").replace(/\s/g, "\\s?")}\\s*lei`);

/** The product page's own add-to-cart button (the qty stepper shares its accessible name). */
const addToCart = (page: Page, label = "Adaugă în coș") =>
  page.locator("main button", { hasText: label }).first();

async function openCheckout(page: Page, productId: number, name: string) {
  await page.goto(`/ro/product/${productId}/x`);
  await addToCart(page).click();
  const cart = page.getByRole("dialog", { name: "Coșul tău" });
  await expect(cart).toBeVisible();
  await cart.getByRole("button", { name: "Finalizează comanda" }).click();
  const form = page.getByRole("dialog", { name: "Comandă" });
  await form.getByRole("textbox", { name: "Nume complet" }).fill(name);
  await form.getByRole("textbox", { name: "Telefon" }).fill("+373 60 000 050");
  return form;
}

test.describe("pages", () => {
  for (const path of ["/ro", "/ru", "/ro/magazin", "/ru/magazin", "/ro/arenda", "/ro/contact"]) {
    test(`${path} renders without browser errors`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.locator("main")).toBeVisible();
    });
  }

  test("product page with a stale slug lands on the canonical URL", async ({ page }) => {
    await page.goto(`/ro/product/${plain.id}/wrong-slug`);
    await expect(page).toHaveURL(new RegExp(`/ro/product/${plain.id}/(?!wrong-slug)`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(plain.name_ro);
  });
});

test.describe("cart checkout", () => {
  test("cart shows the item, its total and the free-delivery hint", async ({ page }) => {
    await page.goto(`/ro/product/${plain.id}/x`);
    await addToCart(page).click();
    const cart = page.getByRole("dialog", { name: "Coșul tău" });
    await expect(cart.getByRole("heading", { name: plain.name_ro })).toBeVisible();
    await expect(cart).toContainText(lei(Number(plain.price)));
    await expect(cart).toContainText(lei(delivery.freeDeliveryThreshold));
  });

  test("quantity stepper in the cart updates the total", async ({ page }) => {
    await page.goto(`/ro/product/${plain.id}/x`);
    await addToCart(page).click();
    const cart = page.getByRole("dialog", { name: "Coșul tău" });
    const item = cart.getByRole("listitem").filter({ hasText: plain.name_ro });
    // The stepper buttons are icon-only; "Adaugă în coș" is the + button's label.
    await item.getByRole("button", { name: "Adaugă în coș" }).click();
    await expect(item).toContainText("2");
    await expect(cart).toContainText(lei(Number(plain.price) * 2));
  });

  test("pickup order is placed, the cart empties, no stock is taken", async ({ page }) => {
    const name = `${E2E} pickup`;
    const before = await stockOf(plain.id);
    const form = await openCheckout(page, plain.id, name);
    await form.getByRole("button", { name: "Trimite comanda" }).click();
    await expect(page.getByRole("heading", { name: "Comandă trimisă" })).toBeVisible();

    const order = await latestOrder(name);
    expect(order).toMatchObject({ status: "pending", source: "web", deliveryMethod: "pickup", stockReserved: false });
    expect(Number(order!.totalPrice)).toBe(Number(plain.price));
    expect(await stockOf(plain.id)).toBe(before);
    expect(await page.evaluate(() => localStorage.getItem("lampino-cart"))).toBe("[]");
  });

  test("delivery to Chișinău: city is prefilled and the city fee is stored", async ({ page }) => {
    const name = `${E2E} chisinau`;
    const form = await openCheckout(page, plain.id, name);
    await form.getByRole("button", { name: "Livrare la adresă" }).click();
    await expect(form.getByRole("textbox", { name: "Oraș / Localitate" })).toHaveValue("Chișinău");
    await form.getByRole("textbox", { name: "Adresă (stradă, bloc, ap.)" }).fill("str. Testului 1");
    await form.getByRole("button", { name: "Trimite comanda" }).click();
    await expect(page.getByRole("heading", { name: "Comandă trimisă" })).toBeVisible();

    const order = await latestOrder(name);
    expect(order).toMatchObject({ deliveryMethod: "delivery", deliveryRegion: "chisinau", city: "Chișinău" });
    expect(Number(order!.totalPrice)).toBe(Number(plain.price) + delivery.deliveryCostChisinau);
  });

  test("delivery outside the city: region switch clears the city, outside fee stored", async ({ page }) => {
    const name = `${E2E} outside`;
    const form = await openCheckout(page, plain.id, name);
    await form.getByRole("button", { name: "Livrare la adresă" }).click();
    await form.getByRole("button", { name: "Restul Moldovei" }).click();
    const city = form.getByRole("textbox", { name: "Oraș / Localitate" });
    await expect(city).toHaveValue("");
    await city.fill("Bălți");
    await form.getByRole("textbox", { name: "Adresă (stradă, bloc, ap.)" }).fill("str. Testului 2");
    await form.getByRole("button", { name: "Trimite comanda" }).click();
    await expect(page.getByRole("heading", { name: "Comandă trimisă" })).toBeVisible();

    const order = await latestOrder(name);
    expect(order).toMatchObject({ deliveryRegion: "outside", city: "Bălți" });
    expect(Number(order!.totalPrice)).toBe(Number(plain.price) + delivery.deliveryCostOutside);
  });

  test("the total shown at checkout matches what the order is stored with", async ({ page }) => {
    // Known issue (since e010c08): the drawer shows the items subtotal and says
    // delivery is confirmed by phone, but the order stores subtotal + fee, and
    // the courier COD prefill uses that. Remove `fail` once the two agree.
    test.fail();
    const name = `${E2E} shown total`;
    const form = await openCheckout(page, plain.id, name);
    await form.getByRole("button", { name: "Livrare la adresă" }).click();
    await form.getByRole("textbox", { name: "Adresă (stradă, bloc, ap.)" }).fill("str. Testului 3");
    const totalRow = form.getByText("Total", { exact: true }).locator("xpath=following-sibling::*[1]");
    const shown = (await totalRow.innerText()).replace(/\D/g, "");
    await form.getByRole("button", { name: "Trimite comanda" }).click();
    await expect(page.getByRole("heading", { name: "Comandă trimisă" })).toBeVisible();
    expect(Number(shown)).toBe(Number((await latestOrder(name))!.totalPrice));
  });

  test("an empty required field is caught by the browser before submitting", async ({ page }) => {
    const form = await openCheckout(page, plain.id, "");
    await form.getByRole("button", { name: "Trimite comanda" }).click();
    await expect(form.getByRole("textbox", { name: "Nume complet" })).toHaveJSProperty("validity.valueMissing", true);
    await expect(page.getByRole("heading", { name: "Comandă trimisă" })).toHaveCount(0);
  });

  test("selling out between cart and submit shows the stock error", async ({ page }) => {
    const name = `${E2E} sold out`;
    const before = await stockOf(plain.id);
    const form = await openCheckout(page, plain.id, name);
    await prisma.product.update({ where: { id: plain.id }, data: { stock: 0 } });
    try {
      await form.getByRole("button", { name: "Trimite comanda" }).click();
      await expect(form.getByRole("alert")).toBeVisible();
      await expect(form.getByRole("button", { name: "Trimite comanda" })).toBeEnabled();
      expect(await latestOrder(name)).toBeNull();
    } finally {
      await prisma.product.update({ where: { id: plain.id }, data: { stock: before } });
    }
  });

  test.describe(() => {
    test.use({ expectedConsoleError: /submitOrder call failed|Failed to load resource/ });
    test("a failed request shows an error instead of hanging on sending", async ({ page }) => {
      const form = await openCheckout(page, plain.id, `${E2E} network`);
      await page.route("**/*", (route) =>
        route.request().method() === "POST" ? route.abort() : route.continue(),
      );
      await form.getByRole("button", { name: "Trimite comanda" }).click();
      await expect(form.getByRole("alert")).toBeVisible();
      await expect(form.getByRole("button", { name: "Trimite comanda" })).toBeEnabled();
    });
  });

  test("Russian checkout works end to end", async ({ page }) => {
    const name = `${E2E} ru`;
    await page.goto(`/ru/product/${plain.id}/x`);
    await addToCart(page, "В корзину").click();
    await page.getByRole("button", { name: "Оформить заказ" }).click();
    await page.getByRole("textbox", { name: "Полное имя" }).fill(name);
    await page.getByRole("textbox", { name: "Телефон" }).fill("+373 60 000 051");
    await page.getByRole("button", { name: "Отправить заказ" }).click();
    await expect(page.getByRole("heading", { name: "Заказ отправлен" })).toBeVisible();
    expect(await latestOrder(name)).not.toBeNull();
  });
});

test.describe("buy now", () => {
  test("variant product: the chosen variant is ordered", async ({ page }) => {
    const name = `${E2E} buy now`;
    await page.goto(`/ro/product/${variant.productId}/x`);
    await page.getByRole("button", { name: variant.name_ro, exact: true }).click();
    await page.getByRole("button", { name: "Cumpără acum" }).click();
    const dlg = page.getByRole("dialog", { name: "Cumpără rapid" });
    await expect(dlg).toContainText(variant.name_ro);
    await dlg.getByRole("textbox", { name: "Nume complet" }).fill(name);
    await dlg.getByRole("textbox", { name: "Telefon" }).fill("+373 60 000 052");
    await dlg.getByRole("button", { name: "Trimite comanda" }).click();
    await expect(page.getByRole("heading", { name: "Comandă trimisă" })).toBeVisible();

    const order = await latestOrder(name);
    expect(order?.items).toHaveLength(1);
    expect(order!.items[0]).toMatchObject({ productId: variant.productId, productVariantId: variant.id, quantity: 1 });
  });
});
