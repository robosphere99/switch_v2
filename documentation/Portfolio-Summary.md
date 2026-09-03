# 🚀 SwitchNest: Revolutionizing the Smart Home Experience
**A Complete, Edge-to-Cloud IoT Ecosystem Built from Scratch.**

*This document provides an exclusive, high-level look at the engineering, architecture, and innovation powering SwitchNest.*

---

## 🛑 The Problem with Modern Smart Homes
Most smart home platforms available today suffer from three critical flaws:
1. **The "Wait for It" Lag:** Devices rely on heavy, slow HTTP polling. You press a button, and the light takes 3 to 5 seconds to turn on.
2. **Fragmented Ecosystems:** The mobile app is built by one company, the servers by another, and the hardware by a third. When things break, no one knows why.
3. **No Quality Control:** Hardware provisioning is usually slow and manual, leading to buggy deliveries and customer frustration.

## 💡 The SwitchNest Innovation (What Makes Me Different)
I built SwitchNest from the ground up as a **Unified Ecosystem**. I didn't just build an app or just flash a board—I engineered the entire stack.

From the **Node.js/React server** down to the **C++ RTOS firmware** inside the ESP32 chips, and even the **Python Desktop App** used in the factory for mass flashing. By owning the entire pipeline, I eliminated the typical IoT bottlenecks resulting in an ultra-premium, incredibly fast user experience.

---

## 📊 By The Numbers (Performance & Scale)
*   **Response Time:** **< 0.8 seconds** global median latency from tapping the Web/Mobile app to the physical relay clicking in your room (using low-latency MQTT).
*   **Codebase Scale:** Over **280 commits** spanning **50,000+ lines** of TypeScript, C++, Python, and SQL.
*   **Data Integrity:** **21 relational database tables** running on MySQL/Prisma, maintaining perfect sync between virtual devices, homes, and real physical boards.
*   **Factory Speed:** Flashing firmware onto raw ESP32 boards at **460800 baud**, automating what used to take 15 minutes into a seamless 60-second process.

---

## 🛠️ The "Secret Sauce"

### 1. The Autonomous Factory (Flasher GUI)
How do you scale hardware production? I wrote a custom **Python Tkinter Desktop Application (Flasher GUI)** that completely automates hardware fulfillment.
*   It fetches real e-commerce orders from the backend.
*   Flashes the compiled C++ firmware to the ESP32 chip.
*   Injects customer-specific WiFi and authentication credentials directly via Serial Commands.
*   Runs an automated QA test switching all hardware relays on the desk to ensure perfection before packaging!

### 2. Zero-Trust Hardware Security
IoT security is notoriously weak, so I locked the system down tightly. Even if someone gains physical access to the ESP32 board, the Serial console is locked by a rotating, hashed password stored deep in the chip’s Non-Volatile Storage (NVS).

### 3. Bulletproof Architecture
*   **Primary Transport:** Sub-second **MQTT** synchronization for instant toggles.
*   **Self-Healing Fallback:** An intelligent **HTTP long-polling** state machine that takes over automatically if MQTT is restricted by firewalls, ensuring the user is never left in the dark.
*   **Background Jobs:** A reliable cron-engine processing automated user schedules (e.g., "Turn off AC at 3 AM daily") exactly on time.

### 4. Smart Voice Assistants
Not only is there an integrated AI Assistant understanding natural Hindi/English commands, but the platform also natively connects with **Google Home & Amazon Alexa** for global voice control.

---

## 🎯 Wrap-Up: Ready to Experience It?
SwitchNest isn’t just a theoretical project—it is **actively shipping real hardware** to real people. It stands as a testament to full-stack engineering where the cloud and hardware operate in absolute, frictionless harmony.

**Curious to understand how it all connects?** Let's talk architecture.


## 👨‍💻 About The Architect

<div align="center">
  <img src="assets/anil-photo.jpg" alt="Anil" width="180" style="border-radius: 50%; border: 4px solid var(--accent); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3); margin-top: 15px; margin-bottom: 15px;" />

  <h3>Anil Alok</h3>
  <p><strong>B.Tech CSE @ IIIT Ranchi | IoT Engineer & Full-Stack Architect</strong></p>

  <p style="max-width: 650px; margin: 15px auto; line-height: 1.6; color: var(--muted);">
   I engineered the SwitchNest Ecosystem from scratch to demonstrate how modern, zero-trust cloud architectures can seamlessly integrate with physical microcontrollers. With deep expertise across backend scale-out (Node.js/Prisma), frontend polish (React), and low-level embedded systems (ESP32/C++), I specialize in building frictionless, high-performance technology products.
  </p>

  <p style="margin-top: 25px;">
    <a href="assets/Anil-Resume.pdf" target="_blank" style="display: inline-block; padding: 10px 20px; background-color: var(--accent); color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">📄 Download My Resume</a>
  </p>
</div>

