import { Component, inject, signal, ChangeDetectionStrategy, computed, ElementRef, viewChild, afterNextRender, DestroyRef, NgZone, effect, HostListener } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { RouterModule, Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { LayoutService } from '../../../services/layout.service';
import { CtaButton } from '../cta-button/cta-button';
import { I18nService } from '../../../services/i18n.service';
import { TranslateModule } from '@ngx-translate/core';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';

@Component({
  selector: 'app-navbar',
  imports: [RouterModule, CtaButton, TranslateModule],
  template: `
<nav class="main-navbar" [class.scrolled]="isScrolled()" [attr.aria-label]="'NAV.MAIN_NAVIGATION' | translate" (keydown.escape)="closeMenu()">
    @if (navbarData()) {
    <a [routerLink]="homeLink()" aria-label="Accueil Finstar" class="logo-link">
      <img 
        [src]="navbarData()!.logo" 
        alt="Finstar Logo" 
        class="logo-img" 
        width="152.5px" 
        height="77.27px">
    </a>
  }
  
  <!-- Menu hamburger (visible seulement sur mobile) -->
  <button 
    class="navbar-hamburger" 
    [class.active]="isMenuOpen()"
    (click)="toggleMenu()"
    type="button"
    aria-controls="primary-navigation"
    [attr.aria-expanded]="isMenuOpen()"
    [attr.aria-label]="'NAV.MENU' | translate"
  >
    <span></span>
    <span></span>
    <span></span>
  </button>
  
  <!-- Menu de navigation -->
  <ul id="primary-navigation" class="navbar-menu" #navMenu [class.active]="isMenuOpen()"
      [attr.aria-hidden]="isMobileViewport() && !isMenuOpen() ? 'true' : null"
      [attr.inert]="isMobileViewport() && !isMenuOpen() ? '' : null">
    <li class="nav-indicator" [style]="indicatorStyle()" aria-hidden="true"></li>
    <!-- Liens avec traduction et routerLink corrigé -->
   <li>
    <a [routerLink]="homeLink()" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" (click)="closeMenu()">
      {{ 'NAV.HOME' | translate }}
    </a>
  </li>
  <li>
    <a [routerLink]="servicesLink()" routerLinkActive="active" (click)="closeMenu()">
      {{ 'NAV.SERVICES' | translate }}
    </a>
  </li>
  <li>
    <a [routerLink]="careerLink()" routerLinkActive="active" (click)="closeMenu()">
      {{ 'NAV.CAREER' | translate }}
    </a>
  </li>
  <li>
    <a [routerLink]="aboutLink()" routerLinkActive="active" (click)="closeMenu()">
      {{ 'NAV.ABOUT' | translate }}
    </a>
  </li>
  <li>
    <a [routerLink]="contactsLink()" routerLinkActive="active" (click)="closeMenu()">
      {{ 'NAV.CONTACTS' | translate }}
    </a>
  </li>
    <li class="mobile-language-toggle">
      <button type="button" class="language-switch" (click)="toggleLanguage()"
              [attr.aria-label]="'NAV.CHANGE_LANGUAGE' | translate"
              [class.en]="isEnglish()">
        <span class="language-knob"></span>
        <span class="language-label fr">FR</span>
        <span class="language-label en">EN</span>
      </button>
    </li>
    <li class="mobile-cta">
      <app-cta-button [label]="primaryCtaLabel()" [link]="primaryCtaLink()" [fragment]="primaryCtaFragment()">
      </app-cta-button>
    </li>
  </ul>
  
  <!-- Conteneur pour les éléments de droite (bureau) -->
  <div class="navbar-right">
    <!-- Bouton de changement de langue pour le bureau -->
    <button type="button" class="language-switch" (click)="toggleLanguage()"
            [attr.aria-label]="'NAV.CHANGE_LANGUAGE' | translate"
            [class.en]="isEnglish()">
      <span class="language-knob"></span>
      <span class="language-label fr">FR</span>
      <span class="language-label en">EN</span>
    </button>
    
    <!-- Bouton CTA pour le bureau -->
    <div class="desktop-cta">
      <app-cta-button [label]="primaryCtaLabel()" [link]="primaryCtaLink()" [fragment]="primaryCtaFragment()">
      </app-cta-button>
    </div>
  </div>
</nav>

<!-- Overlay pour fermer le menu en cliquant à l'extérieur -->
<div 
class="navbar-overlay" 
[class.active]="isMenuOpen()"
(click)="closeMenu()"
aria-hidden="true"
></div>
  `,
  styles: `
  .main-navbar {
  width: 100%;
  min-height: 90px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2vw;
  box-sizing: border-box;
  font-family: var(--font-sans);
  gap: 32px;
  box-shadow: 0 4px 24px -6px rgba(0,0,0,0.12);
  position: relative;
  z-index: 1000;
  transition: min-height 0.3s ease, background 0.3s ease, box-shadow 0.3s ease;

  &.scrolled {
    min-height: 70px;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    box-shadow: 0 10px 30px rgba(0,0,0,0.1);
    position: sticky;
    top: 0;

    .logo-img {
      width: 150px;
    }
  }

  .logo-img {
    height: auto;
    width: 180px;
    display: block;
    margin: 0 0 0 8px;
    z-index: 1001;
    transition: opacity 0.2s, width 0.3s ease;
  }

  .logo-link {
    display: block;
    cursor: pointer;
    z-index: 1001;
    text-decoration: none;
    &:hover img { opacity: 0.85; }
  }

  .navbar-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .desktop-cta {
    display: block;
  }

  .mobile-language-toggle {
    display: none;
  }

  .mobile-cta {
    display: none;
  }

  .navbar-menu {
    display: flex;
    gap: clamp(16px, 2.5vw, 36px);
    list-style: none;
    margin: 0 auto;
    padding: 0;
    align-items: center;
    justify-content: center;
    flex: 1 1 auto;
    position: relative;
    
   li {
    padding: 0; // Enlever le padding du li
    
    a {
      display: block;
      font-size: clamp(0.9rem, 1.2vw, 1.08rem);
      font-weight: 500;
      color: #111;
      text-decoration: none;
      padding: 0; // Pas de padding sur desktop
      transition: color 0.2s;
      position: relative;
      white-space: nowrap;
      
      &:hover {
        color: var(--brand-gold-strong);
      }
      
      &.active {
        color: var(--brand-gold-strong);
        font-weight: 600;
      }
    }
  }

  .nav-indicator {
    position: absolute;
    background: linear-gradient(90deg, #ffe542, #e74c9e);
    border-radius: 2px;
    transition:
      left 0.4s cubic-bezier(0.68, -0.55, 0.27, 1.55),
      top 0.4s cubic-bezier(0.68, -0.55, 0.27, 1.55),
      width 0.4s cubic-bezier(0.68, -0.55, 0.27, 1.55),
      height 0.4s cubic-bezier(0.68, -0.55, 0.27, 1.55),
      opacity 0.2s ease;
    pointer-events: none;
    z-index: 10;
  }
}

  .language-switch {
    position: relative;
    width: 60px;
    height: 28px;
    border-radius: 14px;
    background: #f0f0f0;
    border: 1px solid #ddd;
    cursor: pointer;
    display: flex;
    align-items: center;
    padding: 0 4px;
    transition: border-color 0.3s ease, background-color 0.3s ease;

    .language-knob {
      position: absolute;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: var(--brand-gold-strong);
      transition: left 0.3s ease;
      left: 3px;
      z-index: 2;
    }
    
    .language-label {
      font-size: 10px;
      font-weight: 600;
      width: 50%;
      text-align: center;
      z-index: 1;
      transition: color 0.3s ease;
    }
    
    .fr {
      color: #fff;
    }
    
    .en {
      color: #888;
    }
    
    &.en {
      .language-knob {
        left: calc(100% - 25px);
      }
      
      .fr {
        color: #888;
      }
      
      .en {
        color: #fff;
      }
    }
    
    &:hover {
      border-color: var(--brand-gold-strong);
    }
  }
}

// Menu hamburger (caché par défaut sur desktop)
.navbar-hamburger {
  display: none; // Caché par défaut
  flex-direction: column;
  justify-content: space-around;
  width: 52px;
  height: 52px;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 12px;
  box-sizing: border-box;
  z-index: 1001;
  
  span {
    width: 28px;
    height: 3px;
    background: #111;
    border-radius: 3px;
    transition: all 0.3s ease;
    transform-origin: center;
  }

  &.active {
    span:nth-child(1) {
      transform: rotate(45deg) translate(6px, 6px);
    }
    span:nth-child(2) {
      opacity: 0;
    }
    span:nth-child(3) {
      transform: rotate(-45deg) translate(6px, -6px);
    }
  }
}

// Overlay pour fermer le menu mobile
.navbar-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s ease, visibility 0.3s ease;

  &.active {
    opacity: 1;
    visibility: visible;
  }
}

// Responsive Design - CORRECTION IMPORTANTE
@media (max-width: 900px) {
  .main-navbar {
    justify-content: space-between;
    padding: 16px 2vw;
    min-height: 70px;
    
    .logo-img {
      width: 140px;
      margin: 0;
    }

    .navbar-right {
      display: none;
    }

    .desktop-cta {
      display: none;
    }

    // AFFICHER le hamburger sur mobile
    .navbar-hamburger {
      display: flex; // ← CORRECTION CRITIQUE
    }

    .navbar-menu {
      position: fixed;
      top: 0;
      right: -100%;
      width: 300px;
      height: 100vh;
      background: #fff;
      flex-direction: column;
      justify-content: flex-start;
      padding: 100px 0 40px 0;
      margin: 0;
      gap: 0;
      box-shadow: -5px 0 15px rgba(0,0,0,0.1);
      transition: right 0.3s ease;
      z-index: 1000;
      
      &.active {
        right: 0;
      }
      
li {
      padding: 0; // Important !
      
      a {
        display: block;
        font-size: 1.1rem;
        font-weight: 500;
        color: #111;
        padding: 16px 40px; // Le padding sur le lien
        width: 100%;
        text-align: left;
        border-bottom: 1px solid #f0f0f0;
        transition: background-color 0.2s;
        position: relative;
        
        &:hover {
          background-color: #f8f8f8;
          color: var(--brand-gold-strong);
        }
        
        // Style pour le lien actif mobile
        &.active {
          background-color: #f8f8f8;
          color: var(--brand-gold-strong);
          font-weight: 600;
          
          &::before {
            content: '';
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 4px;
            background: linear-gradient(180deg, #ffe542, #e74c9e);
          }
        }
      }
    }
      
      .mobile-language-toggle {
        display: flex;
        justify-content: center;
        padding: 16px 40px;
        border-bottom: 1px solid #f0f0f0;
        
        .language-switch {
          margin: 0 auto;
        }
      }
      
      .mobile-cta {
        display: block;
        padding: 20px 40px;
        border-bottom: none;
        text-align: center;
        
        app-cta-button {
          width: 100%;
        }
      }
    }
  }

  .navbar-overlay {
    display: block;
  }

  /* Le lien actif possède déjà son repère vertical sur mobile. */
  .nav-indicator {
    display: none !important;
  }
}

@media (max-width: 600px) {
  .main-navbar {
    .logo-img {
      width: 120px;
    }
    
    .navbar-menu {
      width: 280px;
      
      li:not(.nav-indicator) {
        font-size: 1rem;
        padding: 14px 30px;
      }

      .mobile-language-toggle {
        padding: 14px 30px;
      }

      .mobile-cta {
        padding: 15px 30px;
      }
    }
  }
}
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Navbar {
  private readonly layoutService = inject(LayoutService);
  private readonly i18nService = inject(I18nService);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);
  private readonly document = inject(DOCUMENT);
  private readonly indicatorTimeouts = new Set<ReturnType<typeof setTimeout>>();

  // Reference to the nav menu for indicator calculation
  navMenu = viewChild<ElementRef<HTMLUListElement>>('navMenu');
  indicatorStyle = signal<any>({ opacity: '0', display: 'none' });

  // Signal pour gérer l'état du menu mobile
  isMenuOpen = signal(false);
  isMobileViewport = signal(false);
  isScrolled = signal(false);
  currentUrl = signal(this.router.url);

  // Navigation data from layout service
  navbarData = this.layoutService.navbarData;

  // Language state
  currentLanguage = this.i18nService.currentLanguage;
  isEnglish = this.i18nService.isEnglish;

  // ✅ Computed pour générer les liens localisés
  homeLink = computed(() => this.i18nService.createLocalizedLink('/home'));
  servicesLink = computed(() => this.i18nService.createLocalizedLink('/services'));
  careerLink = computed(() => this.i18nService.createLocalizedLink('/career'));
  aboutLink = computed(() => this.i18nService.createLocalizedLink('/about'));
  contactsLink = computed(() => this.i18nService.createLocalizedLink('/contacts'));
  metricsLink = computed(() => this.i18nService.createLocalizedLink('/metrics'));
  // CTA persistant de la navbar : action distincte des boutons de hero
  // ("Découvrez nos services" / "Nous contacter") pour éviter toute redondance,
  // et orientée conversion (ouverture de compte).
  private readonly isServicesPage = computed(() => this.currentUrl().includes('/services'));
  primaryCtaLabel = computed(() => this.isServicesPage() ? 'NAV.CONTACT_US' : 'COMMON.OPEN_ACCOUNT');
  primaryCtaLink = computed(() => this.isServicesPage() ? '/contacts' : '/services');
  primaryCtaFragment = computed(() => this.isServicesPage() ? undefined : 'open-account');

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.indicatorTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
      this.indicatorTimeouts.clear();
      this.document.body.style.overflow = '';
    });

    effect(() => {
      const shouldLockScroll = this.isMobileViewport() && this.isMenuOpen();
      this.document.body.style.overflow = shouldLockScroll ? 'hidden' : '';
    });

    afterNextRender(() => {
      this.updateViewportState();

      // Initial calculation
      this.scheduleIndicatorUpdate(150);

      // Listen to navigation events
      this.router.events.pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      ).subscribe((event) => {
        this.currentUrl.set((event as NavigationEnd).urlAfterRedirects);
        // Delay to allow routerLinkActive to update UI
        this.scheduleIndicatorUpdate(100);
      });

      // Update on resize
      const resizeObserver = new ResizeObserver(() => {
        this.updateIndicator();
      });
      const menuEl = this.navMenu()?.nativeElement;
      if (menuEl) resizeObserver.observe(menuEl);
      // Éviter la fuite mémoire : déconnecter l'observer à la destruction.
      this.destroyRef.onDestroy(() => resizeObserver.disconnect());

      fromEvent(window, 'resize')
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.updateViewportState());
    });
  }

  private updateViewportState(): void {
    if (this.destroyRef.destroyed) return;
    const isMobile = window.innerWidth <= 900;
    this.isMobileViewport.set(isMobile);
    if (!isMobile) this.isMenuOpen.set(false);
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
      const menuEl = this.navMenu()?.nativeElement;
      if (!menuEl) return;

      const activeLink = menuEl.querySelector('a.active') as HTMLElement;
      const isMobile = window.innerWidth <= 900;

      if (isMobile) {
        this.ngZone.run(() => this.indicatorStyle.set({ opacity: '0', display: 'none' }));
        return;
      }
      
      if (activeLink) {
        const linkRect = activeLink.getBoundingClientRect();
        
        const newStyle = {
          width: `${linkRect.width}px`,
          height: '3px',
          left: `${activeLink.offsetLeft}px`,
          top: `${activeLink.offsetTop + activeLink.offsetHeight + 8}px`,
          opacity: '1',
          display: 'block',
          background: 'linear-gradient(90deg, #ffe542, #e74c9e)'
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

  // Méthode pour basculer l'état du menu
  toggleMenu() {
    this.isMenuOpen.update(value => !value);
  }

  // Méthode pour fermer le menu (utile lors du clic sur un lien)
  closeMenu() {
    this.isMenuOpen.set(false);
  }

  // Méthode pour changer la langue
  toggleLanguage() {
    this.i18nService.switchLanguage();
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    this.isScrolled.set(window.scrollY > 50);
  }
}
