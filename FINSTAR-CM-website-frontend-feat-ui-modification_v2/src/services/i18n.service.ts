import { inject, Injectable, signal, computed, PLATFORM_ID, DestroyRef, REQUEST } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import { filter, map } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LanguageDetectionService } from './language-detection.service';

@Injectable({ providedIn: 'root' })
export class I18nService {
    private readonly router = inject(Router);
    readonly translate = inject(TranslateService);
    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    private readonly destroyRef = inject(DestroyRef);
    private readonly document = inject(DOCUMENT);
    private readonly languageDetection = inject(LanguageDetectionService);
    private readonly request = inject(REQUEST, { optional: true });

    // Signal pour la langue actuelle
    private readonly currentLanguageSignal = signal<string>('fr-FR');

    // Langues supportées
    readonly supportedLanguages = ['fr-FR', 'en-US'] as const;
    readonly defaultLanguage = 'en-US' as const;

    // Interface publique
    public readonly currentLanguage = this.currentLanguageSignal.asReadonly();

    // Computed pour savoir si on est en français
    public readonly isFrench = computed(() => this.currentLanguage() === 'fr-FR');

    // Computed pour savoir si on est en anglais
    public readonly isEnglish = computed(() => this.currentLanguage() === 'en-US');

    constructor() {
        // Initialisation correcte de ngx-translate
        this.translate.addLangs([...this.supportedLanguages]);
        this.translate.setFallbackLang(this.defaultLanguage);

        // Détection de la langue initiale
        const urlLang = this.getLanguageFromUrl();
        const initialLang = urlLang || this.languageDetection.detectPreferredLanguage();
        this.translate.use(initialLang);
        this.currentLanguageSignal.set(initialLang);
        this.updateDocumentLanguage(initialLang);

        this.setupRouterListener();
    }

    private getLanguageFromUrl(): string | null {
        let path = this.router.url;
        if (!this.isBrowser && this.request?.url) {
            try {
                path = new URL(this.request.url).pathname;
            } catch {
                path = this.request.url;
            }
        }

        const urlSegments = path.split('/').filter((segment: string) => segment);
        const langSegment = urlSegments[0];
        const normalized = this.languageDetection.normalizeLanguage(langSegment);

        return normalized && this.supportedLanguages.includes(normalized as any) ? normalized : null;
    }

    private updateDocumentLanguage(lang: string): void {
        const doc = this.document as Document | undefined;
        if (!doc?.documentElement) {
            return;
        }

        doc.documentElement.lang = lang;
    }

    private setupRouterListener(): void {
        this.router.events
            .pipe(
                filter(event => event instanceof NavigationEnd),
                map(() => this.getLanguageFromUrl()),
                filter((lang): lang is string => !!lang),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe(lang => {
                if (lang !== this.currentLanguage()) {
                    this.setLanguage(lang);
                }
            });
    }

    setLanguage(lang: string): void {
        if (!this.supportedLanguages.includes(lang as any)) {
            lang = this.defaultLanguage;
        }

        this.currentLanguageSignal.set(lang);
        this.translate.use(lang);

        this.updateDocumentLanguage(lang);
    }

    switchLanguage(): void {
        const newLang = this.currentLanguage() === 'fr-FR' ? 'en-US' : 'fr-FR';
        this.languageDetection.saveLanguagePreference(newLang);
        this.navigateWithLanguage(newLang);
    }

    getCurrentPathWithoutLanguage(): string {
        const urlSegments = this.router.url.split('/').filter((segment: string) => !!segment);
        const first = urlSegments[0];
        const normalized = this.languageDetection.normalizeLanguage(first);

        if (normalized && this.supportedLanguages.includes(normalized as any)) {
            return '/' + urlSegments.slice(1).join('/');
        }

        return this.router.url;
    }

    navigateWithLanguage(lang: string): void {
        const currentPath = this.getCurrentPathWithoutLanguage();
        const newUrl = `/${lang}${currentPath === '/' ? '' : currentPath}`;
        this.router.navigateByUrl(newUrl);
    }

    // Utilitaire pour créer des liens avec la langue actuelle
    createLocalizedLink(path: string): string {
        const cleanPath = path.startsWith('/') ? path.substring(1) : path;
        return `/${this.currentLanguage()}${cleanPath ? '/' + cleanPath : ''}`;
    }
}
