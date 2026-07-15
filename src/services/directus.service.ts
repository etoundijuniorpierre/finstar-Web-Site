import { inject, Injectable, signal, computed, WritableSignal, TransferState } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';
import {
  AccountType,
  GlobalSettings,
  Page,
  PageSection,
  PageSectionAccountTypes,
  PageSectionsRelation,
  PageSectionStatistics,
  PageSectionTestimonials,
  Statistic,
  Testimonial
} from '../types/directus';
import { Observable, catchError, finalize, tap, map, throwError, firstValueFrom } from 'rxjs';
import {
  ACCOUNT_TYPES_KEY, GLOBAL_SETTINGS_KEY, PAGE_SECTIONS_KEY, PAGES_KEY, STATISTICS_KEY, TESTIMONIALS_KEY, PAGE_SECTIONS_RELATIONS_KEY,
  PAGE_SECTIONS_ACCOUNT_TYPES_KEY,
  PAGE_SECTIONS_STATISTICS_KEY,
  PAGE_SECTIONS_TESTIMONIALS_KEY
} from '../assets/state-keys';

@Injectable({ providedIn: 'root' })
export class DirectusService {
  private readonly http = inject(HttpClient);
  private readonly transferState = inject(TransferState);
  private readonly baseUrl = environment.apiUrl;

  // Signaux initialisés depuis TransferState
  private readonly globalSettings = signal<GlobalSettings | null>(
    this.transferState.get(GLOBAL_SETTINGS_KEY, null)
  );

  private readonly accountTypes = signal<AccountType[]>(
    this.transferState.get(ACCOUNT_TYPES_KEY, [])
  );

  private readonly pages = signal<Page[]>(
    this.transferState.get(PAGES_KEY, [])
  );

  private readonly pageSections = signal<PageSection[]>(
    this.transferState.get(PAGE_SECTIONS_KEY, [])
  );

  private readonly statistics = signal<Statistic[]>(
    this.transferState.get(STATISTICS_KEY, [])
  );

  private readonly testimonials = signal<Testimonial[]>(
    this.transferState.get(TESTIMONIALS_KEY, [])
  );

  private readonly pageSectionsRelations = signal<PageSectionsRelation[]>(this.transferState.get(PAGE_SECTIONS_RELATIONS_KEY, [])
  );

  private readonly pageSectionsAccountTypes = signal<PageSectionAccountTypes[]>(
    this.transferState.get(PAGE_SECTIONS_ACCOUNT_TYPES_KEY, [])
  );

  private readonly pageSectionsStatistics = signal<PageSectionStatistics[]>(
    this.transferState.get(PAGE_SECTIONS_STATISTICS_KEY, [])
  );

  private readonly pageSectionsTestimonials = signal<PageSectionTestimonials[]>(
    this.transferState.get(PAGE_SECTIONS_TESTIMONIALS_KEY, [])
  );

  // Vérification des données 
  hasData(): boolean {
    return !!this.globalSettings() && this.accountTypes().length > 0 && this.pages().length > 0 && this.pageSections().length > 0 && this.statistics().length > 0 && this.testimonials().length > 0 && this.pageSectionsRelations().length > 0 && this.pageSectionsAccountTypes().length > 0 && this.pageSectionsStatistics().length > 0 && this.pageSectionsTestimonials().length > 0;
  }

  // Charger toutes les données (pour SSR)
  async loadAllData(): Promise<void> {
    await Promise.allSettled([
      firstValueFrom(this.fetchGlobalSettings()),
      firstValueFrom(this.fetchAccountTypes()),
      firstValueFrom(this.fetchPages()),
      firstValueFrom(this.fetchPageSections()),
      firstValueFrom(this.fetchStatistics()),
      firstValueFrom(this.fetchTestimonials()),
      firstValueFrom(this.fetchPageSectionsRelations()),
      firstValueFrom(this.fetchPageSectionsAccountTypes()),
      firstValueFrom(this.fetchPageSectionsStatistics()),
      firstValueFrom(this.fetchPageSectionsTestimonials())
    ]);
  }

  // Signaux de chargement pour chaque entité
  private readonly loadingStates = signal<Record<string, boolean>>({});
  private readonly errorStates = signal<Record<string, string | null>>({});

  // Interface publique en lecture seule
  public readonly settings = this.globalSettings.asReadonly();
  public readonly accounts = this.accountTypes.asReadonly();
  public readonly allPages = this.pages.asReadonly();
  public readonly sections = this.pageSections.asReadonly();
  public readonly stats = this.statistics.asReadonly();
  public readonly testimonialsData = this.testimonials.asReadonly();
  public readonly sectionsRelations = this.pageSectionsRelations.asReadonly();
  public readonly sectionsAccountTypes = this.pageSectionsAccountTypes.asReadonly();
  public readonly sectionsStatistics = this.pageSectionsStatistics.asReadonly();
  public readonly sectionsTestimonials = this.pageSectionsTestimonials.asReadonly();

  public getError(entityName: string): string | null {
    const errors = this.errorStates();
    return errors[entityName] || null;
  }

  public clearError(entityName: string): void {
    this.setErrorState(entityName, null);
  }

  // Signal computed pour l'état de chargement
  public isLoading = computed(() => Object.values(this.loadingStates()).some(state => state));

  // Méthode pour gérer l'état de chargement
  private setLoadingState(entity: string, state: boolean) {
    this.loadingStates.update(states => ({ ...states, [entity]: state }));
  }

  // Méthode pour gérer les erreurs
  private setErrorState(entity: string, message: string | null) {
    this.errorStates.update(errors => ({ ...errors, [entity]: message }));
  }

  // Méthode pour générer l'URL des fichiers
  public getFileUrl(file: unknown): string | null {
    if (!file) return null;

    // Cas 1: URL complète
    if (typeof file === 'string' && /^https?:\/\//.test(file)) return file;

    // Cas 2: Objet Directus standard
    if (typeof file === 'object' && file !== null) {
      const id = (file as any)?.id || (file as any)?.directus_files_id;
      if (id) return `${this.baseUrl}/assets/${id}`;
    }

    // Cas 3: ID simple (string)
    if (typeof file === 'string') {
      return `${this.baseUrl}/assets/${file}`;
    }

    return null;
  }

  /**
   * Méthode générique pour récupérer des données
   */
  private fetchData<T>(
    endpoint: string,
    entitySignal: WritableSignal<T[] | T | null>,
    entityName: string,
    transformFn?: (item: unknown) => T,
    isSingle: boolean = false
  ): Observable<T | T[] | null> {
    this.setLoadingState(entityName, true);
    this.setErrorState(entityName, null);

    const url = `${this.baseUrl}/items/${endpoint}`;

    return this.http.get<unknown>(url, {
      params: { fields: '*' },
      headers: {
        'Access-Control-Max-Age': '0',
        'Vary': 'Origin',
        'ngrok-skip-browser-warning': 'true'
      }
    }).pipe(
      map(response => (response as { data?: unknown })?.data ?? response),
      map(data => {
        // Handle single entity request
        if (isSingle) {
          const singleData = Array.isArray(data) ? data[0] : data;
          return transformFn && singleData
            ? transformFn(singleData)
            : singleData;
        }

        // Handle collection
        const collection = Array.isArray(data) ? data : [data];
        return transformFn
          ? collection.map(item => transformFn(item))
          : collection;
      }),
      tap(transformedData => entitySignal.set(transformedData as T | T[] | null)),
      catchError(error => {
        this.setErrorState(entityName, `Échec du chargement des ${entityName}`);
        return throwError(() => new Error(`Échec du chargement des ${entityName}`));
      }),
      finalize(() => this.setLoadingState(entityName, false))
    );
  }

  initFromTransferState(): void {
    this.globalSettings.set(this.transferState.get(GLOBAL_SETTINGS_KEY, null));
    this.accountTypes.set(this.transferState.get(ACCOUNT_TYPES_KEY, []));
    this.pages.set(this.transferState.get(PAGES_KEY, []));
    this.pageSections.set(this.transferState.get(PAGE_SECTIONS_KEY, []));
    this.testimonials.set(this.transferState.get(TESTIMONIALS_KEY, []));
    this.statistics.set(this.transferState.get(STATISTICS_KEY, []));
    this.pageSectionsRelations.set(this.transferState.get(PAGE_SECTIONS_RELATIONS_KEY, []));
    this.pageSectionsAccountTypes.set(this.transferState.get(PAGE_SECTIONS_ACCOUNT_TYPES_KEY, []));
    this.pageSectionsStatistics.set(this.transferState.get(PAGE_SECTIONS_STATISTICS_KEY, []));
    this.pageSectionsTestimonials.set(this.transferState.get(PAGE_SECTIONS_TESTIMONIALS_KEY, []));
  }

  fetchGlobalSettings(): Observable<GlobalSettings | null> {
    return this.fetchData<GlobalSettings>(
      'global_settings',
      this.globalSettings as WritableSignal<GlobalSettings | null>,
      'global_settings',
      (settings: unknown) => ({
        ...(settings as GlobalSettings),
        site_logo: this.getFileUrl((settings as GlobalSettings).site_logo)
      }),
      true // Indicate for single entity
    ) as Observable<GlobalSettings | null>;
  }

  fetchAccountTypes(): Observable<AccountType[] | null> {
    return this.fetchData<AccountType>(
      'Account_types',
      this.accountTypes,
      'account_types',
      (account: unknown) => ({
        ...(account as AccountType),
        Icon: this.getFileUrl((account as AccountType).Icon)
      })
    ) as Observable<AccountType[] | null>;
  }

  fetchPages(): Observable<Page[] | null> {
    return this.fetchData<Page[]>(
      'Pages',
      this.pages,
      'pages'
    ) as Observable<Page[] | null>;
  }

  fetchPageSections(): Observable<PageSection[] | null> {
    return this.fetchData<PageSection>(
      'Pages_sections',
      this.pageSections,
      'page_sections',
      (section: unknown) => ({
        ...(section as PageSection),
        image: this.getFileUrl((section as PageSection).image),
        document: this.getFileUrl((section as PageSection).document)
      })
    ) as Observable<PageSection[] | null>;
  }

  fetchStatistics(): Observable<Statistic[] | null> {
    return this.fetchData<Statistic[]>(
      'Statistics',
      this.statistics,
      'statistics'
    ) as Observable<Statistic[] | null>;
  }

  fetchTestimonials(): Observable<Testimonial[] | null> {
    return this.fetchData<Testimonial>(
      'Testimonials',
      this.testimonials,
      'testimonials',
      (testimonial: unknown) => ({
        ...(testimonial as Testimonial),
        author_image: this.getFileUrl((testimonial as Testimonial).author_image)
      })
    ) as Observable<Testimonial[] | null>;
  }

  fetchPageSectionsRelations(): Observable<PageSectionsRelation[] | null> {
    return this.fetchData<PageSectionsRelation[]>(
      'Pages_Pages_sections',
      this.pageSectionsRelations,
      'page_sections_relations'
    ) as Observable<PageSectionsRelation[] | null>;
  }

   fetchPageSectionsAccountTypes(): Observable<PageSectionAccountTypes[] | null> {
    return this.fetchData<PageSectionAccountTypes[]>(
      'Pages_sections_Account_types',
      this.pageSectionsAccountTypes,
      'page_sections_account_types'
    ) as Observable<PageSectionAccountTypes[] | null>;
  }

  fetchPageSectionsStatistics(): Observable<PageSectionStatistics[] | null> {
    return this.fetchData<PageSectionStatistics[]>(
      'Pages_sections_Statistics',
      this.pageSectionsStatistics,
      'page_sections_statistics'
    ) as Observable<PageSectionStatistics[] | null>;
  }

  fetchPageSectionsTestimonials(): Observable<PageSectionTestimonials[] | null> {
    return this.fetchData<PageSectionTestimonials[]>(
      'Pages_sections_Testimonials',
      this.pageSectionsTestimonials,
      'page_sections_testimonials'
    ) as Observable<PageSectionTestimonials[] | null>;
  }

  public getPageBySlug(slug: string): Page | undefined {
  return this.pages().find(page => page.Slug === slug);
}

  async loadAllDataExternal(): Promise<void> {
    if (this.hasData()) return;

    await this.loadAllData();
  }
}