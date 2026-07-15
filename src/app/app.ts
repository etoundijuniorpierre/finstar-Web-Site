import { Component, ChangeDetectionStrategy, inject, PLATFORM_ID, OnInit, DestroyRef } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd, NavigationStart } from '@angular/router';
import { RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Navbar } from "./shared/navbar/navbar";
import { Footer } from "./shared/footer/footer";
import { Favicon } from "./shared/favicon/favicon";
import { DynamicManifestService } from "../services/dynamic-manifest.service";
import { LanguageInitService } from "../services/language-init.service";
import { TranslateModule } from '@ngx-translate/core';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, Navbar, Footer, Favicon, TranslateModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly dynamicManifest = inject(DynamicManifestService); // Initialize dynamic manifest
  private readonly languageInit = inject(LanguageInitService);
  private readonly destroyRef = inject(DestroyRef);
  private previousUrl = '';
  private currentPageUrl = '';
  private goatCounterCode = '';

  ngOnInit(): void {
    // Initialiser la langue au démarrage
    this.initializeLanguageAndRedirect();

    // Only run scroll logic in browser
    if (isPlatformBrowser(this.platformId)) {
      this.setupScrollBehavior();
      this.initAnalytics();
    }
  }

  private initAnalytics(): void {
    const code = environment.goatCounterCode;
    if (!code) return;

    this.goatCounterCode = code;

    const script = document.createElement('script');
    script.async = true;
    script.dataset['goatcounter'] = `https://${code}.goatcounter.com/count`;
    script.src = 'https://gc.zgo.at/count.js';
    document.head.appendChild(script);

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((event) => this.trackGoatCounterPageView(event.urlAfterRedirects));

    this.trackGoatCounterPageView(window.location.pathname);
  }

  private trackGoatCounterPageView(path: string): void {
    if (!this.goatCounterCode) return;

    const analyticsWindow = window as Window & {
      goatcounter?: {
        count?: (options: { path: string }) => void;
      };
    };
    analyticsWindow.goatcounter?.count?.({ path });
  }

  private async initializeLanguageAndRedirect(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    // Utiliser l'URL réelle du navigateur pour éviter de considérer
    // temporairement "/" lors d'un rafraîchissement sur une page profonde
    const location = (globalThis as any).location as Location | undefined;
    const currentPath = location?.pathname || '/';

    // Si on est sur la racine, laisser le LanguageInitService détecter
    // et rediriger vers la langue préférée de l'utilisateur
    if (!currentPath || currentPath === '/') {
      await this.languageInit.initializeLanguage();
      return;
    }

    if (this.destroyRef.destroyed) {
      return;
    }

    const languageDetection = this.languageInit.getLanguageDetection();

    // Si l'URL commence déjà par une langue supportée, ne rien faire
    const segments = currentPath.split('/').filter(Boolean);
    const firstSegment = segments[0];

    const normalizedUrlLang = languageDetection.normalizeLanguage(firstSegment);
    if (normalizedUrlLang && languageDetection.supportedLanguages.includes(normalizedUrlLang as any)) {
      // Canonicaliser /fr ou /en vers /fr-FR ou /en-US
      if (firstSegment !== normalizedUrlLang) {
        const rest = segments.slice(1);
        const restOfPath = rest.length > 0 ? `/${rest.join('/')}` : '';
        const search = location?.search || '';
        const hash = location?.hash || '';
        const newUrl = `/${normalizedUrlLang}${restOfPath}${search}${hash}`;
        if (this.destroyRef.destroyed) {
          return;
        }
        await this.router.navigateByUrl(newUrl);
      }
      return;
    }

    // Sinon, préfixer l'URL actuelle par la langue préférée
    const preferredLanguage = languageDetection.detectPreferredLanguage();
    const restOfPath = segments.length > 0 ? `/${segments.join('/')}` : '';
    const search = location?.search || '';
    const hash = location?.hash || '';
    const newUrl = `/${preferredLanguage}${restOfPath}${search}${hash}`;

    if (this.destroyRef.destroyed) {
      return;
    }
    await this.router.navigateByUrl(newUrl);
  }

  private setupScrollBehavior(): void {
    // Track current page to detect same-page clicks
    this.router.events
      .pipe(
        filter((event): event is NavigationStart => event instanceof NavigationStart),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((event: NavigationStart) => {
        // Store current page URL before navigation
        this.currentPageUrl = this.router.url.split('?')[0].split('#')[0];
      });

    // Handle scroll on navigation end
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((event: NavigationEnd) => {
        if (this.destroyRef.destroyed) {
          return;
        }
        // Extract base URL without fragments/query params
        const currentUrl = event.urlAfterRedirects.split('?')[0].split('#')[0];
        const previousUrl = this.previousUrl.split('?')[0].split('#')[0];

        // Scroll to top if:
        // 1. Navigating to a different page, OR
        // 2. Clicking on the same page link (currentUrl === currentPageUrl from NavigationStart)
        if (currentUrl !== previousUrl || currentUrl === this.currentPageUrl) {
          window.scrollTo({
            top: 0,
            behavior: 'smooth'
          });
        }

        this.previousUrl = event.urlAfterRedirects;
      });
  }
}
