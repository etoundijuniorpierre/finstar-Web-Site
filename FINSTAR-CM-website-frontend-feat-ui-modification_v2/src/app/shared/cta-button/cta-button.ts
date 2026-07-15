import {
  Component,
  ChangeDetectionStrategy,
  computed,
  input,
  signal,
  output,
  inject
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { I18nService } from '../../../services/i18n.service';
import { TranslateModule } from '@ngx-translate/core';
import { AnalyticsService } from '../../../services/analytics.service';

@Component({
  selector: 'app-cta-button',
  standalone: true,
  imports: [RouterModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      [routerLink]="computedLink()"
      [fragment]="fragment()"
      type="button"
      class="cta-button"
      [style]="borderStyle()"
      [class]="buttonClasses()"
      (mouseenter)="onMouseEnter()"
      (mouseleave)="onMouseLeave()"
      (click)="handleClick()"
    >
      {{ label() | translate}}
    </button>
  `,
  styles: `
  @reference "tailwindcss";
  :host { display: inline-block;}
    
    .cta-button {
      @apply relative overflow-hidden;
      transition-property: color, background-color, box-shadow;
      transition-duration: 0.4s;
      transition-timing-function: ease;
      
      &::before {
        content: '';
        @apply absolute inset-0 -z-10;
        background: inherit;
        border-radius: inherit;
      }
    }
    `
})
export class CtaButton {
  private readonly i18nService = inject(I18nService);
  private readonly analytics = inject(AnalyticsService);

  // Configuration des inputs avec valeurs par défaut
  label = input('SERVICES.DISCOVER');
  gradientStart = input('#FFE542'); // Jaune
  gradientEnd = input('#E74C9E'); // Rose
  size = input<'sm' | 'md' | 'lg'>('md');
  link = input<string>('/services');
  fragment = input<string | undefined>(undefined);
  disableRouting = input(false); 

  // Gestion de l'état hover avec un signal
  isHovered = signal(false);

  // Output pour les clics
  buttonClick = output<void>();

  // ✅ Computed pour créer un lien localisé
  computedLink = computed(() => {
    if (this.disableRouting()) return null;
    
    const baseLink = this.link();
    
    // Si le lien est déjà préfixé avec une langue, le retourner tel quel
    if (baseLink.match(/^\/(fr-FR|en-US)/)) {
      return baseLink;
    }
    
    // Sinon, ajouter le préfixe de langue
    return this.i18nService.createLocalizedLink(baseLink);
  });

  // Handle click events
  protected handleClick() {
    this.analytics.track('cta_click', {
      label: this.label(),
      destination: this.link()
    });
    this.buttonClick.emit();
  }

  // Calcul du style de bordure avec dégradé
  borderStyle = computed(() => {
    const size = this.size() === 'lg' ? '4px' :
      this.size() === 'sm' ? '2px' : '3px';

    return {
      border: `${size} solid transparent`,
      background: `
      ${this.isHovered() ?
          'linear-gradient(white, white)' : 'linear-gradient(black, black)'}        padding-box, 
    linear-gradient(135deg, ${this.gradientStart()}, ${this.gradientEnd()}) border-box`
    };
  });

  // Calcul des classes conditionnelles
  buttonClasses = computed(() => [
    'rounded-full',
    'cursor-pointer',
    'mx-4',
    this.sizeClasses()[this.size()],
    this.isHovered() ? 'bg-white text-black shadow-lg' : 'bg-black text-white',
    this.size() === 'sm' ? 'w-[200px]' : ''
  ].join(' '));

  // Configuration responsive des tailles
  private readonly sizeClasses = signal({
    sm: 'px-4 py-2 text-sm',
    md: 'px-5 py-2 text-base',
    lg: 'px-20 py-2 text-lg'
  });

  // Gestion des événements directement dans le template
  protected onMouseEnter() { this.isHovered.set(true); }
  protected onMouseLeave() { this.isHovered.set(false); }
}
