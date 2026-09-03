import { getSiteSettings } from './src/services/siteSettings.service.js';
async function run() {
  const s = await getSiteSettings();
  console.log('Site URL:', s.siteUrl);
  process.exit(0);
}
run();
