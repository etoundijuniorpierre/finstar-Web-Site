import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { LayoutService } from './layout.service';
import { HomeService } from './home.service';

@Injectable({ providedIn: 'root' })
export class DynamicSocialImageService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly layoutService = inject(LayoutService);
  private readonly homeService = inject(HomeService);

  /**
   * Generate a social media preview image from the current home page content
   * This creates a branded preview showing actual home page elements
   */
  async generateHomePagePreview(): Promise<string> {
    if (!isPlatformBrowser(this.platformId)) {
      return this.getFallbackImage();
    }

    try {
      // Get home page data
      const heroBanner = this.homeService.heroBannerData();
      const favicon = this.layoutService.faviconData();

      if (!heroBanner) {
        return this.getFallbackImage();
      }

      // Create canvas for the social preview
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return this.getFallbackImage();

      // Set Open Graph dimensions
      canvas.width = 1200;
      canvas.height = 630;

      // Create gradient background (matching your brand colors)
      const gradient = ctx.createLinearGradient(0, 0, 1200, 630);
      gradient.addColorStop(0, '#1a365d');
      gradient.addColorStop(1, '#2d5a87');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1200, 630);

      // Add subtle pattern overlay
      this.addBackgroundPattern(ctx);

      // Load and draw favicon if available
      if (favicon) {
        try {
          await this.drawFavicon(ctx, favicon);
        } catch (e) {
          console.warn('Could not load favicon for social image');
        }
      }

      // Add home page content
      await this.drawHomePageContent(ctx, heroBanner);

      return canvas.toDataURL('image/png');
    } catch (error) {
      console.warn(
        '[DynamicSocialImageService] Failed to generate home page preview:',
        error,
      );
      return this.getFallbackImage();
    }
  }

  /**
   * Add background pattern to the canvas
   */
  private addBackgroundPattern(ctx: CanvasRenderingContext2D): void {
    // Create subtle geometric pattern
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';

    // Draw circles pattern
    for (let x = 0; x < 1200; x += 100) {
      for (let y = 0; y < 630; y += 100) {
        ctx.beginPath();
        ctx.arc(x, y, 20, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /**
   * Draw favicon on the canvas
   */
  private async drawFavicon(
    ctx: CanvasRenderingContext2D,
    faviconUrl: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // Draw favicon in top-left corner
        const size = 60;
        const margin = 40;
        ctx.drawImage(img, margin, margin, size, size);
        resolve();
      };
      img.onerror = () => reject(new Error('Failed to load favicon'));
      img.src = faviconUrl;
    });
  }

  /**
   * Draw home page content on the canvas
   */
  private async drawHomePageContent(
    ctx: CanvasRenderingContext2D,
    heroBanner: any,
  ): Promise<void> {
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';

    const centerX = 600; // Center of 1200px canvas
    const maxWidth = 1000; // Max text width

    // Company name at top
    ctx.font = '700 24px "Instrument Sans", Arial, sans-serif';
    ctx.fillStyle = '#ffd700'; // Accent color
    ctx.fillText('FINSTAR-CM S.A.', centerX, 120);

    // Tagline
    ctx.font = '400 16px "Instrument Sans", Arial, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText('Institution de Microfinance au Cameroun', centerX, 150);

    // Main headline (from Directus data)
    if (heroBanner.headline) {
      ctx.font = '700 48px "Instrument Sans", Arial, sans-serif';
      ctx.fillStyle = '#ffffff';
      this.drawMultilineText(
        ctx,
        heroBanner.headline,
        centerX - maxWidth / 2,
        250,
        maxWidth,
        60,
      );
    }

    // Subheadline (from Directus data)
    if (heroBanner.subheadline) {
      ctx.font = '400 18px "Instrument Sans", Arial, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      this.drawMultilineText(
        ctx,
        heroBanner.subheadline,
        centerX - maxWidth / 2,
        380,
        maxWidth,
        30,
      );
    }

    // Try to load and draw hero background image if available
    if (heroBanner.image) {
      try {
        await this.drawHeroBackgroundImage(ctx, heroBanner.image);
      } catch (e) {
        console.warn('Could not load hero background image for social preview');
      }
    }
  }

  /**
   * Draw hero background image as overlay
   */
  private async drawHeroBackgroundImage(
    ctx: CanvasRenderingContext2D,
    imageUrl: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // Save current state
        ctx.save();

        // Draw background image covering entire canvas
        ctx.globalAlpha = 0.3; // Make it subtle so text remains readable
        ctx.drawImage(img, 0, 0, 1200, 630);

        // Add dark overlay to ensure text readability
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, 1200, 630);

        // Restore state
        ctx.restore();

        resolve();
      };
      img.onerror = () =>
        reject(new Error('Failed to load hero background image'));
      img.src = imageUrl;
    });
  }

  /**
   * Draw multiline text with word wrapping
   */
  private drawMultilineText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
  ): void {
    const words = text.split(' ');
    let line = '';
    let currentY = y;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;

      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, currentY);
  }

  /**
   * Get fallback image URL
   */
  private getFallbackImage(): string {
    return '/assets/seo/og-image.png';
  }

  /**
   * Generate and cache a social image, return the data URL
   */
  async generateAndCache(): Promise<string> {
    try {
      const dataUrl = await this.generateHomePagePreview();

      // Store in sessionStorage for reuse
      if (isPlatformBrowser(this.platformId)) {
        sessionStorage.setItem('social-preview-cache', dataUrl);
      }

      return dataUrl;
    } catch (error) {
      console.warn(
        '[DynamicSocialImageService] Failed to generate and cache:',
        error,
      );
      return this.getFallbackImage();
    }
  }

  /**
   * Get cached social image or generate new one
   */
  getCachedOrGenerate(): Promise<string> {
    if (isPlatformBrowser(this.platformId)) {
      const cached = sessionStorage.getItem('social-preview-cache');
      if (cached) {
        return Promise.resolve(cached);
      }
    }

    return this.generateAndCache();
  }
}
