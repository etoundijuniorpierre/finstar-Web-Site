import { APP_ID, ApplicationConfig, importProvidersFrom, inject, provideAppInitializer, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withInMemoryScrolling, withRouterConfig } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { IMAGE_LOADER, ImageLoaderConfig } from '@angular/common';
import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { AppInitService } from '../services/app-init.service';
import { provideMarkdown } from 'ngx-markdown';
import { provideToastr } from 'ngx-toastr';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { of } from 'rxjs';

// ✅ Loader statique pour SSG
export class StaticTranslateLoader implements TranslateLoader {
  constructor(private readonly translations: Record<string, any>) { }

  getTranslation(lang: string) {
    // ✅ Normalisation des clés de langue
    const normalizedLang = lang === 'fr' ? 'fr-FR' : lang === 'en' ? 'en-US' : lang;
    return of(this.translations[normalizedLang] || this.translations['fr-FR'] || {});
  }
}

// Chargement des fichiers de traduction statiques
import frTranslations from '../../public/assets/i18n/fr.json';
import enTranslations from '../../public/assets/i18n/en.json';

const translationFiles = {
  'fr-FR': frTranslations,
  'en-US': enTranslations,
  // ✅ Ajout des alias pour compatibilité
  'fr': frTranslations,
  'en': enTranslations
};

const optimizedImageLoader = (config: ImageLoaderConfig): string => {
  if (!config.src.includes('res.cloudinary.com')) return config.src;

  const transformations = ['f_auto', 'q_auto'];
  if (config.width) transformations.push(`w_${config.width}`);
  return config.src.replace('/image/upload/', `/image/upload/${transformations.join(',')}/`);
};

export const appConfig: ApplicationConfig = {
  providers: [
    // Angular mémorise, au niveau de la plateforme, les APP_ID dont l'état
    // serveur a déjà été sérialisé. Le prerender enchaîne plusieurs rendus dans
    // un même processus : avec l'identifiant par défaut, le second rendu est
    // signalé comme une « duplicate serialization ». Un APP_ID propre à
    // l'application lève l'ambiguïté et fiabilise l'hydratation.
    { provide: APP_ID, useValue: 'finstar-cm' },
    // ✅ Configuration simplifiée de ngx-translate
    importProvidersFrom(
      TranslateModule.forRoot({
        loader: {
          provide: TranslateLoader,
          useValue: new StaticTranslateLoader(translationFiles)
        },
        fallbackLang: 'fr-FR',
        isolate: false
      })
    ),
    provideAnimationsAsync(),
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withInMemoryScrolling({
      anchorScrolling: 'enabled',
      scrollPositionRestoration: 'disabled'
    }), withRouterConfig({
      onSameUrlNavigation: 'reload'
    })),
    provideHttpClient(withFetch()),
    { provide: IMAGE_LOADER, useValue: optimizedImageLoader },
    // ✅ Initialisation simplifiée
    provideAppInitializer(() => {
      const initService = inject(AppInitService);
      return initService.init()
    }),
    provideMarkdown(),
    provideClientHydration(),
    provideToastr({
      timeOut: 3000,
      positionClass: 'toast-top-right',
      preventDuplicates: true,
      progressBar: true,
      closeButton: true,
      enableHtml: true
    })
  ]
};
