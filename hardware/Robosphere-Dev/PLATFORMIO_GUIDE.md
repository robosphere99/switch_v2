# SwitchNest Hardware - PlatformIO Setup & Build Guide

Ye guide step-by-step batayegi ki ESP32 firmware (yeh folder) ko Visual Studio Code aur PlatformIO use karke kaise open, compile, aur flash kiya jaye.

## 1. Prerequisites (PlatformIO Install Karna)
1. **Visual Studio Code (VS Code)** ko kholiye.
2. Left sidebar mein **Extensions** (ya `Ctrl+Shift+X`) par click karein.
3. Search bar mein **"PlatformIO IDE"** likhiye aur official extension by PlatformIO ko Install karein.
4. VS Code ko restart karein. Start hone me kuch minutes lagenge kyuki PlatformIO apna core install karega. Jab tak bottom bar pe "PlatformIO: Core installed" ka notification na aaye, rukhein.

## 2. Pura Project Open Karna (Sahi Folder Ka Chunna)
Ye step kaafi crucial hai. PlatformIO ke theek se kaam karne ke liye aapko exact wahi folder open karna hoga jisme `platformio.ini` file maujood ho.

1. VS Code me upar menu se **File > Open Folder...** par click karein.
2. Is exact raste (path) par jayen aur is folder ko select karein:
   👉 `c:\Users\robos\OneDrive\Documents\SwitchNest\hardware\Robosphere-Dev`
3. Agar VS Code "Trust the authors" puche, toh "Yes, I trust the authors" par click kar dein.
4. VS Code ab automatically is folder ko detect karega aur PlatformIO initialize kar dega (niche blue status bar mein PlatformIO ke alag alag options dikhne lagenge aur left sidebar mein ek alien jaisi PlatformIO button aayegi).

> ⚠️ **Error Attention:** Agar aap galti se bahar wala `hardware` folder ya `SwitchNest` root folder kholte hain (jisme platformio.ini bahar exist ni krta), to PlatformIO error dega ya C++ mein laal lines show karega, aur build button kaam nahin karenga. Hmesha directly `Robosphere-Dev` ko VS Code se open karo.

## 3. Project Compile (Build) Karna
Jab aapne ab model fix waali files me changes kar liye hain (`BoardManager.cpp`), to aapko naya binary (`firmware.bin`) generate karna hai:
1. Bottom blue status bar (ya left PIO panel) mein ek **✓ (Tick Mark)** icon hota hai jo "Build" function karta hai.
2. Tick mark pe click karein.
3. Niche Terminal khud ba khud khulega aur "Building..." process shuru hogi. Sab theek raha toh kuch der baad terminal me **[SUCCESS]** dikhai dega.

## 4. Firmware.bin Kahan Milega?
PlatformIO apna build kiya hua `.bin` file ek naye hidden folder me banata hai:
1. VS Code ke File Explorer me `.pio` > `build` > (jo bhi environment select hai, jaise `esp32dev`) folder kholiye.
2. Us folder mein ek file hogi jiska naam **`firmware.bin`** hoga.
3. **Voilá!** Yahi aapka naya generic SwitchNest firmware image (binary) code hai jisme naya dynamic pin-allocation method compile kr dia gaya hai. 
4. Is `firmware.bin` ko seedha backend server (`/firmware` directory) mein copy kar dein. Ab jab GUI flasher chalega to vo is new updated image ko automatic utha lega.

## 5. (Direct) USB se Upload Karna
Agar aap Flasher tool use nai karna chahte abhi, aur direct upload karna chahte hain hardware pe USB ke trough testing ke liye:
1. Apna ESP32 USB cable se PC me lagayen.
2. VS Code ke bottom status bar mein **→ (Right Arrow)** ya "Upload" icon par click karein.
3. Automatically build hoga aur serial port port dhundhkar seedhe hardware mein naya firmware flash kargenga. 
