import {
  Component,
  input,
  ChangeDetectionStrategy,
  Output,
  EventEmitter
} from '@angular/core';

import { CtaButton } from '../cta-button/cta-button';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-account-card',
  imports: [CtaButton, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
 <div 
      class="account-card"
      (mouseenter)="handleMouseEnter()"
      (mouseleave)="handleMouseLeave()"
    >
      <div class="border-gradient">
        <div class="content">
          <h2 class="account-name">{{ accountName() }}</h2>
          <p class="description">{{ description() }}</p>
          
          <div class="divider"></div>
          
          <div class="account-details">
            <div class="detail-item">
              <span class="detail-label">{{ 'ACCOUNT_CARD.OPENING' | translate }}</span>
              <span class="detail-value">{{ openingAmount() }} {{ 'COMMON.CURRENCY' | translate }}</span>
            </div>
            
            <div class="vertical-divider"></div>
            
            <div class="detail-item">
              <span class="detail-label">{{ 'ACCOUNT_CARD.MAINTENANCE' | translate }}</span>
              <span class="detail-value">{{ maintenanceFee() }} {{ 'COMMON.CURRENCY' | translate }}</span>
            </div>
          </div>
          
          <div class="divider"></div>
          
          <div class="cta-container">
            <app-cta-button 
              [label]="ctaLabel() | translate" 
              [link]="ctaLink()"
              [disableRouting]="disableRouting()"
              size="sm"
              (click)="handleCtaClick($event)"
            ></app-cta-button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: `
      .account-card {
      width: 100%;
      max-width: 542px;
    }
    
    .border-gradient {
      background: linear-gradient(to right, #E74C9E, #FFE542);
      border-radius: 8px;
      padding: 3px;
    }
    
    .content {
      background: white;
      border-radius: 6px;
      padding: 40px 56px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    
    .account-name {
      font-family: var(--font-sans);
      font-weight: 700;
      font-size: 32px;
      line-height: 120%;
      text-align: center;
      margin: 0;
    }
    
    .description {
      font-family: var(--font-sans);
      font-weight: 400;
      font-size: 14px;
      line-height: 165%;
      text-align: center;
      color: #555;
      margin: 0;
    }
    
    .divider {
      height: 1px;
      background-color: #ECEAE3;
      width: 100%;
    }
    
    .account-details {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .detail-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    
    .vertical-divider {
      width: 1px;
      height: 40px;
      background-color: #ECEAE3;
    }
    
    .detail-label {
      font-family: var(--font-sans);
      font-weight: 500;
      font-size: 14px;
      line-height: 120%;
      text-align: center;
    }
    
    .detail-value {
      font-family: var(--font-sans);
      font-weight: 700;
      font-size: 24px;
      line-height: 120%;
      text-align: center;
      margin-top: 4px;
    }
    
    .cta-container {
      width: 100%;
      display: flex;
      justify-content: center;
    }
    
    /* Responsive */
    @media (max-width: 900px) {
      .account-card {
        width: 100% !important;
        max-width: 100% !important;
      }
      
      .border-gradient {
        width: 100%;
      }
    }
    
    @media (max-width: 768px) {
      .content {
        padding: 24px 20px;
      }
      
      .account-name {
        font-size: 24px;
      }
      
      .detail-label {
        font-size: 12px;
      }
      
      .detail-value {
        font-size: 20px;
      }
    }
    
    @media (max-width: 480px) {
      .content {
        padding: 20px 16px;
      }
      
      .account-name {
        font-size: 22px;
      }
      
      .description {
        font-size: 13px;
      }
    }
    
    @media (max-width: 375px) {
      .content {
        padding: 24px 16px;
        gap: 16px;
      }
      
      .account-name {
        font-size: 22px;
      }
      
      .description {
        font-size: 13px;
      }
      
      .detail-label {
        font-size: 11px;
      }
      
      .detail-value {
        font-size: 18px;
      }
      
      .account-details {
        gap: 12px;
      }
      
      .vertical-divider {
        height: 32px;
      }
    }
  `
})
export class AccountCard {

  // Inputs
  accountName = input.required<string>();
  description = input.required<string>();
  openingAmount = input.required<number>();
  maintenanceFee = input.required<number>();
  hoverImage = input<string | null>(null);
  ctaLabel = input('COMMON.OPEN_ACCOUNT');
  ctaLink = input('/services');
  disableRouting = input(false);

  // Outputs
  @Output() hovered = new EventEmitter<string | null>();
  @Output() ctaClick = new EventEmitter<void>();

  // Gestion des événements
  handleMouseEnter() {
    const image = this.hoverImage();
    if (image) {
      this.hovered.emit(image);
    }
  }

  handleMouseLeave() {
    this.hovered.emit(null);
  }

  handleCtaClick(event: MouseEvent) {
    event.preventDefault();
    this.ctaClick.emit();
  }

}
