import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { I18nService } from '../../../services/i18n.service';
import { SeoService } from '../../../services/seo.service';

interface FaqGroup {
  titleKey: string;
  questions: number[];
}

@Component({
  selector: 'app-faq',
  standalone: true,
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './faq.html',
  styleUrl: './faq.scss'
})
export class Faq {
  private readonly i18nService = inject(I18nService);
  private readonly seoService = inject(SeoService);

  readonly contactsLink = computed(() => this.i18nService.createLocalizedLink('/contacts'));
  readonly faqGroups: FaqGroup[] = [
    { titleKey: 'FAQ.CATEGORIES.SAVINGS', questions: [1, 9] },
    { titleKey: 'FAQ.CATEGORIES.CREDIT', questions: [2, 3, 4, 12] },
    { titleKey: 'FAQ.CATEGORIES.DIGITAL', questions: [5, 10, 11] },
    { titleKey: 'FAQ.CATEGORIES.PRACTICAL', questions: [6, 7, 8, 13] }
  ];

  constructor() {
    effect(() => {
      this.i18nService.currentLanguage();
      this.seoService.updatePageSeo('FAQ');
    });
  }
}
