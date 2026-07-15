import { ChangeDetectionStrategy, Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DirectusSdkService } from '../../../services/directus.sdk.service';
import { SeoService } from '../../../services/seo.service';
import { environment } from '../../../environments/environment';

type OperationalDataState = 'loading' | 'ready' | 'unavailable';
type TrafficState = 'loading' | 'ready' | 'unavailable' | 'unconfigured';

interface TrafficRow {
  path?: string;
  title?: string;
  name?: string;
  visits: number;
}

interface TrafficPoint {
  day: string;
  visits: number;
}

interface TrafficResponse {
  configured: boolean;
  available?: boolean;
  mock?: boolean;
  start?: string;
  end?: string;
  days?: number | null;
  visits?: number | null;
  events?: number | null;
  series?: TrafficPoint[];
  topPages?: TrafficRow[];
  topRefs?: TrafficRow[];
  locations?: TrafficRow[];
  browsers?: TrafficRow[];
  systems?: TrafficRow[];
  sizes?: TrafficRow[];
}

@Component({
  selector: 'app-metrics',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './metrics.html',
  styleUrl: './metrics.scss'
})
export class Metrics implements OnInit {
  private readonly directusSdk = inject(DirectusSdkService);
  private readonly seoService = inject(SeoService);
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly fb = inject(FormBuilder);
  private readonly authStorageKey = 'finstar.metrics.authenticated';

  /**
   * GoatCounter is a free, privacy-first hosted service for reasonable
   * public usage. Its API can later power this page without exposing a token
   * in the browser.
   */
  readonly analyticsProvider = 'GoatCounter';
  readonly analyticsSiteCode = environment.goatCounterCode ?? '';
  readonly analyticsDashboardUrl = this.analyticsSiteCode
    ? `https://${this.analyticsSiteCode}.goatcounter.com/`
    : '';
  readonly analyticsConfigured = computed(() => Boolean(this.analyticsSiteCode));

  readonly candidaturesCount = signal<number | null>(null);
  readonly contactsCount = signal<number | null>(null);
  readonly operationalDataState = signal<OperationalDataState>('loading');
  readonly isAuthenticated = signal(false);
  readonly loginState = signal<'idle' | 'loading' | 'error'>('idle');
  readonly loginForm = this.fb.nonNullable.group({
    userName: ['', [Validators.required]],
    password: ['', [Validators.required]]
  });
  readonly showPassword = signal(false);

  // Trafic GoatCounter, servi par le proxy SSR /api/metrics/traffic (token côté serveur).
  readonly traffic = signal<TrafficResponse | null>(null);
  readonly trafficState = signal<TrafficState>('loading');

  // Presets alignés sur le tableau de bord GoatCounter : jour, semaine, mois,
  // trimestre, semestre, année — complétés par une plage personnalisée libre.
  readonly periodOptions = [1, 7, 30, 90, 180, 365] as const;
  readonly selectedDays = signal<number>(30);
  readonly customRange = signal<{ start: string; end: string } | null>(null);

  /** Géométrie du graphe : évolution des visites du site. */
  readonly chart = computed(() => {
    const sourceSeries = this.traffic()?.series ?? [];
    if (sourceSeries.length === 0) return null;

    const custom = this.customRange();
    const rangeDays = custom
      ? Math.max(1, Math.round((Date.parse(`${custom.end}T00:00:00Z`) - Date.parse(`${custom.start}T00:00:00Z`)) / 86_400_000) + 1)
      : this.selectedDays();

    let series = sourceSeries;
    if (rangeDays > 60) {
      const monthly = new Map<string, TrafficPoint>();
      for (const point of sourceSeries) {
        const month = point.day.slice(0, 7);
        const bucket = monthly.get(month) ?? { day: `${month}-01`, visits: 0 };
        bucket.visits += point.visits;
        monthly.set(month, bucket);
      }
      series = Array.from(monthly.values());
    } else if (rangeDays > 30) {
      const firstDay = Date.parse(`${sourceSeries[0].day.slice(0, 10)}T00:00:00Z`);
      const weekly = new Map<string, TrafficPoint>();
      for (const point of sourceSeries) {
        const day = Date.parse(`${point.day.slice(0, 10)}T00:00:00Z`);
        const offset = Math.max(0, Math.floor((day - firstDay) / 86_400_000));
        const bucketDay = new Date(firstDay + Math.floor(offset / 7) * 7 * 86_400_000).toISOString().slice(0, 10);
        const bucket = weekly.get(bucketDay) ?? { day: bucketDay, visits: 0 };
        bucket.visits += point.visits;
        weekly.set(bucketDay, bucket);
      }
      series = Array.from(weekly.values());
    }

    const width = 760;
    const height = 260;
    const padTop = 22;
    const padBottom = 46;
    const padLeft = 52;
    const padRight = 18;
    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    const maxVisits = Math.max(1, ...series.map(point => point.visits));

    // Y-axis: 5 ticks nicely rounded
    const niceMax = Math.ceil(maxVisits / 5) * 5 || 5;
    const yTicks: { y: string; label: string }[] = [];
    for (let i = 0; i <= 4; i++) {
      const val = Math.round((niceMax / 4) * i);
      const y = (padTop + chartH * (1 - val / niceMax)).toFixed(1);
      yTicks.push({ y, label: val >= 1000 ? `${(val / 1000).toFixed(1)}k` : String(val) });
    }

    // Gridlines (horizontal)
    const gridLines = yTicks.map(t => ({
      y: t.y,
      x1: String(padLeft),
      x2: String(width - padRight)
    }));

    const barSlot = chartW / series.length;

    const toY = (val: number) => padTop + chartH * (1 - val / niceMax);

    // Visits area and line
    const lineVisits = `M${series.map((p, i) => {
      const cx = padLeft + barSlot * i + barSlot / 2;
      return `${cx.toFixed(1)},${toY(p.visits).toFixed(1)}`;
    }).join(' L')}`;

    const areaVisits = `${lineVisits} L${(padLeft + barSlot * (series.length - 1) + barSlot / 2).toFixed(1)},${(padTop + chartH).toFixed(1)} L${(padLeft + barSlot / 2).toFixed(1)},${(padTop + chartH).toFixed(1)} Z`;

    const hoverBars = series.map((p, i) => {
      const cx = padLeft + barSlot * i + barSlot / 2;
      return {
        x: cx,
        w: barSlot,
        visits: p.visits,
        cx: cx.toFixed(1),
        y: toY(p.visits)
      };
    });

    // X-axis labels
    const formatLabel = (dateStr: string): string => {
      if (!dateStr) return '';
      if (dateStr.includes('T')) {
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? dateStr : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;

      if (rangeDays === 1) {
        return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
      }
      
      // Si la série est petite (agrégation mensuelle), on affiche Mois + Année
      if (rangeDays > 60 || series.length <= 12) {
        return d.toLocaleDateString([], { month: 'short', year: 'numeric' });
      }
      return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
    };

    const maxXLabels = series.length <= 12 ? series.length : 8;
    const xLabels: { x: string; text: string }[] = [];
    if (maxXLabels > 0) {
      for (let i = 0; i < maxXLabels; i++) {
        const idx = Math.floor(i * (series.length - 1) / Math.max(1, maxXLabels - 1));
        const cx = padLeft + barSlot * idx + barSlot / 2;
        xLabels.push({ x: cx.toFixed(1), text: formatLabel(series[idx].day) });
      }
    }

    // Points with tooltip data
    const points = hoverBars.map((b, i) => ({
      ...b,
      label: formatLabel(series[i].day)
    }));

    return {
      width,
      height,
      padTop,
      padBottom,
      padLeft,
      padRight,
      chartH,
      niceMax,
      lineVisits,
      areaVisits,
      hoverBars,
      yTicks,
      gridLines,
      xLabels,
      points,
      totalVisits: this.traffic()?.visits ?? series.reduce((sum, point) => sum + point.visits, 0),
    };
  });

  onPointHover(pt: any, index: number, event: MouseEvent): void {
    const chart = this.chart();
    if (!chart) return;
    const point = chart.points[index];
    if (!point) return;

    let left = 0;
    let top = 0;
    const svg = (event.target as Element).closest('svg');
    if (svg) {
      const rect = svg.getBoundingClientRect();
      left = event.clientX - rect.left;
      top = event.clientY - rect.top;
    }

    this.activeTooltip.set({
      x: left,
      y: top,
      label: point.label,
      visits: point.visits
    });
  }

  onPointLeave(): void {
    this.activeTooltip.set(null);
  }

  ngOnInit(): void {
    this.seoService.updatePageSeo('METRICS');

    if (isPlatformBrowser(this.platformId)) {
      const token = window.sessionStorage.getItem(this.authStorageKey);
      if (token) {
        // Valider le token avec le backend
        this.http.post<{ valid: boolean }>('/api/admin/verify', { token }).subscribe({
          next: (res) => {
            if (res.valid) {
              this.isAuthenticated.set(true);
              void this.refreshOperationalStats();
              void this.refreshTraffic();
            } else {
              window.sessionStorage.removeItem(this.authStorageKey);
              this.isAuthenticated.set(false);
              this.operationalDataState.set('unavailable');
              this.trafficState.set('unavailable');
            }
          },
          error: () => {
            window.sessionStorage.removeItem(this.authStorageKey);
            this.isAuthenticated.set(false);
            this.operationalDataState.set('unavailable');
            this.trafficState.set('unavailable');
          }
        });
      } else {
        this.isAuthenticated.set(false);
        this.operationalDataState.set('unavailable');
        this.trafficState.set('unavailable');
      }
    }
  }

  async login(): Promise<void> {
    if (this.loginForm.invalid || this.loginState() === 'loading') {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loginState.set('loading');
    const { userName, password } = this.loginForm.getRawValue();

    try {
      const response = await firstValueFrom(
        this.http.post<{ authenticated: boolean, token?: string }>('/api/admin/login', {
          userName,
          password
        })
      );

      if (!response.authenticated || !response.token) {
        throw new Error('Invalid AdminConnexion credentials');
      }

      window.sessionStorage.setItem(this.authStorageKey, response.token);
      this.isAuthenticated.set(true);
      this.loginState.set('idle');
      this.loginForm.reset();

      // On lance les requêtes en asynchrone sans bloquer l'UI
      void this.refreshOperationalStats();
      void this.refreshTraffic();
    } catch (error) {
      console.warn('[Metrics] Connexion admin refusée.', error);
      this.loginState.set('error');
      this.loginForm.controls.password.reset();
    }
  }

  togglePassword(): void {
    this.showPassword.update(v => !v);
  }

  setPeriod(days: number): void {
    if (this.selectedDays() === days && !this.customRange()) return;
    this.customRange.set(null);
    this.selectedDays.set(days);
    void this.refreshTraffic();
  }

  applyCustomRange(start: string, end: string): void {
    if (!start || !end || start > end) return;
    this.customRange.set({ start, end });
    void this.refreshTraffic();
  }

  async refreshTraffic(): Promise<void> {
    if (!this.isAuthenticated()) return;

    this.trafficState.set('loading');
    try {
      const range = this.customRange();
      const query = range
        ? `start=${range.start}&end=${range.end}`
        : `days=${this.selectedDays()}`;
      
      const token = window.sessionStorage.getItem(this.authStorageKey) || '';
      const data = await firstValueFrom(
        this.http.get<TrafficResponse>(`/api/metrics/traffic?${query}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      );

      if (!data || !data.configured) {
        this.trafficState.set('unconfigured');
        this.traffic.set(null);
        return;
      }
      if (data.available === false) {
        this.trafficState.set('unavailable');
        this.traffic.set(null);
        return;
      }
      this.traffic.set(data);
      this.trafficState.set('ready');
    } catch (error) {
      console.warn('[Metrics] Trafic indisponible.', error);
      this.trafficState.set('unavailable');
      this.traffic.set(null);
    }
  }

  readonly activeTooltip = signal<{
    x: number;
    y: number;
    label: string;
    visits: number;
  } | null>(null);

  /**
   * The traffic signal now also contains top pages and referrers
   */
  async refreshOperationalStats(): Promise<void> {
    if (!this.isAuthenticated()) return;

    this.operationalDataState.set('loading');

    try {
      const counts = await this.directusSdk.getOperationalCounts();

      this.candidaturesCount.set(counts.candidatures);
      this.contactsCount.set(counts.contacts);
      this.operationalDataState.set('ready');
    } catch (error) {
      console.warn('[Metrics] Données opérationnelles indisponibles.', error);
      this.candidaturesCount.set(null);
      this.contactsCount.set(null);
      this.operationalDataState.set('unavailable');
    }
  }

  exportReport(): void {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }
}
