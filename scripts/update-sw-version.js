const fs = require('fs');
const path = require('path');

function updateServiceWorkerVersion() {
  const swPath = path.join(__dirname, '../public/sw.js');
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0]; // YYYYMMDDTHHMMSS
  
  try {
    let swContent = fs.readFileSync(swPath, 'utf8');
    
    // Update the APP_VERSION with current timestamp
    swContent = swContent.replace(
      /const APP_VERSION = "[^"]+"/,
      `const APP_VERSION = "${timestamp}"`
    );
    
    fs.writeFileSync(swPath, swContent);
    console.log(`✅ Updated service worker version to: ${timestamp}`);
    
  } catch (error) {
    console.error('❌ Failed to update service worker version:', error);
    process.exit(1);
  }
}

updateServiceWorkerVersion();