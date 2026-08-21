import { inject, Injectable, computed } from '@angular/core';
import { DirectusV2Service } from './directus-v2.service';

@Injectable({ providedIn: 'root' })
export class CareerService {
  private readonly directusV2 = inject(DirectusV2Service);

  isLoading = computed(() => !this.directusV2.ready());

  careerPage = computed(() => this.directusV2.careersPage());

  // Introduction de la page carrières (singleton `careers_page`).
  introData = computed(() => {
    const page = this.directusV2.careersPage();
    if (!page) return null;

    return {
      headline: String(page['intro_headline'] || ''),
      subheadline: String(page['intro_subheadline'] || ''),
      headlines2: String(page['intro_headline_2'] || ''),
      body_content: String(page['intro_body'] || ''),
      image: page['intro_image'] as string | null,
    };
  });

  // Offres d'emploi : vraies lignes typées (`job_offers`) au lieu d'un blob JSON.
  jobsData = computed(() => this.directusV2.jobOffers().map((job) => ({
    title: String(job['title'] || ''),
    description_poste: String(job['description'] || ''),
    missions_poste: Array.isArray(job['tasks']) ? job['tasks'] : [],
    description: {
      diplomes_requis: Array.isArray(job['diplomas']) ? job['diplomas'].join(' · ') : '',
      aptitudes_personnelles: Array.isArray(job['skills']) ? job['skills'].join(' · ') : '',
      constitution_du_dossier: Array.isArray(job['dossier']) ? job['dossier'] : [],
    },
    remuneration: job['remuneration'],
  })));
}
