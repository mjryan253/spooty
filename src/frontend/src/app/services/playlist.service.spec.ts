import { TestBed } from '@angular/core/testing';
import { PlaylistService } from './playlist.service';
import { provideServiceTestbed } from '../../testing/test-providers';

describe('PlaylistService', () => {
  let service: PlaylistService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: provideServiceTestbed(),
    });
    service = TestBed.inject(PlaylistService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
