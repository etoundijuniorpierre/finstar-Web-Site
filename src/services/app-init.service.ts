import { inject, Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { I18nService } from './i18n.service';
import { DirectusV2Service } from './directus-v2.service';

/**
 * Amorçage de l'application : langue puis contenu.
 *
 * Le contenu provient exclusivement du schéma Directus v2. L'ancien schéma n'est
 * plus lu par le frontend ; ses collections restent en base à titre d'archive.
 */
@Injectable({ providedIn: 'root' })
export class AppInitService {
  private readonly i18nService = inject(I18nService);
  private readonly directusV2 = inject(DirectusV2Service);

  constructor(private readonly translate: TranslateService) {
    translate.setFallbackLang('en-US');
    translate.use(this.i18nService.currentLanguage());
  }

  async init(): Promise<void> {
    await this.directusV2.load();
  }
}
