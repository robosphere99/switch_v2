import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("admin123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@robosphere.local" },
    update: { role: "system_admin" },
    create: {
      username: "admin",
      email: "admin@robosphere.local",
      password,
      role: "system_admin",
    },
  });

  const demo = await prisma.user.upsert({
    where: { email: "demo@robosphere.local" },
    update: {},
    create: {
      username: "demo",
      email: "demo@robosphere.local",
      password,
    },
  });

  const home = await prisma.home.findFirst({ where: { ownerId: demo.id } });
  if (!home) {
    const created = await prisma.home.create({
      data: {
        name: "Demo Home",
        ownerId: demo.id,
        members: { create: { userId: demo.id, role: "owner" } },
        rooms: {
          create: [
            { name: "Living Room" },
            { name: "Bedroom" },
            { name: "Kitchen" },
          ],
        },
      },
      include: { rooms: true },
    });

    const livingRoom = created.rooms[0];
    await prisma.device.create({
      data: {
        homeId: created.id,
        roomId: livingRoom.id,
        name: "Living Room Bulb",
        type: "bulb",
        createdBy: demo.id,
        serialNumber: `ESP32-DEMO-${Date.now().toString(36).toUpperCase()}`,
      },
    });
    await prisma.device.create({
      data: {
        homeId: created.id,
        roomId: livingRoom.id,
        name: "Ceiling Fan",
        type: "fan",
        createdBy: demo.id,
      },
    });
  }

  console.log("✅ Seeded:");
  console.log(`   Admin: admin@robosphere.local / admin123`);
  console.log(`   Demo:  demo@robosphere.local / admin123`);

  await seedProducts();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

// ---------- Shop products ----------

const PRODUCTS = [
  {
    name: "2CH WiFi Relay Module",
    modelCode: "2CH",
    relayCount: 2,
    price: 599,
    description:
      "Two-channel WiFi relay board for lights and small appliances. 10A per channel, ESP32 based, works with the RoboSphere app and voice assistant.",
    features: { channels: 2, wifi: true, ota: true, voice: true },
  },
  {
    name: "4CH WiFi Relay Module",
    modelCode: "4CH",
    relayCount: 4,
    price: 799,
    description:
      "Four-channel WiFi relay board — the classic choice for room-wide control. 10A per channel with status LED and manual override switches.",
    features: { channels: 4, wifi: true, ota: true, voice: true },
  },
  {
    name: "5CH WiFi Relay Module",
    modelCode: "5CH",
    relayCount: 5,
    price: 899,
    description:
      "Five-channel relay board — perfect for combining 4 devices plus one spare. ESP32 with OTA updates and two-way sync.",
    features: { channels: 5, wifi: true, ota: true, voice: true },
  },
  {
    name: "6CH WiFi Relay Module",
    modelCode: "6CH",
    relayCount: 6,
    price: 999,
    description:
      "Six-channel WiFi relay board for medium-size homes. Control lights, fans and appliances from one compact board.",
    features: { channels: 6, wifi: true, ota: true, voice: true },
  },
  {
    name: "8CH WiFi Relay Module",
    modelCode: "8CH",
    relayCount: 8,
    price: 1199,
    description:
      "Eight-channel WiFi relay board — full-home control. Ideal for new construction wiring with all loads in one panel.",
    features: { channels: 8, wifi: true, ota: true, voice: true },
  },
  {
    name: "4CH IR WiFi Relay Module",
    modelCode: "4CH-IR",
    relayCount: 4,
    price: 999,
    description:
      "Four-channel relay board with built-in IR receiver — control with the app and any IR remote. Works with ACs, TVs and IR appliances.",
    features: { channels: 4, ir: true, wifi: true, ota: true, voice: true },
  },
  {
    name: "Fan Speed Dimmer (WiFi)",
    modelCode: "FAN-DIM",
    relayCount: 1,
    price: 899,
    description:
      "WiFi fan regulator with stepped speed control. Replace your old 5-step regulator and control the fan from the app or voice.",
    features: { fanDimmer: true, steps: 5, wifi: true, ota: true, voice: true },
  },
  {
    name: "3-State Touch Dimmer",
    modelCode: "DIM-3S",
    relayCount: 1,
    price: 749,
    description:
      "Touch dimmer with 3 brightness steps (off → 50% → 100%). WiFi + touch control, works with existing bulb holders.",
    features: { dimmer: true, steps: 3, touch: true, wifi: true, ota: true },
  },
  {
    name: "4-State Touch Dimmer",
    modelCode: "DIM-4S",
    relayCount: 1,
    price: 799,
    description:
      "Touch dimmer with 4 brightness steps (off → 33% → 66% → 100%). WiFi + touch control, app dimming via steps.",
    features: { dimmer: true, steps: 4, touch: true, wifi: true, ota: true },
  },
];

async function seedProducts() {
  for (const p of PRODUCTS) {
    await prisma.product.upsert({
      where: { modelCode: p.modelCode },
      update: {
        name: p.name,
        relayCount: p.relayCount,
        price: p.price,
        description: p.description,
        features: p.features as never,
        active: true,
      },
      create: {
        name: p.name,
        modelCode: p.modelCode,
        relayCount: p.relayCount,
        price: p.price,
        description: p.description,
        features: p.features as never,
        active: true,
      },
    });
  }
  console.log(`   Products: ${PRODUCTS.length} shop products`);
}

