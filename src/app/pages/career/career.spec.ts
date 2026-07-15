import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Career } from './career';
import { TEST_PROVIDERS } from '../../../testing/test-providers';

describe('Career', () => {
  let component: Career;
  let fixture: ComponentFixture<Career>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Career],
      providers: TEST_PROVIDERS
    })
    .compileComponents();

    fixture = TestBed.createComponent(Career);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should navigate job tabs with the keyboard', () => {
    (component as any).jobsData = () => [{ title: 'A' }, { title: 'B' }, { title: 'C' }];
    const focus = jasmine.createSpy('focus');
    const event = {
      key: 'ArrowRight',
      preventDefault: jasmine.createSpy('preventDefault'),
      currentTarget: {
        parentElement: {
          querySelector: () => ({ focus })
        }
      }
    } as unknown as KeyboardEvent;

    component.onJobKeydown(event, 0);

    expect(component.selectedJobIndex).toBe(1);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
  });
});
