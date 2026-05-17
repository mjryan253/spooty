import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlaylistBoxComponent } from './playlist-box.component';
import { provideServiceTestbed } from '../../../testing/test-providers';
import { Playlist } from '../../models/playlist';

describe('PlaylistBoxComponent', () => {
  let component: PlaylistBoxComponent;
  let fixture: ComponentFixture<PlaylistBoxComponent>;

  const mockPlaylist: Playlist & { collapsed: boolean } = {
    id: 1,
    name: 'Test Playlist',
    spotifyUrl: 'https://open.spotify.com/playlist/abc123',
    active: false,
    isTrack: false,
    createdAt: Date.now(),
    collapsed: false,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlaylistBoxComponent],
      providers: provideServiceTestbed(),
    }).compileComponents();

    fixture = TestBed.createComponent(PlaylistBoxComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('playlist', mockPlaylist);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
