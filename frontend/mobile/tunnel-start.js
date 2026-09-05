const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('\n======================================================');
console.log('   SWITCHNEST WIRELESS DEVELOPER TUNNEL STARTER');
console.log('======================================================\n');
console.log('[Tunnel Starter] Spawning localtunnel on port 4000 (Backend API)...');

// Start localtunnel as a child process
const lt = spawn('npx', ['localtunnel', '--port', '4000'], { shell: true });

let ltUrl = '';

lt.stdout.on('data', (data) => {
    const text = data.toString();
    console.log(`[Localtunnel] ${text.trim()}`);

    // Look for the URL in the output (e.g. "your url is: https://xxxx.localtunnel.me")
    const match = text.match(/your url is: (https:\/\/[^\s]+)/);
    if (match) {
        ltUrl = match[1];
        console.log(`\n[Tunnel Starter] Success! Detected tunnel URL: ${ltUrl}`);

        // Update .env file with the dynamic tunnel URL
        const envPath = path.join(__dirname, '.env');
        const apiUrl = `${ltUrl}/api`;

        if (fs.existsSync(envPath)) {
            let content = fs.readFileSync(envPath, 'utf8');
            const regex = /EXPO_PUBLIC_API_URL=[^\n]+/g;
            if (regex.test(content)) {
                content = content.replace(regex, `EXPO_PUBLIC_API_URL=${apiUrl}`);
            } else {
                content = `EXPO_PUBLIC_API_URL=${apiUrl}\n` + content;
            }
            fs.writeFileSync(envPath, content, 'utf8');
        } else {
            const rawContent = `EXPO_PUBLIC_API_URL=${apiUrl}\nEXPO_PUBLIC_RAZORPAY_KEY_ID="rzp_test_TSVHF7cuVgmwiF"\n`;
            fs.writeFileSync(envPath, rawContent, 'utf8');
        }
        console.log(`[Tunnel Starter] Dynamic .env successfully updated to: ${apiUrl}`);
        console.log('[Tunnel Starter] Starting Expo with Tunneling enabled...\n');

        // Start Expo with tunnel
        const expo = spawn('npx', ['expo', 'start', '--tunnel'], { stdio: 'inherit', shell: true });

        expo.on('close', (code) => {
            console.log(`[Expo] Bundler process exited with code ${code}`);
            // Terminate the localtunnel child process too
            lt.kill();
            process.exit(code);
        });
    }
});

lt.stderr.on('data', (data) => {
    const errText = data.toString().trim();
    if (errText) {
        console.error(`[Localtunnel Error] ${errText}`);
    }
});

lt.on('close', (code) => {
    console.log(`[Localtunnel] Connection tunnel closed (${code})`);
});
