import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Contacts } from './contacts';
import { TEST_PROVIDERS } from '../../../testing/test-providers';

describe('Contacts', () => {
  let component: Contacts;
  let fixture: ComponentFixture<Contacts>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Contacts],
      providers: TEST_PROVIDERS
    })
    .compileComponents();

    fixture = TestBed.createComponent(Contacts);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should build safe contact links', () => {
    expect(component.emailHref(' contact@finstar-cm.com ')).toBe('mailto:contact@finstar-cm.com');
    expect(component.phoneHref('+237 620 724 796')).toBe('tel:+237620724796');
    expect(component.whatsappHref('+237 620 724 796')).toContain('https://wa.me/237620724796?text=');
  });
});
