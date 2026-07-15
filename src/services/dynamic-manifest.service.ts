import { inject, Injectable, PLATFORM_ID, effect, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { LayoutService } from './layout.service';
import { DynamicIconsService } from './dynamic-icons.service';

@Injectable({ providedIn: 'root' })
export class DynamicManifestService implements OnDestroy {
  private readonly layoutService = inject(LayoutService);
  private readonly dynamicIcons = inject(DynamicIconsService);
  private readonly platformId = inject(PLATFORM_ID);
  
  private manifestBlobUrl: string | null = null;
  private updateTimeout?: ReturnType<typeof setTimeout>;
  private destroyed = false;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      // Update manifest when favicon changes
      effect(() => {
        const faviconUrl = this.layoutService.faviconData();
        if (faviconUrl) {
          // Wait a bit for icons to be generated
          if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
          }
          this.updateTimeout = setTimeout(() => {
            if (!this.destroyed) {
              this.updateManifest();
            }
          }, 500);
        }
      });
    }
  }

  /**
   * Update the manifest with dynamic icons from Directus favicon
   */
  private updateManifest(): void {
    if (!isPlatformBrowser(this.platformId) || this.destroyed) return;

    const manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
    if (!manifestLink) return;

    // Clean up previous blob URL
    if (this.manifestBlobUrl) {
      URL.revokeObjectURL(this.manifestBlobUrl);
    }

    // Generate new manifest with dynamic icons
    const manifest = this.generateManifest();
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { 
      type: 'application/json' 
    });
    
    this.manifestBlobUrl = URL.createObjectURL(blob);
    manifestLink.href = this.manifestBlobUrl;
    
    console.log('[DynamicManifestService] Updated manifest with Directus favicon icons');
  }

  /**
   * Generate manifest with dynamic icons
   */
  private generateManifest(): any {
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

    // Get all generated icons from the dynamic icons service
    const generatedIcons = this.dynamicIcons.getAllIcons();
    
    // Define the icon sizes we want in the manifest
    const iconSizes = [
      { size: 72, name: 'icon-72x72.png' },
      { size: 96, name: 'icon-96x96.png' },
      { size: 128, name: 'icon-128x128.png' },
      { size: 144, name: 'icon-144x144.png' },
      { size: 152, name: 'icon-152x152.png' },
      { size: 192, name: 'icon-192x192.png' },
      { size: 384, name: 'icon-384x384.png' },
      { size: 512, name: 'icon-512x512.png' },
    ];

    // Add generated icons to manifest
    for (const { size, name } of iconSizes) {
      const iconDataUrl = generatedIcons.get(name);
      if (iconDataUrl) {
        baseManifest.icons.push({
          src: iconDataUrl,
          sizes: `${size}x${size}`,
          type: "image/png",
          purpose: "maskable any"
        });
      } else {
        // Fallback to static icons if dynamic generation failed
        baseManifest.icons.push({
          src: `icons/${name}`,
          sizes: `${size}x${size}`,
          type: "image/png",
          purpose: "maskable any"
        });
      }
    }

    return baseManifest;
  }

  /**
   * Clean up blob URLs when service is destroyed
   */
  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
    if (this.manifestBlobUrl) {
      URL.revokeObjectURL(this.manifestBlobUrl);
    }
  }
}
