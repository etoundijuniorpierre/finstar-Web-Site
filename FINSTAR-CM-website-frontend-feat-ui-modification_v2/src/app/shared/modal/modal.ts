import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
  HostListener,
  computed,
  effect,
  inject,
  ElementRef,
  viewChild,
  PLATFORM_ID
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

export type ModalType = 'success' | 'error' | 'warning' | 'info';

@Component({
  selector: 'app-modal',
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isOpen()) {
      <div
        class="fixed inset-0 z-[100] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        [attr.aria-describedby]="descriptionId"
        (keydown.tab)="onTabKey($event)"
        (keydown.shift.tab)="onTabKey($event)"
      >
        <!-- Overlay -->
        <div
          class="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
          (click)="onClose()"
          aria-hidden="true"
        ></div>

        <!-- Modal Content -->
        <div
          #dialog
          class="relative bg-[#f5f6f5] rounded-2xl shadow-2xl max-w-md w-full transform transition-all duration-300 scale-95 opacity-0 animate-modal-in border-4 border-transparent"
          [class]="borderGradient()"
          (click)="$event.stopPropagation()"
        >
          <!-- Header -->
          <div class="flex items-center justify-between p-6 border-b border-gray-200">
            <div class="flex items-center gap-3">
              <div class="flex-shrink-0" [class]="iconContainerClass()">
                @switch (type()) {
                  @case ('success') {
                    <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                    </svg>
                  }
                  @case ('error') {
                    <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  }
                  @case ('warning') {
                    <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z"/>
                    </svg>
                  }
                  @default {
                    <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                  }
                }
              </div>
              <h3 
                id="modal-title"
                class="text-xl font-bold text-gray-900"
                [attr.data-testid]="'modal-title-' + type()"
              >
                {{ title() }}
              </h3>
            </div>
            
            <button
              (click)="onClose()"
              class="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#FFE542] focus:ring-offset-2"
              type="button"
              [attr.aria-label]="'COMMON.CLOSE' | translate"
            >
              <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="p-6">
            <p 
              [id]="descriptionId"
              class="text-gray-700 leading-relaxed"
              [innerHTML]="message()"
            ></p>
          </div>

          <!-- Footer -->
          <div class="flex justify-end gap-3 p-6 border-t border-gray-200">
            @if (showConfirmButton()) {
              <button
                (click)="onConfirm()"
                class="px-6 py-3 bg-[#000] text-white font-medium rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-[#FFE542] focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed border-4 border-transparent"
                [style]="confirmButtonGradient()"
                type="button"
              >
                {{ confirmButtonText() }}
              </button>
            }
            
            <button
              (click)="onClose()"
              class="px-6 py-3 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-all duration-200"
              type="button"
            >
              {{ closeButtonText() }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    @keyframes modalIn {
      from {
        opacity: 0;
        transform: scale(0.95) translateY(-10px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    .animate-modal-in {
      animation: modalIn 0.3s ease-out forwards;
    }
  `]
})
export class Modal {
  private readonly platformId = inject(PLATFORM_ID);

  isOpen = input(false);
  type = input<ModalType>('info');
  title = input.required<string>();
  message = input.required<string>();
  confirmButtonText = input('Confirm');
  closeButtonText = input('Close');
  showConfirmButton = input(false);

  // Outputs
  confirmed = output<void>();
  closed = output<void>();

  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');

  // Élément qui avait le focus avant l'ouverture, pour le restaurer à la fermeture.
  private previouslyFocused: HTMLElement | null = null;

  // Génération d'ID unique pour l'accessibilité
  readonly descriptionId = `modal-description-${Math.random().toString(36).substring(2, 9)}`;

  constructor() {
    // Gestion du focus : on capture le focus à l'ouverture et on le restaure
    // à la fermeture pour ne pas laisser l'utilisateur clavier « derrière » la modale.
    effect(() => {
      if (!isPlatformBrowser(this.platformId)) return;

      if (this.isOpen()) {
        this.previouslyFocused = document.activeElement as HTMLElement;
        // Attendre le rendu du contenu de la modale avant de déplacer le focus.
        requestAnimationFrame(() => this.focusFirstElement());
      } else if (this.previouslyFocused) {
        this.previouslyFocused.focus();
        this.previouslyFocused = null;
      }
    });
  }

  private getFocusable(): HTMLElement[] {
    const host = this.dialog()?.nativeElement;
    if (!host) return [];
    return Array.from(
      host.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter(el => !el.hasAttribute('disabled'));
  }

  private focusFirstElement(): void {
    this.getFocusable()[0]?.focus();
  }

  onTabKey(event: Event): void {
    const kbd = event as KeyboardEvent;
    const focusable = this.getFocusable();
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement;

    if (kbd.shiftKey && active === first) {
      kbd.preventDefault();
      last.focus();
    } else if (!kbd.shiftKey && active === last) {
      kbd.preventDefault();
      first.focus();
    }
  }

  // Computed values
  readonly borderGradient = computed(() => {
    const type = this.type();
    switch (type) {
      case 'success':
        return 'border-green-500/20';
      case 'error':
        return 'border-red-500/20';
      case 'warning':
        return 'border-yellow-500/20';
      default:
        return 'border-blue-500/20';
    }
  });

  readonly iconContainerClass = computed(() => {
    const type = this.type();
    const baseClasses = 'w-12 h-12 rounded-full flex items-center justify-center';

    switch (type) {
      case 'success':
        return `${baseClasses} bg-green-500`;
      case 'error':
        return `${baseClasses} bg-red-500`;
      case 'warning':
        return `${baseClasses} bg-yellow-500`;
      default:
        return `${baseClasses} bg-blue-500`;
    }
  });

  readonly confirmButtonGradient = computed(() => {
    return `
      background: linear-gradient(#000, #000) padding-box,
                  linear-gradient(135deg, #FFE542, #E74C9E) border-box;
    `;
  });

  // Écouteur pour la touche Escape
  @HostListener('document:keydown.escape')
  onEscapePress(): void {
    if (this.isOpen()) {
      this.onClose();
    }
  }

  onConfirm(): void {
    this.confirmed.emit();
    this.onClose();
  }

  onClose(): void {
    this.closed.emit();
  }
}
