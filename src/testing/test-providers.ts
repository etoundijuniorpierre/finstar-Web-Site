import { provideHttpClient } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { provideToastr } from 'ngx-toastr';

export const TEST_PROVIDERS = [
  provideRouter([]),
  provideHttpClient(),
  provideNoopAnimations(),
  provideTranslateService({ fallbackLang: 'fr-FR', lang: 'fr-FR' }),
  provideToastr()
];
