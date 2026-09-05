# Courier Tracking — Integration Plan

> Status: **Planned** — abhi koi delivery service linked nahi. My Orders detail me placeholder already ready hai (`docs/FACTORY-FLOW-V2.md` Phase 2 item 5).
> Target: India ke courier aggregator se AWB + live status → user ko notification + My Orders me tracking.

---

## 1. Provider choose karo — pehle kisko integrate karein

| Provider | API type | AWB format | Status webhook | Best for |
|---|---|---|---|---|
| **Shiprocket** | REST (auth token) | 10-12 digit | ✅ webhook + polling | **Recommended #1** — ek API me multiple couriers (Delhivery, DTDC, XpressBees, India Post…) + COD, pickup scheduling, rate calc, return mgmt |
| **DTDC** | SOAP/REST (client ID + password) | 10-11 digit | ✅ polling (API) | Direct DTDC partnership ho to |
| **Bluedart** | SOAP (license key) | 10 digit | polling (API) | High-value/air shipments |
| **Delhivery** | REST (token) | 10-13 digit | ✅ webhook | e-commerce focus |
| **India Post** | API (registration) | 13 digit | polling | Cheapest, rural coverage |

**Suggestion**: **Shiprocket pehle** — ek integration me multi-courier milta hai, small business ke liye sahi. DTDC/Bluedart direct tab jab volume justify kare.

---

## 2. DB schema — Order pe courier fields

`Order` model me add (Prisma migration):

```prisma
model Order {
  // ... existing fields

  courierProvider  String?   // "shiprocket" | "dtdc" | "bluedart" | ...
  awbNumber        String?   // Air Waybill number (courier tracking id)
  courierStatus    String?   // "pending" | "picked_up" | "in_transit" | "out_for_delivery" | "delivered" | "failed"
  courierLastEvent String?   // raw last status text ("Shipment out for delivery")
  trackingUrl      String?   // provider tracking page URL (user ko link)
  courierSyncAt    DateTime? // last webhook/poll sync
}
```

- `OrderItem` pe **nahi** — AWB order-level hota hai (courier shipment = poora order box).
- Index: `@@index([awbNumber])` — webhook lookup fast.

---

## 3. Admin flow — "Mark Shipped" se courier tak

```
Admin Order pe "Mark Shipped" click
   │
   ├─ 1. createShipment (provider API)
   │      Shiprocket: POST /v1/external/courier/assign/awb
   │        body: { order_id, shipment_id, courier_id, ... }
   │      → response: { awb_code, courier_company_name, ... }
   │
   ├─ 2. DB save: courierProvider, awbNumber, trackingUrl, courierStatus="picked_up" (ya "pending")
   │
   ├─ 3. User notification (existing):
   │      "🚚 Order shipped — AWB: 1234567890 · track: <link>"
   │
   └─ 4. My Orders detail me tracking card live ho jata hai (placeholder ki jagah)
```

### API endpoints (naye)

| Endpoint | Kya karta hai |
|---|---|
| `POST /api/admin/orders/:id/ship` | Mark shipped + courier shipment create + AWB save (extend existing `updateOrderStatus`) |
| `POST /api/admin/orders/:id/awb` | Manual AWB entry (agar provider API na chale — manual mode) |
| `GET /api/shop/orders/:id/tracking` | User ke liye live tracking (order owner only) |
| `POST /api/webhooks/shiprocket` | Shiprocket webhook (AWB se order dhundho → status update) |
| `GET /api/admin/orders/:id/tracking/refresh` | Admin force-sync (poll provider) |

---

## 4. Status sync — webhook + polling fallback

### A. Webhook (primary)
Shiprocket status change pe POST karta hai → `/api/webhooks/shiprocket`:
```json
{ "awb_code": "1234567890", "current_status": "OUT_FOR_DELIVERY", "remarks": "...", "timestamp": "..." }
```
- AWB se order find → `courierStatus` map (Shiprocket → internal):
  ```
  PICKED_UP → picked_up
  IN_TRANSIT → in_transit
  OUT_FOR_DELIVERY → out_for_delivery
  DELIVERED → delivered
  RTO → failed
  ```
- **DELIVERED mile toh**: order status auto → `delivered` + serial status → `delivered` + user notification "📦 Delivered — serial keys…" (existing flow) + audit log.

### B. Polling (fallback)
- Har 30 min ek background job (`services/courier.service.ts`): pending/in_transit shipments pe provider status API call → update.
- Koi bhi non-`delivered`/non-`cancelled` order jiske `awbNumber` ho.

### C. User notifications (webhook/status change pe)
- `picked_up` → "📦 Order picked up by courier"
- `out_for_delivery` → "🛵 Aaj delivery ho sakti hai!"
- `delivered` → existing delivered notification
- Realtime `notification:new` se bell pe turant.

---

## 5. My Orders UI — tracking card (placeholder upgrade)

`pages/Orders.tsx` me `OrderDetails` ka **🚚 Courier Tracking** placeholder box ab live hota hai:

```
🚚 Courier Tracking              [Shiprocket]
AWB: 1234567890   ·   Track: <provider link>
─────────────────────────
● Picked up          8:30 AM
● In transit         12:05 PM
● Out for delivery   4:15 PM
○ Delivered          — (pending)
─────────────────────────
Last event: Out for delivery (4:15 PM)
```

- Timeline: `courierStatus` se steps (picked_up → in_transit → out_for_delivery → delivered)
- `trackingUrl` par "Track on provider" link
- Webhook/poll har 30 min refresh; user "Refresh" button bhi (rate-limited 60s)
- Courier service ka naam badge me

---

## 6. Implementation order (jab shuru karein)

1. **Prisma migration** — courier fields + index
2. **`courier.service.ts`** — provider client interface (Shiprocket first): `createShipment`, `trackShipment`, `mapStatus`
3. **Admin "Mark Shipped → create shipment"** — ship endpoint + manual AWB fallback
4. **Webhook route** + signature verify (Shiprocket webhook auth token)
5. **Polling job** (30 min) + admin manual refresh
6. **My Orders tracking card** — placeholder upgrade + notifications
7. Shiprocket sandbox se end-to-end test

---

## 7. Risks / notes

- **Webhook signature**: Shiprocket auth token header verify karo — fake webhook se order status hijack na ho.
- **Rate limits**: polling ko 30 min se kam mat rakho (provider quota).
- **Manual AWB**: hamesha fallback — API down ho to admin AWB manually daal ke status poll kare.
- **Delivered race**: webhook delivered + polling delivered — idempotent update (status already delivered ho to skip).
- **COD**: courier status delivered pe hi payment "paid" consider karo (COD payment at delivery).
- Env vars: `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD` (token generate), ya API key — secret management `.env` me.
