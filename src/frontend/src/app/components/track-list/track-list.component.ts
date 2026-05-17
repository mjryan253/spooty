import { Component, computed, input } from '@angular/core';
import { TrackService } from '../../services/track.service';
import { TrackStatusEnum } from '../../models/track';

@Component({
  selector: 'app-track-list',
  imports: [],
  templateUrl: './track-list.component.html',
  styleUrl: './track-list.component.scss',
  standalone: true,
})
export class TrackListComponent {
  readonly playlistId = input.required<number>();
  readonly tracks = computed(() =>
    this.service.getAllByPlaylist(this.playlistId())(),
  );
  readonly trackStatuses = TrackStatusEnum;

  constructor(private readonly service: TrackService) {}

  delete(id: number): void {
    this.service.delete(id);
  }

  retry(id: number): void {
    this.service.retry(id);
  }
}
