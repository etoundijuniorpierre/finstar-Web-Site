import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccountCard } from './account-card';
import { TEST_PROVIDERS } from '../../../testing/test-providers';

describe('AccountCard', () => {
  let component: AccountCard;
  let fixture: ComponentFixture<AccountCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountCard],
      providers: TEST_PROVIDERS
    })
    .compileComponents();

    fixture = TestBed.createComponent(AccountCard);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('accountName', 'Compte test');
    fixture.componentRef.setInput('description', 'Description test');
    fixture.componentRef.setInput('openingAmount', 5000);
    fixture.componentRef.setInput('maintenanceFee', 500);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
