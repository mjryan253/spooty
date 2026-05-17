import { Component, computed, input } from '@angular/core';
import { TrackListComponent } from '../track-list/track-list.component';
import {
  PlaylistService,
  PlaylistStatusEnum,
  PlaylistUi,
} from '../../services/playlist.service';
import { Playlist } from '../../models/playlist';

const STATUS2CLASS: Record<PlaylistStatusEnum, string> = {
  [PlaylistStatusEnum.Completed]: 'is-success',
  [PlaylistStatusEnum.InProgress]: 'is-info',
  [PlaylistStatusEnum.Warning]: 'is-warning',
  [PlaylistStatusEnum.Error]: 'is-danger',
  [PlaylistStatusEnum.Subscribed]: 'is-primary',
};

@Component({
  selector: 'app-playlist-box',
  imports: [TrackListComponent],
  templateUrl: './playlist-box.component.html',
  styleUrl: './playlist-box.component.scss',
  standalone: true,
})
export class PlaylistBoxComponent {
  readonly playlist = input.required<Playlist & PlaylistUi>();

  readonly trackCount = computed(() =>
    this.service.getTrackCount(this.playlist().id)(),
  );
  readonly trackCompletedCount = computed(() =>
    this.service.getCompletedTrackCount(this.playlist().id)(),
  );
  readonly statusClass = computed(
    () => STATUS2CLASS[this.service.getStatus(this.playlist().id)()],
  );

  constructor(private readonly service: PlaylistService) {}

  toggleCollapse(playlistId: number): void {
    this.service.toggleCollapsed(playlistId);
  }

  delete(id: number): void {
    this.service.delete(id);
  }

  retryFailed(id: number): void {
    this.service.retryFailed(id);
  }

  rescan(id: number): void {
    this.service.rescan(id);
  }

  requeueMissing(id: number): void {
    this.service.requeueMissing(id);
  }

  toggleActive(id: number, currentActive: boolean): void {
    this.service.setActive(id, !currentActive);
  }
}
