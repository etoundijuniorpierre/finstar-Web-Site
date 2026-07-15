import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CtaButton } from './cta-button';
import { TEST_PROVIDERS } from '../../../testing/test-providers';

describe('CtaButton', () => {
  let component: CtaButton;
  let fixture: ComponentFixture<CtaButton>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CtaButton],
      providers: TEST_PROVIDERS
    })
    .compileComponents();

    fixture = TestBed.createComponent(CtaButton);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
