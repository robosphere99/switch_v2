import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';
import mqtt from 'mqtt';

const prisma = new PrismaClient();

async function main() {
  const targetSerial = "RS-4CH-BQME98";
  console.log(`Starting simulator for REAL order serial: ${targetSerial}...`);

  // 1. Find the Serial Registry entry
  const registry = await prisma.serialRegistry.findUnique({
      where: { serialCode: targetSerial }
  });

  if (!registry) {
      console.error(`Serial ${targetSerial} not found in registry!`);
      return;
  }

  // 2. Mark as tested (what the flasher does)
  await prisma.serialRegistry.update({
      where: { serialCode: targetSerial },
      data: { status: "claimed", testedAt: new Date(), claimedAt: new Date() }
  });
  console.log("Flasher: Board marked as factory tested and claimed.");

  // 3. Find the user & home (from the order)
  const order = await prisma.order.findUnique({ where: { id: registry.orderId! } });
  const homeMember = await prisma.homeMember.findFirst({ where: { userId: order!.userId } });
  const homeId = homeMember!.homeId;

  // 4. Create the ESP Device in the database if it doesn't exist
  let esp = await prisma.espDevice.findUnique({ where: { serialCode: targetSerial } });
  
  if (!esp) {
      const mac = `00:11:22:33:44:${Math.floor(Math.random() * 99)}`;
      esp = await prisma.espDevice.create({
          data: {
              serialCode: targetSerial,
              macAddress: mac,
              modelCode: "4CH",
              home: { connect: { id: homeId } }
          }
      });
      console.log(`Created ESP device record in DB with MAC ${mac}`);

      // Usually, the website user maps the devices manually in "My Boards",
      // But we can create 4 unmapped devices just so they show up.
      for (let i = 1; i <= 4; i++) {
          await prisma.device.create({
              data: {
                  name: `Switch ${i}`,
                  type: "bulb",
                  esp: { connect: { id: esp.id } },
                  channel: i,
                  home: { connect: { id: homeId } },
                  creator: { connect: { id: order!.userId } }
              }
          });
      }
      console.log(`Created 4 physical relays for ${targetSerial}. You can map them on the site now.`);
  }

  // 5. Connect to EMQX using the API Key
  // CAUTION: Do NOT blindly overwrite existing hardware API keys!
  let rawApiKey = process.env.SIMULATED_API_KEY;
  let key = await prisma.apiKey.findFirst({ where: { homeId } });

  if (!rawApiKey) {
      if (!key) {
          rawApiKey = crypto.randomBytes(32).toString("hex");
          const keyHash = crypto.createHash("sha256").update(rawApiKey).digest("hex");
          key = await prisma.apiKey.create({
              data: { homeId, userId: order!.userId, keyPrefix: "sim", keyHash }
          });
          console.log(`Created new simulated API key: ${rawApiKey}`);
      } else {
          console.warn("⚠️ An existing API key was found for this home.");
          console.warn("⚠️ Set SIMULATED_API_KEY in environment to use a specific key, or generate a dedicated test key in dashboard.");
          // To avoid breaking physical hardware with rc=5, we generate a simulator-specific key if needed:
          rawApiKey = process.env.SIMULATED_API_KEY || "test_sim_key";
          const simHash = crypto.createHash("sha256").update(rawApiKey).digest("hex");
          const existingSimKey = await prisma.apiKey.findUnique({ where: { keyHash: simHash } });
          if (!existingSimKey) {
              await prisma.apiKey.create({
                  data: { homeId, userId: order!.userId, keyPrefix: "sim", keyHash: simHash }
              });
          }
      }
  }

  console.log(`Connecting to EMQX for ${targetSerial}...`);
  const brokerUrl = "mqtts://bf89c1fe.ala.asia-southeast1.emqxsl.com:8883";
  const client = mqtt.connect(brokerUrl, {
      username: esp.serialCode,
      password: rawApiKey,
      clientId: `sim_${esp.serialCode}`,
      rejectUnauthorized: false
  });

  const cleanMac = esp.macAddress.replace(/:/g, "").toLowerCase();

  client.on('connect', () => {
      console.log(`✅ ESP32 Simulator (${targetSerial}) Connected to EMQX!`);
      client.subscribe(`sn/${cleanMac}/cmd`);
      client.publish(`sn/${cleanMac}/state`, JSON.stringify({ states: [0, 0, 0, 0], ip: "192.168.1.99" }));
  });

  client.on('message', (topic, message) => {
      console.log(`⚡ Received command on ${topic}:`, message.toString());
      try {
          const payload = JSON.stringify({ states: [1, 1, 1, 1] }); 
          client.publish(`sn/${cleanMac}/state`, payload);
          console.log(`📡 Bounced back state [1,1,1,1] to site`);
      } catch (e) {}
  });
}

main();
