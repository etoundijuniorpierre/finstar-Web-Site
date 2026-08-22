// src/app/services/layout.service.ts
import { inject, Injectable, computed } from '@angular/core';
import { I18nService } from './i18n.service';
import { environment } from '../environments/environment';
import { DirectusV2Service } from './directus-v2.service';

@Injectable({ providedIn: 'root' })
export class LayoutService {
    private readonly directusV2 = inject(DirectusV2Service);
    private readonly i18nService = inject(I18nService);

    // Signal pour la langue courante
    currentLanguage = this.i18nService.currentLanguage;

    // Signal pour les données de la navbar
    navbarData = computed(() => {
        const settings = this.directusV2.siteSettings();
        if (!settings) return null;

        return {
            logo: settings['site_logo'] as string | null,
            navigation: Array.isArray(settings['main_navigation']) ? settings['main_navigation'] : [],
        };
    });

    // Signal pour les données du footer
    footerData = computed(() => {
        const settings = this.directusV2.siteSettings();
        if (!settings) return null;

        // `footer_text` porte une liste de liens sérialisée en JSON.
        let footerLinks: unknown[] = [];
        const rawFooterText = settings['footer_text'];
        if (rawFooterText) {
            if (Array.isArray(rawFooterText)) {
                footerLinks = rawFooterText;
            } else if (typeof rawFooterText === 'string') {
                try {
                    const parsed = JSON.parse(rawFooterText);
                    footerLinks = Array.isArray(parsed) ? parsed : [];
                } catch {
                    console.error('[LayoutService] footer_text illisible (JSON invalide).');
                }
            }
        }

        return {
            socialLinks: settings['social_links'] || [],
            address: settings['footer_address'],
            email: settings['footer_email'],
            footerLinks
        };
    });

    // Signal pour le favicon
    faviconData = computed(() => '/favicon.ico');

    /**
     * Image d'aperçu des réseaux sociaux (Open Graph), servie par Directus.
     *
     * URL **absolue** : les robots de Facebook, WhatsApp ou LinkedIn récupèrent
     * l'image depuis leurs propres serveurs, un chemin relatif ne leur dit rien.
     * Elle est recadrée et recompressée à la volée — l'original pèse dix fois le
     * poids du rendu JPEG.
     *
     * `null` quand rien n'est renseigné : l'appelant retombe alors sur le fichier
     * statique, pour qu'une indisponibilité du CMS ne casse pas les aperçus.
     */
    socialImageData = computed<string | null>(() => {
        const id = this.directusV2.siteSettings()?.['og_image'];
        if (typeof id !== 'string' || !id.trim()) return null;
        const base = `${environment.siteUrl.replace(/\/$/, '')}${environment.browserApiUrl.replace(/\/$/, '')}`;
        return `${base}/assets/${encodeURIComponent(id)}?width=1200&height=630&fit=cover&format=jpg&quality=82`;
    });

    // État de chargement
    isLoading = computed(() => !this.directusV2.ready());

    // Méthode pour changer la langue
    setLanguage(lang: string): void {
        this.i18nService.setLanguage(lang);
    }
}
