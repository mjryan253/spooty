import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TrackListComponent } from './track-list.component';
import { provideServiceTestbed } from '../../../testing/test-providers';

describe('TrackListComponent', () => {
  let component: TrackListComponent;
  let fixture: ComponentFixture<TrackListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrackListComponent],
      providers: provideServiceTestbed(),
    }).compileComponents();

    fixture = TestBed.createComponent(TrackListComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('playlistId', 1);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
