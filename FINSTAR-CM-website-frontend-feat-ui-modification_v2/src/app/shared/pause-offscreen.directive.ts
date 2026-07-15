import {
  Directive,
  ElementRef,
  inject,
  PLATFORM_ID,
  afterNextRender,
  DestroyRef,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/*Met en pause les animations CSS d'un élément lorsqu'il sort du viewport.*/
@Directive({
  selector: '[appPauseOffscreen]',
  standalone: true,
})
export class PauseOffscreenDirective {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;

    afterNextRender(() => {
      const host = this.el.nativeElement;

      // Vieux navigateur sans l'API : on ne fait rien, l'animation continue.
      if (typeof IntersectionObserver === 'undefined') return;

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            host.classList.toggle('paused-offscreen', !entry.isIntersecting);
          }
        },
        { threshold: 0 },
      );

      observer.observe(host);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
