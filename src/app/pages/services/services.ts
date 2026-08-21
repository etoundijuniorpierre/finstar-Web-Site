// services.component.ts
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, PLATFORM_ID, DestroyRef, OnDestroy } from '@angular/core';
import { isPlatformBrowser, NgOptimizedImage } from '@angular/common';
import { ServicesService } from '../../../services/services.service';
import { JoinUsComponent } from "../../shared/join-us/join-us";
import { MarkdownRenderer } from "../../shared/markdown-renderer/markdown-renderer";
import { DomSanitizer } from '@angular/platform-browser';
import { LoanProcess, LoanProcessStep } from '../../../services/services.service';
import { TranslateModule } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { I18nService } from '../../../services/i18n.service';
import { SeoService } from '../../../services/seo.service';
import { CtaButton } from '../../shared/cta-button/cta-button';

interface ProductFactSheet {
  item_id: number;
  type?: string;
  opening_minimum?: string;
  eligibility?: string[];
  subscription_steps?: string[];
  documents?: string[];
  benefits?: string[];
}

@Component({
  selector: 'app-services',
  imports: [JoinUsComponent, MarkdownRenderer, TranslateModule, NgOptimizedImage, CtaButton],
  templateUrl: './services.html',
  styleUrl: './services.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Services implements OnDestroy {
  private readonly servicesService = inject(ServicesService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly i18nService = inject(I18nService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly seoService = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);
  private selectAccountTimeout?: ReturnType<typeof setTimeout>;
  private descriptionResetTimeout?: ReturnType<typeof setTimeout>;
  private tabFocusFrame?: number;
  private accountFocusFrame?: number;
  private productScrollFrame?: number;
  private creditFocusFrame?: number;

  serviceData = this.servicesService.servicesPage;
  isLoading = this.servicesService.isLoading;

  // ✅ Stream des traductions pour le contenu statique
  private readonly translationsStream = this.i18nService.translate.stream([
    'SERVICES.DESIGNED_TO_HELP',
    'SERVICES.CREDIT_CATEGORIES',
    'SERVICES.LOAN_CONDITIONS',
    'SERVICES.COMPANY_NAME',
    'COMMON.LOADING',
    'COMMON.LEARN_MORE',
    'ERROR.TITLE',
    'ERROR.MESSAGE',
    'ERROR.RETRY'
  ]);

  // Conversion de l'observable en signal réactif
  translations = toSignal(this.translationsStream, { initialValue: {} });

  // Textes traduits réactifs
  readonly designedToHelp = computed(() => this.translations()['SERVICES.DESIGNED_TO_HELP'] || '');
  readonly creditCategories = computed(() => this.translations()['SERVICES.CREDIT_CATEGORIES'] || '');
  readonly loanConditions = computed(() => this.translations()['SERVICES.LOAN_CONDITIONS'] || '');
  readonly companyName = computed(() => this.translations()['SERVICES.COMPANY_NAME'] || '');
  readonly learnMore = computed(() => this.translations()['COMMON.LEARN_MORE'] || '');
  readonly loadingText = computed(() => this.translations()['COMMON.LOADING'] || '');
  readonly errorTitle = computed(() => this.translations()['ERROR.TITLE'] || '');
  readonly errorMessage = computed(() => this.translations()['ERROR.MESSAGE'] || '');
  readonly retryButton = computed(() => this.translations()['ERROR.RETRY'] || '');

  // Données réactives
  introData = this.servicesService.introData;
  accountsData = this.servicesService.accountsData;
  accountOpeningGuides = this.servicesService.accountOpeningGuides;
  openAccountData = this.servicesService.openAccountData;
  creditRequirements = this.servicesService.creditRequirementsData;
  creditRequirementsSection = this.servicesService.creditRequirementsSection;
  productsData = this.servicesService.productsData;

  // Signal pour le produit actif
  activeProductId = signal<number | null>(null);

  // Produit actif (onglet sélectionné)
  activeProduct = computed(() => {
    const products = this.productsData();
    const id = this.activeProductId();
    return products?.find((p: any) => p.id === id) ?? null;
  });

  // Items du produit actif
  activeItems = computed(() => {
    const id = this.activeProductId();
    return id ? this.servicesService.getProductItems(id) : [];
  });

  activeProductFactSheets = computed<ProductFactSheet[]>(() => {
    const raw = this.activeProduct()?.Table_data;
    if (!raw) return [];

    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) return parsed;
      return Array.isArray(parsed?.details) ? parsed.details : [];
    } catch {
      return [];
    }
  });

  productFactSheet(itemId: number): ProductFactSheet | null {
    return this.activeProductFactSheets().find(detail => detail.item_id === itemId) ?? null;
  }

  productItemKey(item: any, index: number): string {
    const itemIdentity = item?.id ?? item?.item_id ?? item?.slug ?? item?.name ?? index;
    const normalizedName = this.normalizeLabel(item?.name ?? '').replace(/[^a-z0-9]+/g, '-');
    return `${this.activeProductId() ?? 'product'}-${itemIdentity}-${normalizedName || index}`;
  }

  private normalizeLabel(value: unknown): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  isCreditProduct(product: any): boolean {
    const label = this.normalizeLabel(`${product?.Name ?? ''} ${product?.headlines ?? ''}`);
    return product?.id === 2 || label.includes('credit') || label.includes('loan');
  }

  isAccountProduct(product: any): boolean {
    const label = this.normalizeLabel(`${product?.Name ?? ''} ${product?.headlines ?? ''}`);
    return product?.id === 1 ||
      ['compte', 'epargne', 'depot', 'account', 'saving', 'deposit']
        .some(term => label.includes(term));
  }

  isTermAccount(account: any): boolean {
    const label = this.normalizeLabel(account?.account_name);
    return Number(account?.account_id) === 11 ||
      label.includes('terme') ||
      label.includes('term');
  }

  goToSavingsJourney(): void {
    const savingsAccount = this.accountsData().find((account: any) => {
      const label = this.normalizeLabel(account.account_name);
      return Number(account.account_id) === 7 ||
        label.includes('epargne') ||
        label.includes('saving');
    });
    const fallbackGuide = this.accountOpeningGuides()[0];
    const targetId = savingsAccount?.account_id ?? fallbackGuide?.account_ids?.[0];

    if (targetId) {
      this.openAccountGuide(targetId);
      return;
    }

    this.scrollToOpenAccount();
  }

  // Type guard pour vérifier la structure du processus
  isLoanProcess(value: any): value is LoanProcess[] {
    return Array.isArray(value) &&
      value.every(item =>
        typeof item === 'object' &&
        'title' in item &&
        'steps' in item &&
        Array.isArray(item.steps)
      );
  }

  // Vérifier si une étape a des détails
  hasDetails(step: LoanProcessStep): boolean {
    return !!step.details && step.details.length > 0;
  }

  // Async-safe content rendering
  async renderHtml(html: string | null): Promise<string | null> {
    return html || null;
  }

  selectedType = signal(0);
  selectedAccountId = signal<number | null>(null);
  isDescriptionChanging = signal(false);

  // Calculer le compte sélectionné
  selectedAccount = computed(() => {
    const accounts = this.accountsData();
    const id = this.selectedAccountId();
    return accounts?.find((acc: any) => acc.account_id === id) || accounts?.[0] || null;
  });

  selectedAccountGuide = computed(() => {
    const selectedId = this.selectedAccountId();
    const guides = this.accountOpeningGuides();
    return guides.find(guide => selectedId !== null && guide.account_ids.includes(selectedId)) ?? guides[0] ?? null;
  });

  accountOpeningFee(accountId: number): string | null {
    const guide = this.accountOpeningGuides().find(g => g.account_ids?.includes(accountId));
    return guide?.opening_fee ?? null;
  }

  constructor() {
    // Initialiser avec le premier compte
    effect(() => {
      const guides = this.accountOpeningGuides();
      if (guides.length && !this.selectedAccountId()) {
        this.selectedAccountId.set(guides[0].account_ids[0]);
      }
    });

    // Initialiser avec le premier produit (items affichés automatiquement)
    effect(() => {
      const products = this.productsData();
      if (products?.length && !this.activeProductId()) {
        this.activeProductId.set(products[0].id);
      }
    });

    effect(() => {
      this.i18nService.currentLanguage();
      this.seoService.updatePageSeo('SERVICES');
    });
  }

  ngOnDestroy(): void {
    if (this.selectAccountTimeout) {
      clearTimeout(this.selectAccountTimeout);
    }
    if (this.descriptionResetTimeout) {
      clearTimeout(this.descriptionResetTimeout);
    }
    if (this.tabFocusFrame) {
      cancelAnimationFrame(this.tabFocusFrame);
    }
    if (this.accountFocusFrame) {
      cancelAnimationFrame(this.accountFocusFrame);
    }
    if (this.productScrollFrame) {
      cancelAnimationFrame(this.productScrollFrame);
    }
    if (this.creditFocusFrame) {
      cancelAnimationFrame(this.creditFocusFrame);
    }
  }

  // Sélectionner un produit
  selectProduct(productId: number) {
    this.activeProductId.set(productId);
  }

  onTabClick(event: Event, productId: number) {
    event.preventDefault();
    this.selectProduct(productId);
    this.scrollToItems();
  }

  onTabKeydown(event: KeyboardEvent, productId: number): void {
    const products = this.productsData();
    const currentIndex = products.findIndex((product: any) => product.id === productId);
    if (currentIndex < 0) return;

    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % products.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + products.length) % products.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = products.length - 1;
    else return;

    event.preventDefault();
    const nextProduct = products[nextIndex];
    this.selectProduct(nextProduct.id);
    if (isPlatformBrowser(this.platformId)) {
      this.tabFocusFrame = requestAnimationFrame(() => {
        if (!this.destroyRef.destroyed) {
          document.getElementById(`product-tab-${nextProduct.id}`)?.focus();
        }
      });
    }
  }

  // Scroller vers la section des items
  scrollToItems() {
    if (this.productScrollFrame) {
      cancelAnimationFrame(this.productScrollFrame);
    }
    this.productScrollFrame = this.scheduleScrollToElement('product-items-section');
  }

  selectType(index: number) {
    this.selectedType.set(index);
    if (this.creditFocusFrame) {
      cancelAnimationFrame(this.creditFocusFrame);
    }
    this.creditFocusFrame = this.scheduleScrollToElement('credit-conditions');
  }

  isArray(value: any): boolean {
    return Array.isArray(value);
  }

  // Sélectionner un compte avec animation et scroll
  selectAccount(id: number, scrollToGuide = false) {
    if (this.selectedAccountId() !== id) {
      this.selectedAccountId.set(id);
    }
    if (scrollToGuide) {
      if (this.accountFocusFrame) {
        cancelAnimationFrame(this.accountFocusFrame);
      }
      this.accountFocusFrame = this.scheduleScrollToElement('account-guide-detail');
    }
  }

  scrollToCreditApplication(event?: Event): void {
    event?.preventDefault();
    if (isPlatformBrowser(this.platformId)) {
      document.getElementById('credit-application')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  scrollToOpenAccount(event?: Event): void {
    event?.preventDefault();
    if (isPlatformBrowser(this.platformId)) {
      document.getElementById('open-account')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  accountGuideFor(accountId: number) {
    return this.accountOpeningGuides().find(guide => guide.account_ids.includes(accountId)) ?? null;
  }

  openAccountGuide(accountId: number): void {
    const guide = this.accountGuideFor(accountId);
    if (!guide) return;
    this.selectAccount(guide.account_ids[0]);

    if (isPlatformBrowser(this.platformId)) {
      this.accountFocusFrame = this.scheduleScrollToElement('account-details');
    }
  }

  private scheduleScrollToElement(elementId: string): number | undefined {
    if (!isPlatformBrowser(this.platformId)) return undefined;

    return requestAnimationFrame(() => {
      if (!this.destroyRef.destroyed) {
        document.getElementById(elementId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  // Scroll vers la section description avec un offset
  private scrollToDescription(): void {
    // Only execute in browser environment
    if (isPlatformBrowser(this.platformId)) {
      const descriptionSection = document.querySelector('.service-card-right');
      if (descriptionSection) {
        const offset = 100; // Offset pour ne pas coller au bord
        const elementPosition = descriptionSection.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - offset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    }
  }

  selectedCredit = computed(() => {
    const credits = this.creditRequirements();
    if (!credits) return null;
    return credits[this.selectedType()];
  });

  reloadPage(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.location.reload();
    }
  }
}
