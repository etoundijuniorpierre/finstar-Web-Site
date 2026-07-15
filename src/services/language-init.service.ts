import { inject, Injectable, PLATFORM_ID, DestroyRef } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { LanguageDetectionService } from './language-detection.service';
import { I18nService } from './i18n.service';

@Injectable({ providedIn: 'root' })
export class LanguageInitService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly router = inject(Router);
  private readonly languageDetection = inject(LanguageDetectionService);
  private readonly i18nService = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Initialise la langue de l'application au démarrage
   * Cette méthode doit être appelée très tôt dans le cycle de vie de l'app
   */
  async initializeLanguage(): Promise<void> {
    if (!this.isBrowser) {
      return;
    }

    // Détecter la langue préférée
    const preferredLanguage = this.languageDetection.detectPreferredLanguage() || 'en-US';

    // Définir la langue dans le service i18n
    this.i18nService.setLanguage(preferredLanguage);

    // Rediriger vers la langue détectée
    const newUrl = `/${preferredLanguage}`;
    if (this.destroyRef.destroyed) {
      return;
    }
    await this.router.navigateByUrl(newUrl);
  }

  /**
   * Récupère le service de détection de langue (pour accès externe)
   */
  getLanguageDetection(): LanguageDetectionService {
    return this.languageDetection;
  }
}
