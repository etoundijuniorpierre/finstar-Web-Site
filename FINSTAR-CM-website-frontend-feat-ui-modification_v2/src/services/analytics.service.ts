import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

type AnalyticsValue = string | number | boolean | null;

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly platformId = inject(PLATFORM_ID);

  track(eventName: string, parameters: Record<string, AnalyticsValue> = {}): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const analyticsWindow = window as Window & {
      goatcounter?: {
        count?: (options: { path: string; title?: string; event: boolean }) => void;
      };
    };

    const destination = typeof parameters['destination'] === 'string'
      ? parameters['destination'].replace(/^\/+/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80)
      : '';
    const eventPath = destination ? `${eventName}/${destination}` : eventName;
    const title = typeof parameters['label'] === 'string' ? parameters['label'] : eventName;

    analyticsWindow.goatcounter?.count?.({
      path: eventPath,
      title,
      event: true
    });
  }
}
