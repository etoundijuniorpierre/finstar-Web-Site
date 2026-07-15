import { inject, Injectable, PLATFORM_ID, effect } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { LayoutService } from './layout.service';

@Injectable({ providedIn: 'root' })
export class StaticFaviconGeneratorService {
  private readonly layoutService = inject(LayoutService);
  private readonly platformId = inject(PLATFORM_ID);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      // Generate static favicon files when Directus favicon changes
      effect(() => {
        const faviconUrl = this.layoutService.faviconData();
        if (faviconUrl) {
          this.generateStaticFaviconFiles(faviconUrl);
        }
      });
    }
  }

  /**
   * Generate static favicon files that Google can easily find
   */
  private async generateStaticFaviconFiles(faviconUrl: string): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      // Load the Directus favicon
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load Directus favicon'));
        img.src = faviconUrl;
      });

      // Generate the main favicon.ico (32x32)
      await this.generateAndSaveFavicon(img, 32, '/favicon.ico');
      
      // Generate additional sizes for better Google compatibility
      await this.generateAndSaveFavicon(img, 16, '/assets/seo/favicon-16x16.png');
      await this.generateAndSaveFavicon(img, 32, '/assets/seo/favicon-32x32.png');
      await this.generateAndSaveFavicon(img, 180, '/assets/seo/apple-touch-icon.png');

      console.log('[StaticFaviconGenerator] Generated static favicon files from Directus');

    } catch (error) {
      console.warn('[StaticFaviconGenerator] Failed to generate static favicons:', error);
    }
  }

  /**
   * Generate a favicon of specific size and save it
   */
  private async generateAndSaveFavicon(sourceImage: HTMLImageElement, size: number, path: string): Promise<void> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = size;
    canvas.height = size;
    
    // Clear canvas with transparent background
    ctx.clearRect(0, 0, size, size);
    
    // Draw the favicon
    ctx.drawImage(sourceImage, 0, 0, size, size);
    
    // Convert to blob
    return new Promise((resolve) => {
      canvas.toBlob(async (blob) => {
        if (blob) {
          // In a real implementation, you would send this to your server
          // For now, we'll create a downloadable link for manual upload
          const dataUrl = canvas.toDataURL('image/png');
          
          // Store in sessionStorage for potential use
          sessionStorage.setItem(`favicon-${size}`, dataUrl);
          
          console.log(`Generated favicon ${size}x${size} - stored in sessionStorage as favicon-${size}`);
        }
        resolve();
      }, 'image/png');
    });
  }

  /**
   * Get generated favicon data URL for a specific size
   */
  getGeneratedFavicon(size: number): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    return sessionStorage.getItem(`favicon-${size}`) || null;
  }

  /**
   * Download all generated favicons as files
   */
  downloadGeneratedFavicons(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const sizes = [16, 32, 180];
    sizes.forEach(size => {
      const dataUrl = this.getGeneratedFavicon(size);
      if (dataUrl) {
        const link = document.createElement('a');
        link.download = size === 180 ? 'apple-touch-icon.png' : `favicon-${size}x${size}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    });

    console.log('Downloaded all generated favicon files. Upload these to your server:');
    console.log('- favicon-16x16.png → /assets/seo/');
    console.log('- favicon-32x32.png → /assets/seo/ and /favicon.ico');
    console.log('- apple-touch-icon.png → /assets/seo/');
  }
}