// services.service.ts
import { inject, Injectable, computed } from '@angular/core';
import { DirectusSdkService } from './directus.sdk.service';
import { LoanProcess } from '../types/directus';

export interface AccountOpeningGuide {
  key: string;
  account_ids: number[];
  label: string;
  tagline: string;
  best_for: string;
  use_cases: string[];
  opening_minimum: string;
  documents: string[];
  benefits: string[];
  practical_note?: string;
}

@Injectable({ providedIn: 'root' })
export class ServicesService {
  private readonly directus = inject(DirectusSdkService);
  isLoading = computed(() => this.directus.isLoading());

  // Page de services
  servicesPage = computed(() => {
    const pages = this.directus.pagesWithSections();
    return pages.find(page => page.Slug === 'services');
  });

  // Récupérer les sections par leur ID
  sectionById = (id: number) => computed(() => {
    const sections = this.servicesPage()?.sections || [];
    return sections.find(s => s.Pages_sections_id === id) ?? null;
  });

  // Données pour chaque section
  accountsSection = this.sectionById(9);
  introSection = this.sectionById(8);
  openAccountSection = this.sectionById(10);
  
  // ✅ Correction du parsing de subheadline2
  creditRequirementsSection = computed(() => {
    const section = this.sectionById(11)();
    if (!section) return null;

    // Parser subheadline2 selon le nouveau format
    let loanProcess: LoanProcess[] | null = null;
    
    try {
      if (section.subheadline2) {
        // ✅ Vérification du type AVANT de parser
        if (typeof section.subheadline2 === 'string') {
          // Si c'est une chaîne, parser comme JSON
          loanProcess = JSON.parse(section.subheadline2);
        } else if (Array.isArray(section.subheadline2)) {
          // Si c'est déjà un tableau, utiliser directement
          loanProcess = section.subheadline2;
        } else if (typeof section.subheadline2 === 'object' && section.subheadline2 !== null) {
          // Si c'est un objet mais pas un tableau
          console.warn('[ServicesService] subheadline2 est un objet, pas un tableau:', section.subheadline2);
          loanProcess = null;
        }
      }
    } catch (e) {
      console.error('[ServicesService] Erreur lors du parsing de subheadline2:', e);
      console.error('[ServicesService] Données reçues:', section.subheadline2);
      console.error('[ServicesService] Type des données:', typeof section.subheadline2);
      loanProcess = null;
    }

    return {
      ...section,
      loanProcess // Nouvelle propriété structurée
    };
  });

  // Données formatées
  introData = computed(() => {
    const section = this.introSection();
    if (!section) return null;
    return {
      headline: section.headline,
      subheadline: section.subheadline,
      image: section.image
    };
  });
  
  // Produits de la page services
  productsData = computed(() => {
    const page = this.servicesPage();
    return page?.products || [];
  });
  
  // Méthode pour récupérer les items d'un produit
  getProductItems(productId: number) {
    return this.directus.getProductItems(productId);
  }

  accountsData = computed(() => {
    const section = this.accountsSection();
    return section?.account_types || [];
  });

  accountOpeningGuides = computed<AccountOpeningGuide[]>(() => {
    const raw = this.accountsSection()?.table_data;
    if (!raw) return [];

    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('[ServicesService] Invalid account-opening guide data:', error);
      return [];
    }
  });

  openAccountData = computed(() => {
    const section = this.openAccountSection();
    if (!section) return null;
    return {
      headline: section.headline,
      subheadline: section.subheadline,
      image: section.image
    };
  });

  // ✅ Correction du parsing de table_data (qui est une CHAÎNE selon vos logs)
  creditRequirementsData = computed(() => {
    const section = this.creditRequirementsSection();
    if (!section?.table_data) return null;

    try {
      // table_data est une chaîne JSON, on doit la parser
      const tableData = typeof section.table_data === 'string' 
        ? JSON.parse(section.table_data)
        : section.table_data;

      return tableData.map((item: any) => ({
        category: item.category,
        interestRate: Array.isArray(item['interest rate']) 
          ? item['interest rate']
          : [item['interest rate'] || ''],
        requirements: Array.isArray(item.requirements)
          ? item.requirements
          : [item.requirements || '']
      }));
    } catch (e) {
      console.error('Erreur parsing credit requirements:', e);
      return null;
    }
  });
}
