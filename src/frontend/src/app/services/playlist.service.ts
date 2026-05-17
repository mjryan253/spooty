import { computed, Injectable, Signal, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TrackService } from './track.service';
import { Socket } from 'ngx-socket-io';
import { Playlist } from '../models/playlist';

const ENDPOINT = '/api/playlist';
enum WsPlaylistOperation {
  New = 'playlistNew',
  Update = 'playlistUpdate',
  Delete = 'playlistDelete',
}

export interface PlaylistUi {
  id: number;
  collapsed: boolean;
}

export type PlaylistWithUi = Playlist & PlaylistUi;

export enum PlaylistStatusEnum {
  InProgress,
  Completed,
  Warning,
  Error,
  Subscribed,
}

@Injectable({
  providedIn: 'root',
})
export class PlaylistService {
  private readonly playlists = signal(new Map<number, Playlist>());
  private readonly ui = signal(new Map<number, PlaylistUi>());

  readonly createLoading = signal(false);

  readonly all = computed(() =>
    [...this.playlists().values()]
      .map((p) => ({
        ...p,
        ...(this.ui().get(p.id) ?? { id: p.id, collapsed: false }),
      }))
      .sort((a, b) => this.groupActiveAndSortByCreation(a, b)),
  );

  constructor(
    private readonly http: HttpClient,
    private readonly socket: Socket,
    private readonly trackService: TrackService,
  ) {
    this.initWsConnection();
  }

  getById(id: number): Signal<Playlist | undefined> {
    return computed(() => this.playlists().get(id));
  }

  getTrackCount(id: number): Signal<number> {
    return computed(() => this.trackService.getAllByPlaylist(id)().length);
  }

  getCompletedTrackCount(id: number): Signal<number> {
    return computed(
      () => this.trackService.getCompletedByPlaylist(id)().length,
    );
  }

  getErrorTrackCount(id: number): Signal<number> {
    return computed(() => this.trackService.getErrorByPlaylist(id)().length);
  }

  /** Returns a computed status for this playlist id; store once per component instance. */
  getStatus(id: number): Signal<PlaylistStatusEnum> {
    return computed(() => {
      const playlist = this.playlists().get(id);
      const trackCount = this.getTrackCount(id)();
      const completedCount = this.getCompletedTrackCount(id)();
      const errorCount = this.getErrorTrackCount(id)();

      if (playlist?.error || errorCount === trackCount) {
        return PlaylistStatusEnum.Error;
      }
      if (trackCount === completedCount) {
        return playlist?.active
          ? PlaylistStatusEnum.Subscribed
          : PlaylistStatusEnum.Completed;
      }
      if (errorCount > 1) {
        return PlaylistStatusEnum.Warning;
      }
      return PlaylistStatusEnum.InProgress;
    });
  }

  deleteAllByStatus(status: PlaylistStatusEnum): void {
    for (const item of this.all()) {
      if (this.getStatus(item.id)() === status) {
        void this.deleteAsync(item.id);
      }
    }
  }

  async fetch(): Promise<void> {
    const data = await firstValueFrom(this.http.get<Playlist[]>(ENDPOINT));
    const playlistMap = new Map<number, Playlist>();
    const uiMap = new Map<number, PlaylistUi>();
    for (const item of data) {
      playlistMap.set(item.id, item);
      uiMap.set(item.id, { id: item.id, collapsed: false });
    }
    this.playlists.set(playlistMap);
    this.ui.set(uiMap);
    await Promise.all(data.map((playlist) => this.trackService.fetch(playlist.id)));
  }

  create(spotifyUrl: string): void {
    this.createLoading.set(true);
    firstValueFrom(this.http.post(ENDPOINT, { spotifyUrl }))
      .finally(() => this.createLoading.set(false))
      .catch(() => {});
  }

  toggleCollapsed(id: number): void {
    this.ui.update((m) => {
      const next = new Map(m);
      const current = next.get(id) ?? { id, collapsed: false };
      next.set(id, { ...current, collapsed: !current.collapsed });
      return next;
    });
  }

  delete(id: number): void {
    void this.deleteAsync(id);
  }

  retryFailed(id: number): void {
    firstValueFrom(this.http.get<void>(`${ENDPOINT}/retry/${id}`)).catch(
      () => {},
    );
  }

  rescan(id: number): void {
    firstValueFrom(this.http.get<void>(`${ENDPOINT}/rescan/${id}`)).catch(
      () => {},
    );
  }

  requeueMissing(id: number): void {
    firstValueFrom(
      this.http.get<void>(`${ENDPOINT}/requeue-missing/${id}`),
    ).catch(() => {});
  }

  setActive(id: number, active: boolean): void {
    firstValueFrom(this.http.put<void>(`${ENDPOINT}/${id}`, { active })).catch(
      () => {},
    );
  }

  private async deleteAsync(id: number): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`${ENDPOINT}/${id}`));
  }

  private upsert(playlist: Playlist): void {
    this.playlists.update((m) => {
      const next = new Map(m);
      next.set(playlist.id, playlist);
      return next;
    });
  }

  private remove(id: number): void {
    this.playlists.update((m) => {
      const next = new Map(m);
      next.delete(id);
      return next;
    });
    this.ui.update((m) => {
      const next = new Map(m);
      next.delete(id);
      return next;
    });
  }

  private groupActiveAndSortByCreation(
    a: PlaylistWithUi,
    b: PlaylistWithUi,
  ): number {
    return a.active === b.active
      ? b.createdAt - a.createdAt
      : a.active < b.active
        ? 1
        : -1;
  }

  private initWsConnection(): void {
    this.socket.on(WsPlaylistOperation.Update, (playlist: Playlist) =>
      this.upsert(playlist),
    );
    this.socket.on(WsPlaylistOperation.Delete, ({ id }: { id: number }) =>
      this.remove(Number(id)),
    );
    this.socket.on(WsPlaylistOperation.New, (playlist: Playlist) => {
      this.upsert(playlist);
      this.ui.update((m) => {
        const next = new Map(m);
        next.set(playlist.id, { id: playlist.id, collapsed: false });
        return next;
      });
    });
  }
}
