# Lampino Order Automation API — payload contract

For building Ligatto flow nodes (http-call) against Lampino's order endpoints.
Taken from the live route handlers (`app/api/automation/orders/route.ts`,
`app/api/automation/orders/[id]/route.ts`, `lib/orders/validate.ts`).

Base URL: `https://lampino.md`

**Auth (both endpoints):** `Authorization: Bearer <agent token>` — the token of an
enabled Lampino Ligatto agent (admin → Integrations → Ligatto). Responses:
`401 unauthorized` (bad/missing token), `403 integration_disabled` (no enabled agents).
All requests and responses are `application/json`.

## 1. Create order — `POST /api/automation/orders`

**Optional header:** `Idempotency-Key: <string ≤200>` — a retried call with the same
key returns the already-created order instead of a duplicate (recommended: derive
from the conversation id).

**Request body:**

```jsonc
{
  "lang": "ro",                     // "ro" | "ru"; anything else → "ro". Localizes item names in the response.
  "customer": {                     // REQUIRED
    "name": "...",                  // required, 1–100 chars
    "phone": "..."                  // required, ≤30 chars, 6–15 digits, allowed chars: digits + space ( ) . - leading +
  },
  "delivery": {                     // optional block; defaults to pickup
    "method": "pickup",             // "pickup" | "delivery" (anything else → "pickup")
    "city": "...",                  // REQUIRED when method="delivery", ≤300 chars — the shipping
                                    // fee's region is derived from this server-side (only the city
                                    // of Chișinău bills at the city rate); don't send a region field.
    "address": "...",               // REQUIRED when method="delivery", ≤300 chars
    "postalCode": "...",            // optional, ≤20 chars
    "notes": "..."                  // optional, ≤1000 chars
  },
  "items": [                        // REQUIRED, 1–50 lines; duplicate product+variant lines are merged
    { "productId": 1,               // required, integer > 0
      "variantId": 2,               // optional, integer > 0 (omit or null for non-variant products)
      "quantity": 3 }               // clamped to 1–1000
  ],
  "webhook_listener_id": "..."      // optional, ≤200 chars — opaque correlation id echoed back on the
                                    // shipment.created webhook (SB-CONVERSATION). Use {{sb_conversation_id}}.
}
```

Prices and stock are resolved from Lampino's catalog — anything price-like in the
payload is ignored, including the delivery region: it's derived from `city`
server-side (the city of Chișinău and its spelling variants → `chisinau`,
everything else — suburbs, other towns, unrecognized → `outside`) and echoed back
on the order. The order is created as `pending` with stock reserved.

**Success — `200`:**

```jsonc
{
  "ok": true,
  "order": {
    "id": 24,                       // → map to order_id (number)
    "status": "pending",
    "source": "<agent name>",
    "customer": { "name": "...", "phone": "..." },
    "delivery": { "method": "...", "region": null, "city": null, "address": null, "postalCode": null, "notes": null },
    "items": [{
      "productId": 1, "variantId": null,
      "name": "Bec LED Aura E27",   // localized by lang
      "quantity": 3,
      "unitListPrice": 79, "unitPrice": 79,
      "lineDiscount": 0, "lineTotal": 237
    }],
    "totals": {
      "itemsGross": 237, "discountTotal": 0, "itemsNet": 237,
      "shippingFee": 90,            // → map to shipping_fee (number); 0 for pickup / above free threshold
      "grandTotal": 327,            // → map to order_total (number); what the customer pays
      "currency": "MDL"
    }
  }
}
```

**Errors** — always `{ "ok": false, "error": "<code>" }`:

| HTTP | `error`           | Meaning                                                                  |
|------|-------------------|--------------------------------------------------------------------------|
| 400  | `invalid_json`    | body isn't valid JSON                                                     |
| 400  | `invalid_contact` | name/phone missing or out of bounds                                       |
| 400  | `invalid_address` | method=delivery but city/address missing                                  |
| 400  | `empty_cart`      | no valid item lines                                                       |
| 409  | `out_of_stock`    | + `"rejected": [{productId, variantId, available}]` — available units listed |
| 409  | `unavailable`     | + `"rejected": [...]` — product/variant no longer sold                    |
| 500  | `server_error`    | unexpected failure                                                        |

## 2. Edit order — `PATCH /api/automation/orders/{id}`

Same auth. **Every top-level key is optional — a present key replaces its whole
block; an absent key leaves current values untouched:**

- `customer` present → full replace (same rules as create).
- `delivery` present → full replace of method+city+address+postalCode+notes
  (switching to pickup clears the address). The region is re-derived from the new
  city, same as create.
- `items` present → the **entire item set is replaced** and the order is
  **re-priced at current catalog prices**; stock is atomically released/re-reserved.
- `webhook_listener_id`: string sets it, `null`/empty clears it, absent leaves it.
- `lang` works as in create.

**Extra rules:**

- Only an order still in **`pending`** is editable. Anything else →
  `409 { "ok": false, "error": "locked", "status": "<current status>" }` — the agent
  must stop editing and hand off to a human.
- `404 not_found`: unknown id, or an order not placed through this API (storefront
  orders are invisible here).
- Same `out_of_stock` / `unavailable` 409s with `rejected` lines, same 200 response
  shape as create.

## 3. Flow-node mapping hints (for the copilot)

- **Variables in**: compose the body with `{{fullname}}`, `{{phone}}`, `{{quantity}}`,
  `{{delivery_method}}`, `{{delivery_city}}`,
  `{{delivery_address}}`, and `webhook_listener_id: "{{sb_conversation_id}}"` — the
  listener id is what routes the later `shipment.created` webhook (tracking number)
  back into the same conversation.
- **Results out**: `order.id → order_id (number)`,
  `order.totals.shippingFee → shipping_fee (number)`,
  `order.totals.grandTotal → order_total (number)`,
  optionally `order.status → order_status (string)`.
- There is no region input — the shipping tier is resolved from `city` by Lampino
  (only the city of Chișinău bills at the city rate; everything else is `outside`).
  Collect only the city; never ask the customer which region they're in. The
  resolved value comes back as `order.delivery.region`.
- Unset flow variables render as empty strings in the body; that's safe for pickup
  orders (an empty `city`/`address` is ignored when `method` ≠ `"delivery"`).
- ⚠️ The http-call node splices variables into a raw JSON string — a customer-typed
  value containing a double quote (`"`) will break the body. Prefer collect-info
  instructions that yield plain text (names, streets) and keep free-form notes out
  of the JSON, or sanitize quotes in the instruction.
- PATCH semantics mean a flow that only wants to bump the quantity must still send
  the **complete items array**, and a flow fixing the phone must send both `name`
  and `phone`. Design nodes to re-send full blocks from their collected variables,
  not deltas.
