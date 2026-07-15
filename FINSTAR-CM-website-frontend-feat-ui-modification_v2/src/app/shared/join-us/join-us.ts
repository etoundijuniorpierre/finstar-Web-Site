import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { JoinUsService } from '../../../services/join-us.service';

@Component({
  selector: 'app-join-us',
  standalone: true,
  imports: [NgOptimizedImage, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  @if (joinUsData(); as data) {
      <div class="z-20 text-center px-4">
        <h2 class="text-5xl md:text-7xl font-bold mb-8 leading-[1.3] max-w-[600px] md:max-w-[900px] mx-auto transition-transform duration-300 hover:scale-105 cursor-default">
          <span class="bg-clip-text text-transparent bg-gradient-to-r from-[#FFD600] to-[#FF6CAB] inline-block hover:from-[#FFE542] hover:to-[#FF8AC0] transition-all duration-300">
            {{ data.headline }}
          </span>
        </h2>
        @if (data.subheadline) {
          <p class="text-white/80 text-lg md:text-xl mb-6 max-w-2xl mx-auto">
            {{ data.subheadline }}
          </p>
        }
        <!--<div class="mt-6">
          <button 
            type="button" 
            (click)="onButtonClick.emit()"
            class="text-xl md:text-2xl font-bold py-4 px-10 rounded-full border-[3px] border-[#FFD600]
                   bg-gradient-to-r from-[#FFD600] to-[#FF6CAB] text-white shadow-[0_4px_32px_0_#ff6cab55]
                   transition-all duration-300 hover:scale-110 hover:shadow-[0_8px_48px_0_#ff6cab88] hover:border-[#FFE542] cursor-pointer">
            {{ data.call_to_action_link }}
          </button>
        </div>-->
      </div>

      <!-- Étoiles -->
      <img 
        [ngSrc]="starYellow" 
        width="90"
        height="90"
        class="absolute left-[2%] top-[8%] w-[90px] opacity-95 pointer-events-none" 
        alt="" aria-hidden="true">
        
      <img 
        [ngSrc]="starDarkPurple" 
        width="300"
        height="300"
        class="absolute left-[-5%] bottom-[10%] w-[300px] blur-sm opacity-70 pointer-events-none"
        alt="" aria-hidden="true">
        
      <img 
        [ngSrc]="starYellow" 
        width="60"
        height="60"
        class="absolute left-[10%] bottom-[20%] w-[60px] opacity-95 pointer-events-none"
        alt="" aria-hidden="true">
        
      <img 
        [ngSrc]="starYellow" 
        width="180"
        height="180"
        class="absolute right-[5%] top-[10%] w-[180px] blur opacity-80 pointer-events-none"
        alt="" aria-hidden="true">
        
      <img 
        [ngSrc]="starDarkPurple" 
        width="350"
        height="350"
        class="absolute right-[-8%] bottom-[5%] w-[350px] blur-sm opacity-70 pointer-events-none"
        alt="" aria-hidden="true">
        
      <img 
        [ngSrc]="starYellow" 
        width="120"
        height="120"
        class="absolute right-0 top-[40%] w-[120px] opacity-95 pointer-events-none" 
        alt="" aria-hidden="true">
      }
    @else if (isLoading()) {
      <div class="z-20 text-center">
        <div class="animate-pulse">
          <div class="h-16 bg-gray-300 rounded mb-8 mx-auto max-w-md"></div>
          <div class="h-12 bg-gray-300 rounded mx-auto max-w-xs"></div>
        </div>
      </div>
    } 
   @else {
      <!-- Fallback pour les données par défaut -->
      <div class="z-20 text-center px-4">
        <h2 class="text-5xl md:text-7xl font-bold mb-8 leading-[1.3] max-w-[600px] md:max-w-[900px] mx-auto transition-transform duration-300 hover:scale-105 cursor-default">
          <span class="bg-clip-text text-transparent bg-gradient-to-r from-[#FFD600] to-[#FF6CAB] inline-block hover:from-[#FFE542] hover:to-[#FF8AC0] transition-all duration-300">
            {{ 'JOIN_US.FALLBACK_HEADLINE_1' | translate }}
          </span><br>
          <span class="bg-clip-text text-transparent bg-gradient-to-r from-[#FFD600] to-[#FF6CAB] inline-block mt-2 hover:from-[#FFE542] hover:to-[#FF8AC0] transition-all duration-300">
            {{ 'JOIN_US.FALLBACK_HEADLINE_2' | translate }}
          </span>
        </h2>
        <div class="mt-6">
          <button
            type="button"
            (click)="onButtonClick.emit()"
            class="text-xl md:text-2xl font-bold py-4 px-10 rounded-full border-[3px] border-[#FFD600]
                   bg-gradient-to-r from-[#FFD600] to-[#FF6CAB] text-white shadow-[0_4px_32px_0_#ff6cab55]
                   transition-transform duration-300 hover:scale-110 hover:shadow-[0_8px_48px_0_#ff6cab88] hover:border-[#FFE542] cursor-pointer">
            {{ 'JOIN_US.FALLBACK_CTA' | translate }}
          </button>
        </div>
      </div>

      <!-- Étoiles -->
      <img 
        [ngSrc]="starYellow" 
        width="90"
        height="90"
        class="absolute left-[2%] top-[8%] w-[90px] opacity-95 pointer-events-none" 
        alt="" aria-hidden="true">
        
      <img 
        [ngSrc]="starDarkPurple" 
        width="300"
        height="300"
        class="absolute left-[-5%] bottom-[10%] w-[300px] blur-sm opacity-70 pointer-events-none"
        alt="" aria-hidden="true">
        
      <img 
        [ngSrc]="starYellow" 
        width="60"
        height="60"
        class="absolute left-[10%] bottom-[20%] w-[60px] opacity-95 pointer-events-none"
        alt="" aria-hidden="true">
        
      <img 
        [ngSrc]="starYellow" 
        width="180"
        height="180"
        class="absolute right-[5%] top-[10%] w-[180px] blur opacity-80 pointer-events-none"
        alt="" aria-hidden="true">
        
      <img 
        [ngSrc]="starDarkPurple" 
        width="350"
        height="350"
        class="absolute right-[-8%] bottom-[5%] w-[350px] blur-sm opacity-70 pointer-events-none"
        alt="" aria-hidden="true">
        
      <img 
        [ngSrc]="starYellow" 
        width="120"
        height="120"
        class="absolute right-0 top-[40%] w-[120px] opacity-95 pointer-events-none" 
        alt="" aria-hidden="true">
    }
  `,
  styles: `
    :host {
      display: block;
      background: radial-gradient(ellipse at center, #232323 60%, #111 100%);
      position: relative;
      width: 100%;
      min-height: 550px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  `
})
export class JoinUsComponent {
  private readonly joinUsService = inject(JoinUsService);

  // Input optionnel pour spécifier quelle page utiliser pour récupérer la section
  pageSlug = input<string>('home'); // Par défaut, on prend la page home

  // Input optionnel pour spécifier un ID de section spécifique
  sectionId = input<number | null>(null);

  // Event emitter pour le clic bouton
  onButtonClick = output<void>();

  // Computed pour récupérer les données de la section call_to_action
  joinUsData = computed(() => {
    const sectionId = this.sectionId();
    const pageSlug = this.pageSlug();

    // Si un ID de section est spécifié, l'utiliser en priorité
    if (sectionId) {
      return this.joinUsService.getCallToActionById(sectionId);
    }

    // Sinon, chercher par slug de page
    const data = this.joinUsService.getCallToActionByPage(pageSlug);

    // Si aucune donnée trouvée pour cette page, prendre la première disponible
    return data || this.joinUsService.getDefaultCallToAction();
  });

  // État de chargement
  isLoading = computed(() => this.joinUsService.isLoading());

  // Chemins des images optimisés (conservés tels quels)
  starYellow = '/assets/stars/Star-yellow.png';
  starDarkPurple = '/assets/stars/Star-dark-purple.png';
}
