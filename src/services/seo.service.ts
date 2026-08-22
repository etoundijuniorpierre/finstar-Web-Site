import { inject, Injectable, PLATFORM_ID, REQUEST } from '@angular/core';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import { Title, Meta } from '@angular/platform-browser';

import { I18nService } from './i18n.service';
import { TranslateService } from '@ngx-translate/core';
import { SocialPreviewService } from './social-preview.service';
import { environment } from '../environments/environment';
import { DirectusV2Service } from './directus-v2.service';

export interface SeoConfig {
  readonly title: string;
  readonly description: string;
  readonly keywords?: readonly string[];
  readonly robots?: string;
  readonly type?: 'website' | 'article';
  readonly imageUrl?: string;
  readonly imageAlt?: string;
  readonly siteName?: string;
}

export type SeoPageKey =
  | 'HOME'
  | 'ABOUT'
  | 'SERVICES'
  | 'CAREER'
  | 'CONTACTS'
  | 'AGENCIES'
  | 'FAQ'
  | 'METRICS';

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly i18nService = inject(I18nService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
  private readonly translate = inject(TranslateService);
  private readonly socialPreview = inject(SocialPreviewService);
  private readonly directusV2 = inject(DirectusV2Service);
  private readonly request = inject(REQUEST, { optional: true });

  private readonly defaultRobots = 'index,follow';
  private readonly siteOrigin = environment.siteUrl;

  updatePageSeo(pageKey: SeoPageKey): void {
    const baseKey = `SEO.${pageKey}` as const;

    const cmsPage = this.cmsPageForSeo(pageKey);
    const title = typeof cmsPage?.['seo_title'] === 'string' && cmsPage['seo_title'].trim()
      ? cmsPage['seo_title']
      : this.translate.instant(`${baseKey}.TITLE`);
    const description = typeof cmsPage?.['seo_description'] === 'string' && cmsPage['seo_description'].trim()
      ? cmsPage['seo_description']
      : this.translate.instant(`${baseKey}.DESCRIPTION`);
    const rawKeywords = this.translate.instant(`${baseKey}.KEYWORDS`);

    const hasValidTitle =
      typeof title === 'string' &&
      title.trim().length > 0 &&
      title !== `${baseKey}.TITLE`;
    const hasValidDescription =
      typeof description === 'string' &&
      description.trim().length > 0 &&
      description !== `${baseKey}.DESCRIPTION`;

    if (!hasValidTitle || !hasValidDescription) {
      return;
    }

    const keywords: string[] =
      typeof rawKeywords === 'string'
        ? rawKeywords
            .split(',')
            .map((k) => k.trim())
            .filter((k) => k.length > 0)
        : [];

    // Use dynamic social image for home page
    const useDynamicImage = pageKey === 'HOME';

    this.updateSeoAsync({
      title,
      description,
      keywords,
      robots: pageKey === 'METRICS' ? 'noindex,nofollow' : this.defaultRobots,
      useDynamicImage,
    });

    if (pageKey === 'FAQ') {
      this.ensureFaqJsonLd();
    }
  }

  private cmsPageForSeo(pageKey: SeoPageKey): Record<string, unknown> | null {
    switch (pageKey) {
      case 'HOME': return this.directusV2.homePage();
      case 'ABOUT': return this.directusV2.aboutPage();
      case 'SERVICES': return this.directusV2.servicesPage();
      case 'CAREER': return this.directusV2.careersPage();
      case 'CONTACTS': return this.directusV2.contactSettings();
      default: return null;
    }
  }

  updateAgenciesSeo(agencies: ReadonlyArray<Record<string, unknown>>): void {
    this.updatePageSeo('AGENCIES');
    const head = this.document.head;
    if (!head) return;
    const scriptId = 'seo-agencies-jsonld';
    let script = this.document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!script) {
      script = this.document.createElement('script');
      script.type = 'application/ld+json';
      script.id = scriptId;
      head.appendChild(script);
    }
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': agencies.map((agency) => ({
        '@type': 'FinancialService',
        name: agency['name'] || agency['city'],
        image: agency['photo'] || undefined,
        telephone: agency['phone'] || undefined,
        email: agency['email'] || undefined,
        address: {
          '@type': 'PostalAddress',
          streetAddress: agency['address'] || undefined,
          addressLocality: agency['city'] || undefined,
          addressRegion: agency['region'] || undefined,
          addressCountry: 'CM',
        },
        geo: typeof agency['latitude'] === 'number' && typeof agency['longitude'] === 'number'
          ? { '@type': 'GeoCoordinates', latitude: agency['latitude'], longitude: agency['longitude'] }
          : undefined,
        hasMap: agency['map_link'] || undefined,
      })),
    });
  }

  private ensureAbsoluteUrl(url: string): string {
    if (!url) return url;
    return url.startsWith('http')
      ? url
      : new URL(url, this.siteOrigin).toString();
  }

  async updateSeoAsync(
    config: SeoConfig & { useDynamicImage?: boolean },
  ): Promise<void> {
    const title = config.title;
    const description = config.description;

    if (!title || !description) {
      return;
    }

    const robots = config.robots ?? this.defaultRobots;
    const type = config.type ?? 'website';
    const siteName = config.siteName ?? 'FINSTAR-CM S.A.';
    const url = this.getCanonicalUrl();

    // Get image URL (potentially dynamic for home page)
    let imageUrl = config.imageUrl;
    if (!imageUrl) {
      if (config.useDynamicImage && isPlatformBrowser(this.platformId)) {
        try {
          imageUrl = await this.socialPreview.generatePreviewImage({
            title,
            description,
            useDynamicImage: true,
          });
        } catch (error) {
          console.warn('[SEO] Failed to generate dynamic image, using default');
          imageUrl = this.getDefaultImageUrl() || '';
        }
      } else {
        imageUrl = this.getDefaultImageUrl() || '';
      }
    }

    const imageAlt = config.imageAlt ?? title;

    this.title.setTitle(title);

    // Basic meta tags
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ name: 'robots', content: robots });

    if (config.keywords && config.keywords.length > 0) {
      this.meta.updateTag({
        name: 'keywords',
        content: config.keywords.join(', '),
      });
    }

    // Open Graph meta tags for social media
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: type });
    this.meta.updateTag({ property: 'og:site_name', content: siteName });

    if (url) {
      this.meta.updateTag({ property: 'og:url', content: url });
    }

    if (imageUrl) {
      this.meta.updateTag({ property: 'og:image', content: imageUrl });
      this.meta.updateTag({ property: 'og:image:alt', content: imageAlt });
      this.meta.updateTag({ property: 'og:image:width', content: '1200' });
      this.meta.updateTag({ property: 'og:image:height', content: '630' });
      const imageType = this.imageTypeFor(Boolean(config.imageUrl));
      if (imageType) this.meta.updateTag({ property: 'og:image:type', content: imageType });
    }

    // Twitter Card meta tags
    this.meta.updateTag({
      name: 'twitter:card',
      content: 'summary_large_image',
    });
    this.meta.updateTag({ name: 'twitter:title', content: title });
    this.meta.updateTag({ name: 'twitter:description', content: description });

    if (imageUrl) {
      this.meta.updateTag({ name: 'twitter:image', content: imageUrl });
      this.meta.updateTag({ name: 'twitter:image:alt', content: imageAlt });
    }

    // WhatsApp and other platforms also use Open Graph tags
    // Additional meta tags for better compatibility
    this.meta.updateTag({ name: 'theme-color', content: '#ffffff' });

    if (url) {
      this.setCanonicalUrl(url);
      this.updateAlternateLinks();
    }

    this.ensureOrganizationJsonLd();
  }

  updateSeo(config: SeoConfig): void {
    const title = config.title;
    const description = config.description;

    if (!title || !description) {
      return;
    }

    const robots = config.robots ?? this.defaultRobots;
    const type = config.type ?? 'website';
    const imageUrl = config.imageUrl ?? this.getDefaultImageUrl();
    const imageAlt = config.imageAlt ?? title;
    const siteName = config.siteName ?? 'FINSTAR-CM S.A.';
    const url = this.getCanonicalUrl();

    this.title.setTitle(title);

    // Basic meta tags
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ name: 'robots', content: robots });

    if (config.keywords && config.keywords.length > 0) {
      this.meta.updateTag({
        name: 'keywords',
        content: config.keywords.join(', '),
      });
    }

    // Open Graph meta tags for social media
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: type });
    this.meta.updateTag({ property: 'og:site_name', content: siteName });

    if (url) {
      this.meta.updateTag({ property: 'og:url', content: url });
    }

    if (imageUrl) {
      this.meta.updateTag({ property: 'og:image', content: imageUrl });
      this.meta.updateTag({ property: 'og:image:alt', content: imageAlt });
      this.meta.updateTag({ property: 'og:image:width', content: '1200' });
      this.meta.updateTag({ property: 'og:image:height', content: '630' });
      const imageType = this.imageTypeFor(Boolean(config.imageUrl));
      if (imageType) this.meta.updateTag({ property: 'og:image:type', content: imageType });
    }

    // Twitter Card meta tags
    this.meta.updateTag({
      name: 'twitter:card',
      content: 'summary_large_image',
    });
    this.meta.updateTag({ name: 'twitter:title', content: title });
    this.meta.updateTag({ name: 'twitter:description', content: description });

    if (imageUrl) {
      this.meta.updateTag({ name: 'twitter:image', content: imageUrl });
      this.meta.updateTag({ name: 'twitter:image:alt', content: imageAlt });
    }

    // WhatsApp and other platforms also use Open Graph tags
    // Additional meta tags for better compatibility
    this.meta.updateTag({ name: 'theme-color', content: '#ffffff' });

    if (url) {
      this.setCanonicalUrl(url);
      this.updateAlternateLinks();
    }

    this.ensureOrganizationJsonLd();
  }

  private getDefaultImageUrl(): string | null {
    return this.socialPreview.getDefaultImageUrl();
  }

  /**
   * Type MIME annoncé pour l'aperçu. Il doit suivre l'image réellement servie :
   * celle de Directus est recompressée en JPEG, le repli statique est un PNG.
   * Une image fournie explicitement par l'appelant n'est pas devinable, on ne
   * déclare alors rien plutôt que de mentir.
   */
  private imageTypeFor(fourniParAppelant: boolean): string | null {
    if (fourniParAppelant) return null;
    return this.socialPreview.getDefaultImageType();
  }

  private getCanonicalUrl(): string | null {
    let currentPath = this.i18nService.getCurrentPathWithoutLanguage();
    if (!isPlatformBrowser(this.platformId) && this.request?.url) {
      try {
        const pathname = new URL(this.request.url).pathname;
        const segments = pathname.split('/').filter(Boolean);
        currentPath = '/' + segments.slice(1).join('/');
      } catch {
        // Router-derived path remains the fallback.
      }
    }
    const lang = this.i18nService.currentLanguage();
    const normalizedPath = currentPath === '/' ? '' : currentPath;

    try {
      return new URL(`/${lang}${normalizedPath}`, this.siteOrigin).toString();
    } catch {
      return null;
    }
  }

  private setCanonicalUrl(url: string): void {
    const head = this.document.head;
    if (!head) {
      return;
    }

    let link = head.querySelector(
      "link[rel='canonical']",
    ) as HTMLLinkElement | null;

    if (!link) {
      link = this.document.createElement('link');
      link.rel = 'canonical';
      head.appendChild(link);
    }

    if (link) {
      link.href = url;
    }
  }

  private updateAlternateLinks(): void {
    const head = this.document.head;
    if (!head) {
      return;
    }

    head
      .querySelectorAll("link[rel='alternate'][hreflang]")
      .forEach((el: Element) => el.remove());

    const pathWithoutLang = this.i18nService.getCurrentPathWithoutLanguage();
    const normalizedPath = pathWithoutLang === '/' ? '' : pathWithoutLang;

    for (const lang of this.i18nService.supportedLanguages) {
      try {
        const href = new URL(
          `/${lang}${normalizedPath}`,
          this.siteOrigin,
        ).toString();
        const linkEl = this.document.createElement('link');
        linkEl.rel = 'alternate';
        linkEl.hreflang = lang;
        linkEl.href = href;
        head.appendChild(linkEl);
      } catch {
        // Ignore invalid URL
      }
    }

    try {
      const defaultLink = this.document.createElement('link');
      defaultLink.rel = 'alternate';
      defaultLink.hreflang = 'x-default';
      defaultLink.href = new URL(
        `/fr-FR${normalizedPath}`,
        this.siteOrigin,
      ).toString();
      head.appendChild(defaultLink);
    } catch {
      // Ignore invalid URL
    }
  }

  private ensureOrganizationJsonLd(): void {
    const head = this.document.head;
    if (!head) {
      return;
    }

    const scriptId = 'seo-organization-jsonld';
    let scriptEl = this.document.getElementById(
      scriptId,
    ) as HTMLScriptElement | null;

    if (!scriptEl) {
      scriptEl = this.document.createElement('script');
      scriptEl.type = 'application/ld+json';
      scriptEl.id = scriptId;
      head.appendChild(scriptEl);
    }

    if (scriptEl) {
      const organizationSchema = {
        '@context': 'https://schema.org',
        '@type': 'FinancialService',
        name: 'FINSTAR-CM S.A.',
        url: this.siteOrigin,
        areaServed: 'CM',
        email: 'contact@finstar-cm.com',
        telephone: '+237620724796',
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Bastos',
          addressLocality: 'Yaoundé',
          addressCountry: 'CM',
        },
        identifier: [
          {
            '@type': 'PropertyValue',
            name: 'Agrément EMF 2e catégorie',
            value: '0000499',
          },
          {
            '@type': 'PropertyValue',
            name: 'Registre du commerce',
            value: 'RC/BJN/2023/B/03',
          },
        ],
        sameAs: [
          'https://facebook.com/finstarcm',
          'https://linkedin.com/company/finstarcm',
        ],
      } as const;

      scriptEl.textContent = JSON.stringify(organizationSchema);
    }
  }

  private ensureFaqJsonLd(): void {
    const head = this.document.head;
    if (!head) return;

    const scriptId = 'seo-faq-jsonld';
    let scriptEl = this.document.getElementById(
      scriptId,
    ) as HTMLScriptElement | null;
    if (!scriptEl) {
      scriptEl = this.document.createElement('script');
      scriptEl.type = 'application/ld+json';
      scriptEl.id = scriptId;
      head.appendChild(scriptEl);
    }

    const mainEntity = Array.from({ length: 13 }, (_, index) => index + 1)
      .map((index) => ({
        '@type': 'Question',
        name: this.translate.instant(`FAQ.Q${index}`),
        acceptedAnswer: {
          '@type': 'Answer',
          text: this.translate.instant(`FAQ.A${index}`),
        },
      }))
      .filter((item) => !String(item.name).startsWith('FAQ.'));

    scriptEl.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity,
    });
  }
}
