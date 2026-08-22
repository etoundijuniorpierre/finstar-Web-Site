import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { LayoutService } from './layout.service';
import { DynamicSocialImageService } from './dynamic-social-image.service';
import { environment } from '../environments/environment';

export interface SocialPreviewConfig {
  title: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
  useDynamicImage?: boolean;
}

@Injectable({ providedIn: 'root' })
export class SocialPreviewService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly layoutService = inject(LayoutService);
  private readonly dynamicSocialImage = inject(DynamicSocialImageService);
  private readonly siteOrigin = environment.siteUrl;

  /**
   * Generate a social preview image URL
   * Can use dynamic home page preview or static image
   */
  async generatePreviewImage(config: SocialPreviewConfig): Promise<string> {
    // Pour des prévisualisations stables et cohérentes, on utilise
    // toujours l'image statique générée à partir de la page d'accueil
    // (og-image.png), sauf si une image spécifique est fournie.
    if (!isPlatformBrowser(this.platformId)) {
      return this.getDefaultImageUrl();
    }

    return config.imageUrl || this.getDefaultImageUrl();
  }

  /**
   * Image d'aperçu par défaut : celle publiée dans Directus si elle existe,
   * sinon le fichier statique.
   *
   * L'ordre compte. Le repli statique n'est pas décoratif : les robots sociaux
   * ne récupèrent l'image qu'une fois et gardent l'échec en mémoire longtemps.
   * Une indisponibilité du CMS ne doit donc pas pouvoir casser durablement les
   * aperçus de lien.
   */
  getDefaultImageUrl(): string {
    const depuisDirectus = this.layoutService.socialImageData();
    if (depuisDirectus) return depuisDirectus;
    try {
      return new URL('/assets/seo/og-image.png', this.siteOrigin).toString();
    } catch {
      return '/assets/seo/og-image.png';
    }
  }

  /** Type MIME réellement servi pour l'URL ci-dessus, pour `og:image:type`. */
  getDefaultImageType(): string {
    return this.layoutService.socialImageData() ? 'image/jpeg' : 'image/png';
  }

  /**
   * Get the favicon URL from Directus
   */
  getDirectusFaviconUrl(): string | null {
    return this.layoutService.faviconData();
  }

  /**
   * Generate dynamic meta tags for social sharing
   */
  async generateSocialMeta(
    config: SocialPreviewConfig,
  ): Promise<Record<string, string>> {
    const imageUrl = await this.generatePreviewImage(config);
    const siteName = config.siteName || 'FINSTAR-CM S.A.';

    return {
      // Open Graph
      'og:title': config.title,
      'og:description': config.description || '',
      'og:image': imageUrl,
      'og:image:alt': config.title,
      'og:site_name': siteName,
      'og:type': 'website',

      // Twitter
      'twitter:card': 'summary_large_image',
      'twitter:title': config.title,
      'twitter:description': config.description || '',
      'twitter:image': imageUrl,
      'twitter:image:alt': config.title,
    };
  }

  /**
   * Generate a social preview image using the Directus favicon
   * This creates a branded social image with your favicon
   */
  async generateBrandedPreview(config: SocialPreviewConfig): Promise<string> {
    if (!isPlatformBrowser(this.platformId)) {
      return this.getDefaultImageUrl();
    }

    const faviconUrl = this.getDirectusFaviconUrl();
    if (!faviconUrl) {
      return this.getDefaultImageUrl();
    }

    try {
      // Create a canvas for the social preview
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return this.getDefaultImageUrl();

      // Set Open Graph dimensions
      canvas.width = 1200;
      canvas.height = 630;

      // Create gradient background
      const gradient = ctx.createLinearGradient(0, 0, 1200, 630);
      gradient.addColorStop(0, '#1a365d');
      gradient.addColorStop(1, '#2d5a87');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1200, 630);

      // Load and draw the favicon
      const favicon = new Image();
      favicon.crossOrigin = 'anonymous';

      await new Promise<void>((resolve, reject) => {
        favicon.onload = () => resolve();
        favicon.onerror = () => reject(new Error('Failed to load favicon'));
        favicon.src = faviconUrl;
      });

      // Draw favicon (centered, large)
      const faviconSize = 120;
      const faviconX = (1200 - faviconSize) / 2;
      const faviconY = 150;
      ctx.drawImage(favicon, faviconX, faviconY, faviconSize, faviconSize);

      // Add text
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';

      // Title
      ctx.font = '700 48px "Instrument Sans", Arial, sans-serif';
      ctx.fillText(config.title, 600, 350);

      // Description
      if (config.description) {
        ctx.font = '400 24px "Instrument Sans", Arial, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillText(config.description, 600, 400);
      }

      // Site name
      ctx.font = '400 18px "Instrument Sans", Arial, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillText(config.siteName || 'FINSTAR-CM S.A.', 600, 550);

      return canvas.toDataURL('image/png');
    } catch (error) {
      console.warn(
        '[SocialPreviewService] Failed to generate branded preview:',
        error,
      );
      return this.getDefaultImageUrl();
    }
  }
}
