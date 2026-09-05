import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Admin/demo password — site/.env (ADMIN_PASSWORD) se, warna default.
  // npm run db:seed dotenv -e ../../.env ke saath chalta hai, isliye env
  // me set kiya hua password yahan milta hai (admin change ho to seed bhi
  // same value use kare).
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  const password = await bcrypt.hash(adminPassword, 10);

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
  console.log(`   Admin: admin@robosphere.local / ${adminPassword}`);
  console.log(`   Demo:  demo@robosphere.local / ${adminPassword}`);

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
  {
    name: "RGB LED Controller",
    modelCode: "RGB-WIFI",
    relayCount: 3,
    price: 1299,
    description:
      "WiFi RGB strip controller. Control millions of colors, set dynamic scenes, and sync with music from the app.",
    features: { rgb: true, scenes: true, wifi: true, voice: true },
    upcoming: true,
  },
  {
    name: "Smart Plug (16A)",
    modelCode: "PLUG-16A",
    relayCount: 1,
    price: 999,
    description:
      "Heavy duty 16A smart plug for Geysers, ACs, and Heaters. Includes real-time power monitoring and auto-cut off.",
    features: { powerMonitoring: true, load: "16A", wifi: true, voice: true },
    upcoming: true,
  },
];

async function seedProducts() {
  const commonFaqs = [
    { question: "Does this require a hub?", answer: "No, it connects directly to your home WiFi. No extra hub needed." },
    { question: "Can I control it from outside my home?", answer: "Yes, the SwitchNest app allows you to control it securely from anywhere." },
    { question: "Is it compatible with voice assistants?", answer: "Yes, it works seamlessly with our AI voice assistant." }
  ];
  
  const commonSpecs = [
    { label: "Input Voltage", value: "90-250V AC 50/60Hz" },
    { label: "Microcontroller", value: "ESP32 WROOM-32" },
    { label: "Wireless", value: "WiFi 2.4GHz (802.11 b/g/n)" },
    { label: "Enclosure", value: "Fire-retardant ABS Plastic" },
  ];

  for (const p of PRODUCTS) {
    const enrichedFeatures = {
      ...(p.features as any),
      faqs: commonFaqs,
      specifications: commonSpecs,
    };

    await prisma.product.upsert({
      where: { modelCode: p.modelCode },
      update: {
        name: p.name,
        relayCount: p.relayCount,
        price: p.price,
        description: p.description,
        features: enrichedFeatures,
        active: true,
        upcoming: p.upcoming ?? false,
      },
      create: {
        name: p.name,
        modelCode: p.modelCode,
        relayCount: p.relayCount,
        price: p.price,
        description: p.description,
        features: enrichedFeatures,
        active: true,
        upcoming: p.upcoming ?? false,
      },
    });
  }
  console.log(`   Products: ${PRODUCTS.length} shop products`);

  // Seed Product Reviews
  const demoUser = await prisma.user.findUnique({ where: { email: "demo@robosphere.local" } });
  if (demoUser) {
    const allProds = await prisma.product.findMany();
    let reviewsAdded = 0;
    for (const p of allProds) {
      const existingReviews = await prisma.productReview.count({ where: { productId: p.id } });
      if (existingReviews === 0) {
        await prisma.productReview.createMany({
          data: [
            { productId: p.id, userId: demoUser.id, rating: 5, comment: "Absolutely fantastic! Setup took exactly 2 minutes. The WiFi range is excellent, and it responds instantly from the app." },
            { productId: p.id, userId: demoUser.id, rating: 4, comment: "Good quality hardware. The PCB layout looks clean. Only giving 4 stars because the delivery was a day late." },
            { productId: p.id, userId: demoUser.id, rating: 5, comment: "Value for money. Using it for my living room lights and it works perfectly." }
          ]
        });
        await prisma.product.update({
          where: { id: p.id },
          data: { rating: 4.67, totalReviews: 3 }
        });
        reviewsAdded += 3;
      }
    }
    if (reviewsAdded > 0) {
      console.log(`   Reviews: Added ${reviewsAdded} mock reviews`);
    }
  }
}

