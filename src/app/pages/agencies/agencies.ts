import { ChangeDetectionStrategy, Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { DirectusV2Service, LocalizedAgency } from '../../../services/directus-v2.service';
import { I18nService } from '../../../services/i18n.service';
import { SeoService } from '../../../services/seo.service';
import { JoinUsComponent } from '../../shared/join-us/join-us';

@Component({
  selector: 'app-agencies',
  standalone: true,
  imports: [RouterModule, TranslateModule, JoinUsComponent],
  templateUrl: './agencies.html',
  styleUrl: './agencies.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Agencies {
  private readonly directusV2 = inject(DirectusV2Service);
  private readonly i18n = inject(I18nService);
  private readonly seo = inject(SeoService);

  readonly agencies = this.directusV2.agencies;
  readonly siteLogo = computed(() => String(this.directusV2.siteSettings()?.['site_logo'] || '/assets/logo-finstar.png'));

  readonly contactLink = computed(() => this.i18n.createLocalizedLink('/contacts'));

  /**
   * La direction générale n'est pas une agence : elle est extraite de la liste
   * et présentée à part, avec son propre rôle.
   */
  readonly headOffice = computed<LocalizedAgency | null>(
    () => this.agencies().find((agency) => agency.type === 'direction_generale') ?? null,
  );

  readonly branches = computed<LocalizedAgency[]>(
    () => this.agencies().filter((agency) => agency.type !== 'direction_generale'),
  );

  /** Régions couvertes, déduites des agences plutôt que saisies à la main. */
  readonly regionCount = computed(
    () => new Set(this.branches().map((agency) => (agency.region || '').trim()).filter(Boolean)).size,
  );

  readonly branchCount = computed(() => this.branches().length);

  /** Implantation ouverte dans la fenêtre de détail ; `null` quand elle est fermée. */
  readonly selected = signal<LocalizedAgency | null>(null);

  constructor() {
    effect(() => this.seo.updateAgenciesSeo(this.agencies() as unknown as ReadonlyArray<Record<string, unknown>>));
  }

  open(agency: LocalizedAgency): void {
    this.selected.set(agency);
  }

  close(): void {
    this.selected.set(null);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.selected()) this.close();
  }

  isHeadOffice(agency: LocalizedAgency | null): boolean {
    return agency?.type === 'direction_generale';
  }

  usesLogo(agency: LocalizedAgency): boolean {
    return !agency.photo || agency.photo === this.siteLogo();
  }

  photoOf(agency: LocalizedAgency): string {
    return agency.photo || this.siteLogo();
  }

  mailHref(email: string): string {
    return `mailto:${email.trim()}`;
  }
}
