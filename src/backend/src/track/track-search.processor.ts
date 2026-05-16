import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { TrackService } from './track.service';
import { TrackEntity } from './track.entity';
import { delayYoutubeQueueJob } from './yt-queue-delay';

@Processor('track-search-processor')
export class TrackSearchProcessor extends WorkerHost {
  constructor(
    private readonly trackService: TrackService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async process(job: Job<TrackEntity, void, string>): Promise<void> {
    await delayYoutubeQueueJob(this.configService);
    await this.trackService.findOnYoutube(job.data);
  }
}
