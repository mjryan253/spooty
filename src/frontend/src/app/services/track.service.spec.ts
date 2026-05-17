import { TestBed } from '@angular/core/testing';
import { TrackService } from './track.service';
import { provideServiceTestbed } from '../../testing/test-providers';

describe('TrackService', () => {
  let service: TrackService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: provideServiceTestbed(),
    });
    service = TestBed.inject(TrackService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
