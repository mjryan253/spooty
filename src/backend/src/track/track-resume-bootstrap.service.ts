import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { TrackService } from './track.service';

@Injectable()
export class TrackResumeBootstrapService implements OnApplicationBootstrap {
  constructor(private readonly trackService: TrackService) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.trackService.resumeStuckTracks();
  }
}
