import { computed, Injectable, Signal, signal } from '@angular/core';
import { Socket } from 'ngx-socket-io';
import { firstValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { Track, TrackStatusEnum } from '../models/track';

const ENDPOINT = '/api/track';
enum WsTrackOperation {
  New = 'trackNew',
  Update = 'trackUpdate',
  Delete = 'trackDelete',
}

@Injectable({
  providedIn: 'root',
})
export class TrackService {
  private readonly tracks = signal(new Map<number, Track>());

  constructor(
    private readonly http: HttpClient,
    private readonly socket: Socket,
  ) {
    this.initWsConnection();
  }

  getAllByPlaylist(playlistId: number, status?: TrackStatusEnum): Signal<Track[]> {
    return computed(() => {
      const tracks = this.tracks();
      return [...tracks.values()].filter(
        (t) =>
          t.playlistId === playlistId &&
          (status === undefined || t.status === status),
      );
    });
  }

  getCompletedByPlaylist(playlistId: number): Signal<Track[]> {
    return this.getAllByPlaylist(playlistId, TrackStatusEnum.Completed);
  }

  getErrorByPlaylist(playlistId: number): Signal<Track[]> {
    return this.getAllByPlaylist(playlistId, TrackStatusEnum.Error);
  }

  async fetch(playlistId: number): Promise<void> {
    const data = await firstValueFrom(
      this.http.get<Track[]>(`${ENDPOINT}/playlist/${playlistId}`),
    );
    this.upsertMany(data.map((track) => ({ ...track, playlistId })));
  }

  delete(id: number): void {
    firstValueFrom(this.http.delete(`${ENDPOINT}/${id}`)).catch(() => {});
  }

  retry(id: number): void {
    firstValueFrom(this.http.get(`${ENDPOINT}/retry/${id}`)).catch(() => {});
  }

  private upsert(track: Track): void {
    this.tracks.update((m) => {
      const next = new Map(m);
      next.set(track.id, track);
      return next;
    });
  }

  private upsertMany(tracks: Track[]): void {
    this.tracks.update((m) => {
      const next = new Map(m);
      for (const track of tracks) {
        next.set(track.id, track);
      }
      return next;
    });
  }

  private remove(id: number): void {
    this.tracks.update((m) => {
      const next = new Map(m);
      next.delete(id);
      return next;
    });
  }

  private initWsConnection(): void {
    this.socket.on(WsTrackOperation.Update, (track: Track) => this.upsert(track));
    this.socket.on(WsTrackOperation.Delete, ({ id }: { id: number }) =>
      this.remove(Number(id)),
    );
    this.socket.on(
      WsTrackOperation.New,
      ({ track, playlistId }: { track: Track; playlistId: number }) =>
        this.upsert({ ...track, playlistId }),
    );
  }
}
