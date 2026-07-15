const fs = require('fs');
const path = require('path');

// Simple PWA icon generator using your existing logo
// This creates placeholder icons - you should replace with proper icons later

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = path.join(__dirname, '../public/icons');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Create simple SVG-based icons as placeholders
sizes.forEach(size => {
  const svgContent = `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#1a365d"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${size * 0.3}" fill="white" text-anchor="middle" dominant-baseline="middle">F</text>
</svg>`;

  const fileName = `icon-${size}x${size}.png`;
  const filePath = path.join(iconsDir, fileName);
  
  // For now, create SVG files (you can convert to PNG later with proper tools)
  const svgFileName = `icon-${size}x${size}.svg`;
  const svgFilePath = path.join(iconsDir, svgFileName);
  
  fs.writeFileSync(svgFilePath, svgContent.trim());
  console.log(`Created ${svgFileName}`);
});

console.log('\n✅ PWA icons generated successfully!');
console.log('📝 Note: These are SVG placeholders. For production, convert to PNG using:');
console.log('   - Online tools like https://convertio.co/svg-png/');
console.log('   - Or use your actual logo with proper design tools');