import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CareerCandidature } from './career-candidature';
import { TEST_PROVIDERS } from '../../testing/test-providers';

describe('CareerCandidature', () => {
  let component: CareerCandidature;
  let fixture: ComponentFixture<CareerCandidature>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CareerCandidature],
      providers: TEST_PROVIDERS
    })
    .compileComponents();

    fixture = TestBed.createComponent(CareerCandidature);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
