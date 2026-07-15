import { inject, Injectable, PLATFORM_ID, effect } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { LayoutService } from './layout.service';

export interface IconSize {
  size: number;
  name: string;
  purpose?: string;
}

@Injectable({ providedIn: 'root' })
export class DynamicIconsService {
  private readonly layoutService = inject(LayoutService);
  private readonly platformId = inject(PLATFORM_ID);
  
  private readonly iconSizes: IconSize[] = [
    { size: 72, name: 'icon-72x72.png' },
    { size: 96, name: 'icon-96x96.png' },
    { size: 128, name: 'icon-128x128.png' },
    { size: 144, name: 'icon-144x144.png' },
    { size: 152, name: 'icon-152x152.png' },
    { size: 192, name: 'icon-192x192.png' },
    { size: 384, name: 'icon-384x384.png' },
    { size: 512, name: 'icon-512x512.png' },
  ];

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private readonly generatedIcons = new Map<string, string>();

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.initCanvas();
      
      // React to favicon changes from Directus
      effect(() => {
        const faviconUrl = this.layoutService.faviconData();
        if (faviconUrl) {
          this.generateAllIcons(faviconUrl);
          this.updateManifestIcons();
        }
      });
    }
  }

  private initCanvas(): void {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
  }

  /**
   * Generate all required icon sizes from the Directus favicon
   */
  private async generateAllIcons(faviconUrl: string): Promise<void> {
    if (!this.canvas || !this.ctx) return;

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load favicon'));
        img.src = faviconUrl;
      });

      // Generate each icon size
      for (const { size, name } of this.iconSizes) {
        const iconDataUrl = this.generateIcon(img, size);
        if (iconDataUrl) {
          this.generatedIcons.set(name, iconDataUrl);
        }
      }

      // Also generate additional favicon sizes
      const faviconSizes = [16, 32, 180]; // 16x16, 32x32, apple-touch-icon
      for (const size of faviconSizes) {
        const iconDataUrl = this.generateIcon(img, size);
        if (iconDataUrl) {
          this.generatedIcons.set(`favicon-${size}x${size}.png`, iconDataUrl);
        }
      }

    } catch (error) {
      console.warn('[DynamicIconsService] Failed to generate icons:', error);
    }
  }

  /**
   * Generate a single icon of specified size
   */
  private generateIcon(sourceImage: HTMLImageElement, size: number): string | null {
    if (!this.canvas || !this.ctx) return null;

    try {
      this.canvas.width = size;
      this.canvas.height = size;
      
      // Clear canvas
      this.ctx.clearRect(0, 0, size, size);
      
      // Draw the image scaled to fit
      this.ctx.drawImage(sourceImage, 0, 0, size, size);
      
      // Return as data URL
      return this.canvas.toDataURL('image/png');
    } catch (error) {
      console.warn(`[DynamicIconsService] Failed to generate ${size}x${size} icon:`, error);
      return null;
    }
  }

  /**
   * Update the manifest with dynamically generated icons
   */
  private updateManifestIcons(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Update manifest link to point to our dynamic manifest
    let manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
    if (manifestLink) {
      // Create a blob URL with updated manifest
      const updatedManifest = this.generateUpdatedManifest();
      const blob = new Blob([JSON.stringify(updatedManifest, null, 2)], { 
        type: 'application/json' 
      });
      const blobUrl = URL.createObjectURL(blob);
      manifestLink.href = blobUrl;
    }
  }

  /**
   * Generate updated manifest with dynamic icons
   */
  private generateUpdatedManifest(): any {
    const baseManifest: {
      name: string;
      short_name: string;
      description: string;
      display: string;
      scope: string;
      start_url: string;
      theme_color: string;
      background_color: string;
      icons: Array<{
        src: string;
        sizes: string;
        type: string;
        purpose: string;
      }>;
    } = {
      name: "FINSTAR-CM SA - Institution de Microfinance",
      short_name: "FINSTAR-CM",
      description: "Solutions d'épargne et de crédit sécurisées au Cameroun",
      display: "standalone",
      scope: "./",
      start_url: "./",
      theme_color: "#1a365d",
      background_color: "#ffffff",
      icons: []
    };

    // Add generated icons to manifest
    for (const { size, name } of this.iconSizes) {
      const iconDataUrl = this.generatedIcons.get(name);
      if (iconDataUrl) {
        baseManifest.icons.push({
          src: iconDataUrl,
          sizes: `${size}x${size}`,
          type: "image/png",
          purpose: "maskable any"
        });
      }
    }

    return baseManifest;
  }

  /**
   * Get a generated icon by name
   */
  getIcon(name: string): string | null {
    return this.generatedIcons.get(name) || null;
  }

  /**
   * Get all generated icons
   */
  getAllIcons(): Map<string, string> {
    return new Map(this.generatedIcons);
  }

  /**
   * Update additional favicon links in the head
   */
  updateFaviconLinks(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    
    // Update apple-touch-icon
    const appleTouchIcon = this.generatedIcons.get('favicon-180x180.png');
    if (appleTouchIcon) {
      this.updateOrCreateLink('apple-touch-icon', appleTouchIcon, '180x180');
    }

    // Update 32x32 favicon
    const favicon32 = this.generatedIcons.get('favicon-32x32.png');
    if (favicon32) {
      this.updateOrCreateLink('icon', favicon32, '32x32', 'image/png');
    }

    // Update 16x16 favicon
    const favicon16 = this.generatedIcons.get('favicon-16x16.png');
    if (favicon16) {
      this.updateOrCreateLink('icon', favicon16, '16x16', 'image/png');
    }
  }

  private updateOrCreateLink(rel: string, href: string, sizes?: string, type?: string): void {
    const sizeSelector = sizes ? `[sizes="${sizes}"]` : '';
    let link = document.head.querySelector(`link[rel="${rel}"]${sizeSelector}`) as HTMLLinkElement;
    
    if (!link) {
      link = document.createElement('link');
      link.rel = rel;
      if (sizes) link.setAttribute('sizes', sizes);
      if (type) link.type = type;
      document.head.appendChild(link);
    }
    
    link.href = href;
  }
}