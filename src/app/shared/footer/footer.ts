import { Component, computed, inject, ElementRef, viewChild, afterNextRender, signal, DestroyRef, NgZone } from '@angular/core';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { LayoutService } from '../../../services/layout.service';
import { TranslateModule } from '@ngx-translate/core';
import { I18nService } from '../../../services/i18n.service';
import { ContactService } from '../../../services/contact.service';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface SocialLink {
  key: string;
  label: string;
  url: string;
}

@Component({
  selector: 'app-footer',
  imports: [RouterModule, TranslateModule],
  template: `
@if (footerData(); as data) {
  <div class="landing-center">
    <div class="landing-logo-block">
      @if (navbarData()) {
        <a [routerLink]="homeLink()" aria-label="Accueil Finstar" style="cursor:pointer;display:inline-block;">
          <img 
            [src]="navbarData()!.logo" 
            alt="Finstar Logo" 
            class="landing-logo">
        </a>
      }
    </div>
    <ul class="landing-menu" #footerMenu>
      <li class="nav-indicator" [style]="indicatorStyle()" aria-hidden="true"></li>
      <li routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}"><a [routerLink]="homeLink()">{{ 'NAV.HOME' | translate }}</a></li>
      <li routerLinkActive="active"><a [routerLink]="servicesLink()">{{ 'NAV.SERVICES' | translate }}</a></li>
      <li routerLinkActive="active"><a [routerLink]="agenciesLink()">{{ 'NAV.AGENCIES' | translate }}</a></li>
      <li routerLinkActive="active"><a [routerLink]="careerLink()">{{ 'NAV.CAREER' | translate }}</a></li>
      <li routerLinkActive="active"><a [routerLink]="aboutLink()">{{ 'NAV.ABOUT' | translate }}</a></li>
      <li routerLinkActive="active"><a [routerLink]="contactsLink()">{{ 'NAV.CONTACTS' | translate }}</a></li>
      <li routerLinkActive="active"><a [routerLink]="faqLink()">{{ 'NAV.FAQ' | translate }}</a></li>
    </ul>
    
    <!-- Réseaux sociaux : les adresses viennent de site_settings.social_links ;
         seules les icônes restent dans le code, ce sont du balisage. -->
    <div class="footer-socials">
      @for (link of socialLinks(); track link.url) {
        <a [href]="link.url" target="_blank" rel="noopener" [attr.aria-label]="link.label" class="social-link" [class]="'social-link ' + link.key">
          @switch (link.key) {
            @case ('facebook') {
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
            }
            @case ('linkedin') {
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>
            }
            @case ('instagram') {
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="20" x="2" y="2" rx="5"/><circle cx="12" cy="12" r="4"/><line x1="17.5" x2="17.5" y1="6.5" y2="6.5"/></svg>
            }
            @case ('youtube') {
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 8a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v8a4 4 0 0 0 4 4h12a4 4 0 0 0 4-4z"/><path d="m10 9 5 3-5 3z"/></svg>
            }
            @default {
              <!-- Réseau ajouté dans Directus sans icône dédiée : le libellé suffit. -->
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 0 20a15.3 15.3 0 0 1 0-20"/></svg>
            }
          }
          {{ link.label }}
        </a>
      }
      <a [href]="whatsappLink()" target="_blank" rel="noopener" aria-label="WhatsApp" class="social-link whatsapp">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
        WhatsApp
      </a>
    </div>

    <footer class="landing-footer">
      {{ data.address }} |
      <a [routerLink]="contactsLink()" [fragment]="'contact-form'" class="footer-email-link" [attr.aria-label]="data.email">{{ data.email }}</a>
      <div class="mt-2">{{ 'FOOTER.COPYRIGHT' | translate:{ year: currentYear } }}</div>
    </footer>
  </div>
}
  `,
  styleUrl: './footer.scss'
})
export class Footer {
  readonly currentYear = new Date().getFullYear();
  private readonly layoutService = inject(LayoutService);
  private readonly i18nService = inject(I18nService);
  private readonly contactService = inject(ContactService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);
  private readonly indicatorTimeouts = new Set<ReturnType<typeof setTimeout>>();

  navbarData = this.layoutService.navbarData;
  footerData = this.layoutService.footerData;

  /**
   * Réseaux sociaux publiés, tels que saisis dans `site_settings.social_links`.
   *
   * Les adresses étaient écrites en dur dans ce gabarit : changer une page
   * Facebook imposait un déploiement. Les entrées incomplètes sont ignorées
   * plutôt que rendues en liens morts.
   */
  socialLinks = computed<SocialLink[]>(() => {
    const brut = this.footerData()?.socialLinks;
    if (!Array.isArray(brut)) return [];
    return brut
      .map((entree) => (entree ?? {}) as Record<string, unknown>)
      .map((entree) => ({
        key: String(entree['key'] ?? '').trim().toLowerCase(),
        label: String(entree['label'] ?? '').trim(),
        url: String(entree['url'] ?? '').trim(),
      }))
      .filter((lien) => Boolean(lien.url) && /^https?:\/\//i.test(lien.url))
      .map((lien) => ({ ...lien, label: lien.label || lien.key || lien.url }));
  });

  // Reference to the footer menu for indicator calculation
  footerMenu = viewChild<ElementRef<HTMLUListElement>>('footerMenu');
  indicatorStyle = signal<any>({ opacity: '0', display: 'none' });

    // ✅ Computed pour générer les liens localisés
  homeLink = computed(() => this.i18nService.createLocalizedLink('/home'));
  servicesLink = computed(() => this.i18nService.createLocalizedLink('/services'));
  agenciesLink = computed(() => this.i18nService.createLocalizedLink('/agencies'));
  careerLink = computed(() => this.i18nService.createLocalizedLink('/career'));
  aboutLink = computed(() => this.i18nService.createLocalizedLink('/about'));
  contactsLink = computed(() => this.i18nService.createLocalizedLink('/contacts'));
  faqLink = computed(() => this.i18nService.createLocalizedLink('/faq'));

  whatsappLink = computed(() => {
    const contacts = this.contactService.contactData();
    const wa = contacts?.contact_info?.customer_service?.whatsapp || '';
    const number = wa.replace(/[^0-9]/g, '');
    return `https://wa.me/${number}?text=Bonjour%20FINSTAR-CM%20S.A.%2C%20j'aimerais%20avoir%20plus%20d'informations%20sur%20vos%20services.`;
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.indicatorTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
      this.indicatorTimeouts.clear();
    });

    afterNextRender(() => {
      // Initial calculation
      this.scheduleIndicatorUpdate(200);

      // Listen to navigation events
      this.router.events.pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      ).subscribe(() => {
        this.scheduleIndicatorUpdate(150);
      });

      // Update on resize
      const resizeObserver = new ResizeObserver(() => {
        this.updateIndicator();
      });
      const menuEl = this.footerMenu()?.nativeElement;
      if (menuEl) resizeObserver.observe(menuEl);
      this.destroyRef.onDestroy(() => resizeObserver.disconnect());
    });
  }

  private scheduleIndicatorUpdate(delay: number): void {
    const timeoutId = setTimeout(() => {
      this.indicatorTimeouts.delete(timeoutId);
      if (!this.destroyRef.destroyed) {
        this.updateIndicator();
      }
    }, delay);

    this.indicatorTimeouts.add(timeoutId);
  }

  private updateIndicator() {
    if (this.destroyRef.destroyed) return;

    this.ngZone.runOutsideAngular(() => {
      const menuEl = this.footerMenu()?.nativeElement;
      if (!menuEl) return;

      const activeItem = menuEl.querySelector('li.active') as HTMLElement;
      
      if (activeItem) {
        const linkEl = activeItem.querySelector('a') as HTMLElement;
        if (!linkEl) return;

        const newStyle = {
          width: `${linkEl.offsetWidth}px`,
          left: `${activeItem.offsetLeft}px`,
          top: `${activeItem.offsetTop + linkEl.offsetHeight + 2}px`,
          opacity: '1',
          display: 'block'
        };
        
        if (!this.destroyRef.destroyed) {
          this.ngZone.run(() => this.indicatorStyle.set(newStyle));
        }
      } else {
        if (!this.destroyRef.destroyed) {
          this.ngZone.run(() => this.indicatorStyle.set({ opacity: '0', display: 'none' }));
        }
      }
    });
  }
}
