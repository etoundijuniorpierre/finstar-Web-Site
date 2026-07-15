import { Component, inject, OnDestroy, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-favicon',
  imports: [],
  template: ``,
  styles: ``
})
export class Favicon implements OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly linkElement: HTMLLinkElement | null = null;

  constructor() {
    // Only manipulate DOM in browser environment
    if (isPlatformBrowser(this.platformId)) {
      // Find existing favicon or create new one
      const existingLink = document.querySelector("link[rel*='icon']:not([sizes])") as HTMLLinkElement;
      if (existingLink) {
        this.linkElement = existingLink;
      } else {
        this.linkElement = document.createElement('link');
        this.linkElement.type = 'image/x-icon';
        this.linkElement.rel = 'icon';
        document.head.appendChild(this.linkElement);
      }

      // Always use the static favicon served from /favicon.ico
      if (this.linkElement) {
        this.linkElement.href = '/favicon.ico';
      }
    }
  }

  ngOnDestroy() {
    // Clean up only if we created the element
    if (isPlatformBrowser(this.platformId) && this.linkElement && !this.linkElement.parentElement) {
      this.linkElement.remove();
    }
  }
}