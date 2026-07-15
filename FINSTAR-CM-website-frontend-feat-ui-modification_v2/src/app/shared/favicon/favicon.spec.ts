import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Favicon } from './favicon';
import { TEST_PROVIDERS } from '../../../testing/test-providers';

describe('Favicon', () => {
  let component: Favicon;
  let fixture: ComponentFixture<Favicon>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Favicon],
      providers: TEST_PROVIDERS
    })
    .compileComponents();

    fixture = TestBed.createComponent(Favicon);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
