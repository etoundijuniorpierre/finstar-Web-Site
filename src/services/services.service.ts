// services.service.ts
import { inject, Injectable, computed } from '@angular/core';
import { DirectusV2Service } from './directus-v2.service';

export interface LoanProcessStep {
  step: string;
  details?: string[];
}

export interface LoanProcess {
  title: string;
  steps: LoanProcessStep[];
}

export interface AccountOpeningGuide {
  key: string;
  account_ids: number[];
  label: string;
  tagline: string;
  best_for: string;
  use_cases: string[];
  opening_minimum: string;
  /** Frais d'ouverture par compte, géré dans Directus (ex. « GRATUITE », « 2 500 FCFA »). */
  opening_fee?: string;
  documents: string[];
  benefits: string[];
  practical_note?: string;
}

@Injectable({ providedIn: 'root' })
export class ServicesService {
  private readonly directusV2 = inject(DirectusV2Service);

  isLoading = computed(() => !this.directusV2.ready());

  /** Présence de la page (garde d'affichage côté template). */
  servicesPage = computed(() => this.directusV2.servicesPage());

  // Bloc « crédit » : titres du singleton + étapes typées de `loan_process`.
  creditRequirementsSection = computed(() => {
    const page = this.directusV2.servicesPage();
    if (!page) return null;

    return {
      headline: String(page['credit_headline'] || ''),
      headlines2: String(page['credit_headline_2'] || ''),
      loanProcess: this.directusV2.loanProcess().map((process) => ({
        title: String(process['title'] || ''),
        steps: Array.isArray(process['steps']) ? process['steps'] : [],
      })),
    } as any;
  });

  introData = computed(() => {
    const page = this.directusV2.servicesPage();
    if (!page) return null;

    return {
      headline: String(page['intro_headline'] || ''),
      subheadline: String(page['intro_subheadline'] || ''),
      image: page['intro_image'] as string | null,
    };
  });

  // Familles de produits et leurs offres (relation M2O, plus de table de jonction).
  productsData = computed(() => {
    const items = this.directusV2.productItems();
    return this.directusV2.creditProducts().map((product) => {
      const productId = Number(product['id']);
      const facts = items
        .filter((item) => Number(item['product']) === productId)
        .map((item) => ({
          item_id: Number(item['id']),
          opening_minimum: item['opening_minimum'],
          eligibility: item['eligibility'],
          documents: item['documents'],
          benefits: item['benefits'],
        }));
      return {
        id: productId,
        Name: String(product['name'] || ''),
        headlines: String(product['headline'] || ''),
        product_image: product['image'] as string | null,
        Table_data: { details: facts },
      };
    }) as any[];
  });

  getProductItems(productId: number) {
    return this.directusV2.productItems()
      .filter((item) => Number(item['product']) === productId)
      .map((item) => ({
        id: Number(item['id']),
        name: String(item['name'] || ''),
        description: String(item['description'] || ''),
        image: item['image'] as string | null,
      })) as any[];
  }

  accountsData = computed(() => this.directusV2.accountTypes().map((account) => ({
    account_id: Number(account['legacy_id']),
    account_name: String(account['account_name'] || ''),
    Description: String(account['description'] || ''),
    full_description: String(account['full_description'] || ''),
    min_amount: String(account['min_amount'] || ''),
  })) as any[]);

  accountOpeningGuides = computed<AccountOpeningGuide[]>(() =>
    this.directusV2.accountOpeningGuides().map((guide) => ({
      key: String(guide['key'] || ''),
      account_ids: Array.isArray(guide['account_ids']) ? guide['account_ids'].map(Number) : [],
      label: String(guide['label'] || ''),
      tagline: String(guide['tagline'] || ''),
      best_for: String(guide['best_for'] || ''),
      use_cases: Array.isArray(guide['use_cases']) ? guide['use_cases'].map(String) : [],
      opening_minimum: String(guide['opening_minimum'] || ''),
      opening_fee: guide['opening_fee'] ? String(guide['opening_fee']) : undefined,
      documents: Array.isArray(guide['documents']) ? guide['documents'].map(String) : [],
      benefits: Array.isArray(guide['benefits']) ? guide['benefits'].map(String) : [],
      practical_note: guide['practical_note'] ? String(guide['practical_note']) : undefined,
    })));

  openAccountData = computed(() => {
    const page = this.directusV2.servicesPage();
    if (!page) return null;

    return {
      headline: '',
      subheadline: String(page['opening_intro'] || ''),
      image: null,
    };
  });

  // Catégories de crédit : vraies lignes (`credit_categories`), plus de blob JSON
  // dont la clé « interest rate » contenait un espace.
  creditRequirementsData = computed(() => this.directusV2.creditCategories().map((item) => ({
    category: String(item['category'] || ''),
    interestRate: Array.isArray(item['interest_rates']) ? item['interest_rates'] : [],
    requirements: Array.isArray(item['requirements']) ? item['requirements'] : [],
  })));
}
