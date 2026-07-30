// career.component.ts
import { Component, effect, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';

import { CareerService } from '../../../services/career.service';
import { JoinUsComponent } from "../../shared/join-us/join-us";
import { CtaButton } from "../../shared/cta-button/cta-button";
import { I18nService } from '../../../services/i18n.service';
import { SeoService } from '../../../services/seo.service';

@Component({
  selector: 'app-career',
  standalone: true,
  imports: [CommonModule, NgOptimizedImage, JoinUsComponent, CtaButton, ButtonModule, InputTextModule, DialogModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './career.html',
  styleUrl: './career.scss'
})
export class Career {

  private readonly careerService = inject(CareerService);
  private readonly i18nService = inject(I18nService);
  private readonly seoService = inject(SeoService);

  // Données réactives
  introData = this.careerService.introData;
  jobsData = this.careerService.jobsData;
  isLoading = this.careerService.isLoading;
  careerData = this.careerService.careerPage;
  private readonly router: Router = inject(Router);

  selectedJobIndex = 0;

  selectJob(index: number) {
    this.selectedJobIndex = Math.max(0, Math.min(index, this.jobsData().length - 1));
  }

  onJobKeydown(event: KeyboardEvent, index: number): void {
    const lastIndex = this.jobsData().length - 1;
    let nextIndex = index;

    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      nextIndex = index >= lastIndex ? 0 : index + 1;
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      nextIndex = index <= 0 ? lastIndex : index - 1;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = lastIndex;
    } else {
      return;
    }

    event.preventDefault();
    this.selectJob(nextIndex);
    const list = (event.currentTarget as HTMLElement).parentElement;
    list?.querySelector<HTMLElement>(`[data-job-index="${nextIndex}"]`)?.focus();
  }

  visible: boolean = false;

  constructor() {
    effect(() => {
      const lang = this.i18nService.currentLanguage();
      this.seoService.updatePageSeo('CAREER');
    });
  }

  showDialog() {
    this.visible = true;
  }
  redirectToCandidature() {
    this.router.navigate(['/career/candidature']);
  }
  onApply(jobTitle: string) {
    const localizedLink = this.i18nService.createLocalizedLink('/career/candidature');
    this.router.navigate([localizedLink], { queryParams: { job: jobTitle } });
  }

  reloadPage(): void {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }

  /**
   * Découpe une valeur de mission en éléments de liste. Les données Directus
   * arrivent souvent sous forme d'énumération jointe sans espace
   * ("Superviser…,Suivre…,Coordonner…") ; on la rend en puces lisibles.
   * On strippe d'abord un éventuel balisage HTML résiduel, puis on découpe sur
   * les virgules, points-virgules, sauts de ligne ou puces.
   */
  toList(value: unknown): string[] {
    if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
    if (typeof value !== 'string') return [];
    const plain = value.replace(/<[^>]*>/g, ' ');
    return plain
      .split(/[;\n•]+|,(?=\s*\S)/)
      .map(part => part.trim())
      .filter(part => part.length > 0);
  }

  private normalizeJobLabel(job: any): string {
    return `${job?.title ?? ''} ${job?.description_poste ?? ''}`.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  isStageJob(job: any): boolean {
    const label = this.normalizeJobLabel(job);
    return label.includes('stage') || label.includes('internship') || label.includes('academ') || label.includes('professionnel');
  }

  isCollectorJob(job: any): boolean {
    const label = this.normalizeJobLabel(job);
    return label.includes('collectrice') || label.includes('collection officer');
  }

  isSupervisionJob(job: any): boolean {
    const label = this.normalizeJobLabel(job);
    return label.includes('encadrement') || label.includes('supervisor');
  }

  /**
   * Les intitulés courts décrivent la famille de candidature sans exposer
   * des mentions de genre, de lieu ou de contrat devenues inutiles.
   * Le titre Directus d'origine reste utilisé pour identifier le formulaire.
   */
  jobDisplayTitle(job: any): string {
    if (this.isSupervisionJob(job)) return this.i18nService.translate.instant('CAREER.ROLE_FINSTAR_STAFF');
    if (this.isCollectorJob(job)) return this.i18nService.translate.instant('CAREER.ROLE_COLLECTION_AGENT');
    if (this.isStageJob(job)) return this.i18nService.translate.instant('CAREER.ROLE_INTERN');
    return job?.title ?? '';
  }
}
