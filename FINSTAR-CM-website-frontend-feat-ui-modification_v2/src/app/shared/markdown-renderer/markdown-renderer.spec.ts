import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MarkdownRenderer } from './markdown-renderer';
import { TEST_PROVIDERS } from '../../../testing/test-providers';

describe('MarkdownRenderer', () => {
  let component: MarkdownRenderer;
  let fixture: ComponentFixture<MarkdownRenderer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarkdownRenderer],
      providers: TEST_PROVIDERS
    })
    .compileComponents();

    fixture = TestBed.createComponent(MarkdownRenderer);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
