/**
 * Script to generate social media preview image from actual home page hero banner
 * 
 * Requirements:
 * npm install puppeteer
 * 
 * Usage:
 * node scripts/generate-social-image.js [url]
 * 
 * Examples:
 * node scripts/generate-social-image.js http://localhost:4200
 * node scripts/generate-social-image.js https://finstar-cm.com
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function generateSocialImageFromHomePage(url = 'http://localhost:4200') {
  console.log('🎨 Generating social media preview from hero banner...');
  console.log('📍 URL:', url);

  const jpegQuality = 80;
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  try {
    // Set viewport to capture hero banner properly
    await page.setViewport({ width: 1200, height: 800 });
    
    // Navigate to home page
    console.log('🌐 Loading home page...');
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Wait for Angular app to load
    try {
      await page.waitForSelector('app-home', { timeout: 15000 });
      console.log('✅ Angular app loaded');
      
      // Check if we're in a loading or error state
      const pageState = await page.evaluate(() => {
        return {
          hasLoadingIndicator: !!document.querySelector('.loading-indicator'),
          hasErrorMessage: !!document.querySelector('.error-message'),
          appHomeContent: document.querySelector('app-home')?.innerHTML?.length || 0
        };
      });
      
      if (pageState.hasLoadingIndicator) {
        console.log('⏳ Page is in loading state, waiting longer...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
      
      if (pageState.hasErrorMessage) {
        console.log('❌ Page shows error state, may not be able to capture hero banner');
      }
      
      console.log(`📄 App home content length: ${pageState.appHomeContent} characters`);
      
    } catch (e) {
      console.log('⚠️ Angular app selector not found, proceeding anyway...');
    }

    // Wait longer for content to load and try multiple selectors
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Wait specifically for Directus data to load and hero banner to appear
    console.log('⏳ Waiting for Directus data to load...');
    try {
      await page.waitForFunction(() => {
        // Check if the hero banner with background image exists
        const heroSection = document.querySelector('.fade-in-on-load');
        if (heroSection) {
          const bgImage = heroSection.style.backgroundImage;
          const hasHeadline = document.querySelector('h1');
          console.log('Hero found with bg:', bgImage, 'and headline:', !!hasHeadline);
          return bgImage && bgImage !== 'none' && bgImage !== '' && hasHeadline;
        }
        return false;
      }, { timeout: 20000 }); // Increased timeout for Directus data
      console.log('✅ Directus data loaded and hero banner ready');
    } catch (e) {
      console.log('⚠️ Timeout waiting for Directus data, checking what we have...');
    }
    
    // Check for various possible hero banner selectors
    const heroInfo = await page.evaluate(() => {
      const selectors = [
        '.fade-in-on-load',
        '[style*="background-image"]',
        'app-home > div:first-child',
        '.hero-section',
        '.hero-banner',
        '[class*="hero"]',
        '[class*="banner"]',
        'h1' // Check for headline
      ];
      
      const results = {};
      
      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        results[selector] = {
          count: elements.length,
          hasBackgroundImage: Array.from(elements).some(el => 
            el.style.backgroundImage && el.style.backgroundImage !== 'none'
          ),
          textContent: elements.length > 0 ? elements[0].textContent?.substring(0, 100) : null,
          className: elements.length > 0 ? elements[0].className : null
        };
      });
      
      // Also check the overall page structure
      results['pageInfo'] = {
        appHomeExists: !!document.querySelector('app-home'),
        bodyClasses: document.body.className,
        hasH1: !!document.querySelector('h1'),
        h1Text: document.querySelector('h1')?.textContent?.substring(0, 50) || null,
        totalDivs: document.querySelectorAll('div').length,
        hasLoadingIndicator: !!document.querySelector('.loading-indicator'),
        hasErrorMessage: !!document.querySelector('.error-message')
      };
      
      return results;
    });
    
    console.log('🔍 Hero banner detection results:', JSON.stringify(heroInfo, null, 2));

    // Wait for hero banner data to load from Directus
    try {
      await page.waitForFunction(() => {
        const heroSection = document.querySelector('.fade-in-on-load') || 
                           document.querySelector('[style*="background-image"]') ||
                           document.querySelector('app-home > div:first-child');
        
        if (heroSection) {
          const bgImage = heroSection.style.backgroundImage;
          return bgImage && bgImage !== 'none' && bgImage !== '';
        }
        return false;
      }, { timeout: 10000 });
      console.log('✅ Hero banner background loaded');
    } catch (e) {
      console.log('⚠️ Hero banner background not detected, will capture viewport instead');
    }

    // Wait for content to fully render
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Hide elements that shouldn't appear in social preview
    await page.evaluate(() => {
      // Hide navigation
      const navbar = document.querySelector('app-navbar');
      if (navbar) navbar.style.display = 'none';
      
      // Hide footer
      const footer = document.querySelector('app-footer');
      if (footer) footer.style.display = 'none';
      
      // Hide infinite scroll section (keep only hero content)
      const infiniteScroll = document.querySelector('.infinite-scroll-container');
      if (infiniteScroll) infiniteScroll.style.display = 'none';
      
      // Hide everything after the hero banner
      const visionsSection = document.querySelector('.visions-section');
      if (visionsSection) visionsSection.style.display = 'none';
      
      const performanceSection = document.querySelector('.performance');
      if (performanceSection) performanceSection.style.display = 'none';
      
      const testimonialsSection = document.querySelector('.testimonials');
      if (testimonialsSection) testimonialsSection.style.display = 'none';
      
      const joinUsSection = document.querySelector('app-join-us');
      if (joinUsSection) joinUsSection.style.display = 'none';
      
      // Ensure hero banner takes full viewport
      const heroSection = document.querySelector('.fade-in-on-load');
      if (heroSection) {
        heroSection.style.minHeight = '630px';
        heroSection.style.height = '630px';
        heroSection.style.display = 'flex';
        heroSection.style.flexDirection = 'column';
        heroSection.style.justifyContent = 'center';
      }
      
      // Scroll to top to ensure we capture the hero section
      window.scrollTo(0, 0);
    });
    
    // Wait a bit more for styles to apply
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Take screenshot of the hero banner
    console.log('📸 Capturing hero banner screenshot...');
    
    let screenshotBuffer;
    let screenshotSource = 'viewport';
    try {
      // Try multiple selectors for the hero banner
      const selectors = [
        '.fade-in-on-load',
        '[style*="background-image"]',
        'app-home > div:first-child',
        'app-home'
      ];
      
      let heroElement = null;
      for (const selector of selectors) {
        heroElement = await page.$(selector);
        if (heroElement) {
          console.log(`✅ Found hero element with selector: ${selector}`);
          break;
        }
      }
      
      if (heroElement) {
        screenshotBuffer = await heroElement.screenshot({
          type: 'png'
        });
        screenshotSource = 'element';
        console.log('✅ Captured hero banner element');
      } else {
        throw new Error('No hero banner element found');
      }
    } catch (e) {
      // Fallback: capture viewport area
      console.log('📸 Fallback: capturing viewport area...');
      screenshotBuffer = await page.screenshot({
        type: 'png',
        fullPage: false,
        clip: {
          x: 0,
          y: 0,
          width: 1200,
          height: 630
        }
      });
    }
    
    // Process the image to fit Open Graph dimensions (1200x630)
    const outputPath = path.join(__dirname, '../public/assets/seo/og-image.jpg');
    
    // If we have sharp available, resize properly
    try {
      const sharp = require('sharp');
      await sharp(screenshotBuffer)
        .resize(1200, 630, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: jpegQuality, mozjpeg: true, progressive: true })
        .toFile(outputPath);
      console.log(`✅ Image resized with Sharp to 1200x630px and compressed as JPEG (quality=${jpegQuality})`);
    } catch (e) {
      // Fallback: save as JPEG directly from Puppeteer to reduce file size
      console.log('⚠️ Sharp not available, attempting JPEG screenshot fallback...');

      try {
        if (screenshotSource === 'element') {
          const heroElement = await page.$('.fade-in-on-load')
            || await page.$('[style*="background-image"]')
            || await page.$('app-home > div:first-child')
            || await page.$('app-home');

          if (heroElement) {
            await heroElement.screenshot({
              path: outputPath,
              type: 'jpeg',
              quality: jpegQuality
            });
          } else {
            await page.screenshot({
              path: outputPath,
              type: 'jpeg',
              quality: jpegQuality,
              fullPage: false,
              clip: { x: 0, y: 0, width: 1200, height: 630 }
            });
          }
        } else {
          await page.screenshot({
            path: outputPath,
            type: 'jpeg',
            quality: jpegQuality,
            fullPage: false,
            clip: { x: 0, y: 0, width: 1200, height: 630 }
          });
        }

        console.log(`✅ Saved JPEG preview without Sharp (quality=${jpegQuality})`);
      } catch (fallbackError) {
        // Last resort: write the PNG buffer to a .jpg path (will not be ideal, but prevents total failure)
        fs.writeFileSync(outputPath, screenshotBuffer);
        console.log('⚠️ Could not generate JPEG fallback, saved raw buffer instead');
      }

      console.log('💡 Install Sharp for best image processing: npm install sharp --save-dev');
    }
    
    console.log('✅ Social media preview image generated:', outputPath);
    console.log('📏 Image dimensions: 1200x630px (Open Graph standard)');
    console.log('🎯 Content: Hero banner with background, headline, and subheadline');
    console.log('🔗 This image will be used for WhatsApp, Facebook, Twitter, and other social media previews');
    
  } catch (error) {
    console.error('❌ Error generating social image:', error.message);
    
    // Generate fallback image with your branding
    console.log('🔄 Generating fallback branded image...');
    await generateFallbackImage();
    
  } finally {
    await browser.close();
  }
}

async function generateFallbackImage() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  const jpegQuality = 80;

  // Set viewport to Open Graph dimensions
  await page.setViewport({ width: 1200, height: 630 });

  // Create HTML content for fallback that matches your hero banner style
  const fallbackHTML = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400..700;1,400..700&display=swap" rel="stylesheet">
        <style>
            body {
                margin: 0;
                padding: 0;
                width: 1200px;
                height: 630px;
                background: linear-gradient(135deg, #1a365d 0%, #2d5a87 100%);
                font-family: 'Instrument Sans', -apple-system, BlinkMacSystemFont, sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                position: relative;
                overflow: hidden;
            }
            
            .hero-container {
                text-align: center;
                z-index: 2;
                max-width: 900px;
                padding: 60px 40px;
            }
            
            .headline {
                font-size: 48px;
                font-weight: 500;
                margin-bottom: 24px;
                color: #ffffff;
                line-height: 1.2;
                font-family: 'Instrument Sans', sans-serif;
            }
            
            .subheadline {
                font-size: 18px;
                font-weight: 400;
                margin-bottom: 40px;
                opacity: 0.9;
                line-height: 1.6;
                max-width: 600px;
                margin-left: auto;
                margin-right: auto;
            }
            
            .company-name {
                font-size: 24px;
                font-weight: 600;
                color: #ffd700;
                margin-bottom: 8px;
            }
            
            .tagline {
                font-size: 16px;
                opacity: 0.8;
                color: #ffffff;
            }
            
            .background-pattern {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                opacity: 0.1;
                background-image: 
                    radial-gradient(circle at 25% 25%, rgba(255,255,255,0.2) 0%, transparent 50%),
                    radial-gradient(circle at 75% 75%, rgba(255,255,255,0.1) 0%, transparent 50%);
            }
        </style>
    </head>
    <body>
        <div class="background-pattern"></div>
        <div class="hero-container">
            <div class="company-name">FINSTAR-CM SA</div>
            <div class="tagline">Institution de Microfinance au Cameroun</div>
            <div class="headline">Solutions d'épargne et de crédit sécurisées</div>
            <div class="subheadline">
                Nous offrons des services financiers adaptés aux besoins des particuliers et entreprises au Cameroun
            </div>
        </div>
    </body>
    </html>
  `;
  
  await page.setContent(fallbackHTML);
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const outputPath = path.join(__dirname, '../public/assets/seo/og-image.jpg');
  await page.screenshot({
    path: outputPath,
    type: 'jpeg',
    quality: jpegQuality
  });
  
  await browser.close();
  console.log('✅ Fallback social image generated with FINSTAR-CM branding');
}

// ... (rest of the code remains the same)
if (require.main === module) {
  const url = process.argv[2] || 'http://localhost:4200';
  generateSocialImageFromHomePage(url).catch(console.error);
}

module.exports = { generateSocialImageFromHomePage };