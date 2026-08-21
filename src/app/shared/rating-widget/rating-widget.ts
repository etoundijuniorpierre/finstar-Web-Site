import { ChangeDetectionStrategy, Component, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { I18nService } from '../../../services/i18n.service';

@Component({
  selector: 'app-rating-widget',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './rating-widget.html',
  styleUrl: './rating-widget.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RatingWidget {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly storageKey = 'finstar.site-rating.v1';

  /**
   * Délai avant de reproposer spontanément le formulaire. Le visiteur peut de
   * toute façon redonner un avis immédiatement via « rateAgain » : l'abus est
   * contenu côté serveur, qui limite le débit par adresse IP.
   */
  private static readonly COOLDOWN_MS = 24 * 60 * 60 * 1000;

  readonly score = signal(0);
  readonly hoverScore = signal(0);
  readonly comment = signal('');
  readonly state = signal<'idle' | 'sending' | 'sent' | 'error'>(
    this.hasRecentVote() ? 'sent' : 'idle',
  );

  private hasRecentVote(): boolean {
    if (!this.isBrowser) return false;
    const stored = Number(localStorage.getItem(this.storageKey));
    if (!stored) return false;
    if (Date.now() - stored < RatingWidget.COOLDOWN_MS) return true;
    localStorage.removeItem(this.storageKey);
    return false;
  }

  /** Redonne la main au visiteur : le remerciement ne doit jamais être un cul-de-sac. */
  rateAgain(): void {
    if (this.isBrowser) localStorage.removeItem(this.storageKey);
    this.score.set(0);
    this.hoverScore.set(0);
    this.comment.set('');
    this.state.set('idle');
  }

  selectScore(value: number): void {
    if (this.state() !== 'idle') return;
    this.score.set(value);
  }

  updateComment(event: Event): void {
    this.comment.set((event.target as HTMLTextAreaElement).value.slice(0, 1000));
  }

  async submit(company = ''): Promise<void> {
    if (!this.isBrowser || this.score() < 1 || this.state() === 'sending') return;
    this.state.set('sending');
    try {
      await firstValueFrom(this.http.post('/api/ratings', {
        score: this.score(), comment: this.comment(), company,
        page: this.router.url, lang: this.i18n.currentLanguage(),
      }));
      localStorage.setItem(this.storageKey, String(Date.now()));
      this.state.set('sent');
    } catch {
      this.state.set('error');
    }
  }
}

