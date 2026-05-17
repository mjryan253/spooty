import { Component, computed, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { PlaylistService, PlaylistStatusEnum } from './services/playlist.service';
import { PlaylistBoxComponent } from './components/playlist-box/playlist-box.component';
import { VersionService } from './services/version.service';

@Component({
  selector: 'app-root',
  imports: [FormsModule, PlaylistBoxComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  standalone: true,
})
export class AppComponent implements OnInit {
  url = '';
  readonly spotifyLinked = signal<boolean | null>(null);
  readonly spotifyBanner = signal<string | null>(null);
  private readonly spotifyUrlPattern =
    /^https:\/\/open\.spotify\.com\/(track|playlist|album|artist)\/[a-zA-Z0-9]+/;

  get isValidSpotifyUrl(): boolean {
    return this.spotifyUrlPattern.test(this.url);
  }

  readonly createLoading = this.playlistService.createLoading;
  readonly playlists = computed(() =>
    this.playlistService.all().filter((item) => !item.isTrack),
  );
  readonly songs = computed(() =>
    this.playlistService.all().filter((item) => item.isTrack),
  );
  readonly version = this.versionService.getVersion();

  constructor(
    private readonly playlistService: PlaylistService,
    private readonly versionService: VersionService,
    private readonly http: HttpClient,
  ) {
    void this.fetchPlaylists();
  }

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('spotify_connected') === '1') {
        this.spotifyBanner.set(
          'Spotify account connected. Full playlist Web API access is enabled.',
        );
        window.history.replaceState({}, '', window.location.pathname);
      }
      const err = params.get('spotify_error');
      if (err) {
        this.spotifyBanner.set(`Spotify login error: ${err}`);
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
    void this.loadSpotifyStatus();
  }

  private async loadSpotifyStatus(): Promise<void> {
    try {
      const s = await firstValueFrom(
        this.http.get<{ linked: boolean }>('/api/auth/spotify/status'),
      );
      this.spotifyLinked.set(s.linked);
    } catch {
      this.spotifyLinked.set(null);
    }
  }

  fetchPlaylists(): void {
    void this.playlistService.fetch();
  }

  download(): void {
    if (this.url) {
      this.playlistService.create(this.url);
    }
    this.url = '';
  }

  deleteCompleted(): void {
    this.playlistService.deleteAllByStatus(PlaylistStatusEnum.Completed);
  }

  deleteFailed(): void {
    this.playlistService.deleteAllByStatus(PlaylistStatusEnum.Error);
  }
}
