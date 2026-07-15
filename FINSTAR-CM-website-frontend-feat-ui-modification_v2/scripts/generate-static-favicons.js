/**
 * Script to generate static favicon files from your Directus favicon
 * This helps Google find your favicon in search results
 * 
 * Requirements:
 * npm install puppeteer sharp
 * 
 * Usage:
 * node scripts/generate-static-favicons.js [directus-favicon-url]
 * 
 * Example:
 * node scripts/generate-static-favicons.js https://your-directus.com/assets/your-favicon-id
 */

const puppeteer = require('puppeteer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

async function toPngBufferFromIco(icoBuffer) {
  const icoToPng = require('ico-to-png');
  const candidateSizes = [512, 256, 192, 128, 64];

  let lastError;
  for (const size of candidateSizes) {
    try {
      return await icoToPng(icoBuffer, size);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Unable to extract PNG from ICO');
}

async function generateStaticFavicons(faviconSource) {
  try {
    const publicDir = path.join(__dirname, '../public');
    const seoDir = path.join(publicDir, 'assets/seo');
    const iconsDir = path.join(publicDir, 'icons');

    if (!fs.existsSync(seoDir)) {
      fs.mkdirSync(seoDir, { recursive: true });
    }

    if (!fs.existsSync(iconsDir)) {
      fs.mkdirSync(iconsDir, { recursive: true });
    }

    const defaultFaviconPath = path.join(publicDir, 'favicon.ico');
    const source = faviconSource || defaultFaviconPath;

    console.log('🎨 Generating static favicon files...');
    console.log('📍 Favicon source:', source);

    let faviconBuffer;
    let sourceLooksLikeIco = false;

    if (typeof source === 'string' && /^https?:\/\//.test(source)) {
      console.log('⬇️ Downloading favicon from URL...');
      faviconBuffer = await downloadImage(source);
      sourceLooksLikeIco = /\.ico(\?|#|$)/i.test(source);
    } else {
      console.log('📁 Using local favicon file...');
      faviconBuffer = fs.readFileSync(source);
      sourceLooksLikeIco = typeof source === 'string' && source.toLowerCase().endsWith('.ico');
    }

    if (sourceLooksLikeIco) {
      console.log('🧩 ICO source detected, extracting PNG for processing...');
      faviconBuffer = await toPngBufferFromIco(faviconBuffer);
    }

    const faviconSizes = [
      { size: 16, output: path.join(seoDir, 'favicon-16x16.png') },
      { size: 32, output: path.join(seoDir, 'favicon-32x32.png') },
      { size: 180, output: path.join(seoDir, 'apple-touch-icon.png') }
    ];

    const iconSizes = [
      { size: 72, output: path.join(iconsDir, 'icon-72x72.png') },
      { size: 96, output: path.join(iconsDir, 'icon-96x96.png') },
      { size: 128, output: path.join(iconsDir, 'icon-128x128.png') },
      { size: 144, output: path.join(iconsDir, 'icon-144x144.png') },
      { size: 152, output: path.join(iconsDir, 'icon-152x152.png') },
      { size: 192, output: path.join(iconsDir, 'icon-192x192.png') },
      { size: 384, output: path.join(iconsDir, 'icon-384x384.png') },
      { size: 512, output: path.join(iconsDir, 'icon-512x512.png') }
    ];

    const allSizes = [...faviconSizes, ...iconSizes];

    console.log('🔧 Generating favicon files...');

    for (const { size, output } of allSizes) {
      await sharp(faviconBuffer)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toFile(output);

      console.log(`✅ Generated ${path.basename(output)} (${size}x${size})`);
    }

    console.log('');
    console.log('🎉 All favicon and app icon files generated successfully!');
    console.log('');
    console.log('📁 Generated files include:');
    console.log('├── public/assets/seo/favicon-16x16.png');
    console.log('├── public/assets/seo/favicon-32x32.png');
    console.log('├── public/assets/seo/apple-touch-icon.png');
    console.log('└── public/icons/icon-**x**.png (72, 96, 128, 144, 152, 192, 384, 512)');
    console.log('');
    console.log('🚀 Next steps:');
    console.log('1. Deploy your website with these new favicon and icon files');
    console.log('2. Wait 24-48 hours for Google and browsers to update');
    console.log('3. Test with: https://www.google.com/search?q=site:finstar-cm.com');
    console.log('');
    console.log('💡 The favicon and app icons should now consistently use your FINSTAR-CM logo!');

  } catch (error) {
    console.error('❌ Error generating static favicons:', error.message);
    process.exit(1);
  }
}

/**
 * Download image from URL
 */
function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    
    client.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download image: ${response.statusCode}`));
        return;
      }

      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
}

// Run if called directly
if (require.main === module) {
  const faviconUrl = process.argv[2];
  generateStaticFavicons(faviconUrl);
}

module.exports = { generateStaticFavicons };