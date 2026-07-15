import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class LanguageDetectionService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly supportedLanguages = ['fr-FR', 'en-US'] as const;
  readonly defaultLanguage = 'en-US' as const;

  private readonly STORAGE_KEY = 'preferred-language';

  normalizeLanguage(language: string | null | undefined): typeof this.supportedLanguages[number] | null {
    if (!language) {
      return null;
    }

    const normalized = language.trim().replace('_', '-').toLowerCase();

    if (normalized === 'fr' || normalized.startsWith('fr-')) {
      return 'fr-FR';
    }

    if (normalized === 'en' || normalized.startsWith('en-')) {
      return 'en-US';
    }

    if (this.isValidLanguage(language)) {
      return language;
    }

    return null;
  }

  /**
   * Détecte la langue préférée de l'utilisateur selon cette priorité :
   * 1. Langue sauvegardée dans localStorage (visites précédentes)
   * 2. Langue du système/navigateur
   * 3. Langue par défaut (en-US)
   */
  detectPreferredLanguage(): string {
    if (!this.isBrowser) {
      return this.defaultLanguage;
    }

    // 1. Vérifier la langue sauvegardée (choix utilisateur)
    const savedLanguage = this.getSavedLanguage();
    if (savedLanguage) {
      return savedLanguage;
    }

    // 2. Détecter la langue du système/navigateur
    const systemLanguage = this.detectSystemLanguage();
    if (systemLanguage) {
      return systemLanguage;
    }

    // 3. Langue par défaut
    return this.defaultLanguage;
  }

  /**
   * Récupère la langue sauvegardée dans localStorage
   */
  private getSavedLanguage(): string | null {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      const normalizedSaved = this.normalizeLanguage(saved);
      if (normalizedSaved) {
        const shortLanguage = normalizedSaved.split('-')[0].toLowerCase();
        if (saved !== shortLanguage) {
          try {
            localStorage.setItem(this.STORAGE_KEY, shortLanguage);
          } catch {
          }
        }
        return normalizedSaved;
      }
    } catch (error) {
      console.warn('[LanguageDetection] Erreur lors de la lecture du localStorage:', error);
    }
    return null;
  }

  /**
   * Détecte la langue du système/navigateur
   */
  private detectSystemLanguage(): string | null {
    try {
      // Récupérer les langues préférées du navigateur
      const browserLanguages = navigator.languages || [navigator.language];

      for (const browserLang of browserLanguages) {
        const normalizedBrowserLang = this.normalizeLanguage(browserLang);
        if (normalizedBrowserLang) {
          return normalizedBrowserLang;
        }
      }
    } catch (error) {
      console.warn('[LanguageDetection] Erreur lors de la détection de la langue du navigateur:', error);
    }

    return null;
  }

  /**
   * Vérifie si une langue est supportée
   */
  private isValidLanguage(lang: string): lang is typeof this.supportedLanguages[number] {
    return this.supportedLanguages.includes(lang as any);
  }

  /**
   * Sauvegarde la langue préférée de l'utilisateur
   */
  saveLanguagePreference(language: string): void {
    if (!this.isBrowser) {
      return;
    }

    const normalizedLanguage = this.normalizeLanguage(language);
    if (!normalizedLanguage) {
      return;
    }

    const shortLanguage = normalizedLanguage.split('-')[0].toLowerCase();
    if (shortLanguage !== 'fr' && shortLanguage !== 'en') {
      return;
    }

    try {
      localStorage.setItem(this.STORAGE_KEY, shortLanguage);
    } catch (error) {
      console.warn('[LanguageDetection] Erreur lors de la sauvegarde de la langue:', error);
    }
  }

  /**
   * Efface la préférence de langue sauvegardée (utile pour les tests)
   */
  clearLanguagePreference(): void {
    if (!this.isBrowser) {
      return;
    }

    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.warn('[LanguageDetection] Erreur lors de la suppression de la langue:', error);
    }
  }
}