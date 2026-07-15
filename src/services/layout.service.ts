// src/app/services/layout.service.ts
import { inject, Injectable, computed, signal } from '@angular/core';
import { DirectusSdkService } from './directus.sdk.service';
import { I18nService } from './i18n.service';

@Injectable({ providedIn: 'root' })
export class LayoutService {
    private readonly directus = inject(DirectusSdkService);
    private readonly i18nService = inject(I18nService);

    // Signal pour la langue courante
    currentLanguage = this.i18nService.currentLanguage;

    // Signal pour les données de la navbar
    navbarData = computed(() => {
        const settings = this.directus.translatedSettings();
        if (!settings) return null;

        return {
            logo: settings.site_logo,
            navigation: settings.main_navigation || []
        };
    });

    // Signal pour les données du footer
    footerData = computed(() => {
        const settings = this.directus.translatedSettings();
        if (!settings) return null;

        let footerLinks = [];

        // ✅ Vérification robuste du type de données
        if (settings.Footer_Text) {
            try {
                if (typeof settings.Footer_Text === 'string') {
                    // Si c'est une chaîne, on la parse
                    footerLinks = JSON.parse(settings.Footer_Text);
                } else if (Array.isArray(settings.Footer_Text)) {
                    // Si c'est déjà un tableau, on l'utilise directement
                    footerLinks = settings.Footer_Text;
                } else if (typeof settings.Footer_Text === 'object') {
                    // Si c'est un objet, on le convertit en tableau ou on l'ignore
                    console.warn('[LayoutService] Footer_Text est un objet, conversion en tableau');
                    footerLinks = [];
                } else {
                    console.warn('[LayoutService] Footer_Text type inconnu:', typeof settings.Footer_Text);
                    footerLinks = [];
                }
            } catch (e) {
                console.error('[LayoutService] Erreur lors du parsing de Footer_Text:', e);
                console.error('[LayoutService] Données reçues:', settings.Footer_Text);
                console.error('[LayoutService] Type des données:', typeof settings.Footer_Text);
                footerLinks = [];
            }
        }

        return {
            socialLinks: settings.footer_social_links || [],
            address: settings.footer_address,
            email: settings.footer_email,
            footerLinks
        };
    });

    // Signal pour le favicon
    faviconData = computed(() => '/favicon.ico');

    // État de chargement
    isLoading = computed(() => this.directus.isLoading());

    // Méthode pour changer la langue
    setLanguage(lang: string): void {
        this.i18nService.setLanguage(lang);
    }
}