import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { TrackService } from './track.service';
import { TrackEntity } from './track.entity';
import { SkipDownloadBurstService } from './skip-download-burst.service';
import { delayYoutubeQueueJob } from './yt-queue-delay';

@Processor('track-download-processor')
export class TrackDownloadProcessor extends WorkerHost {
  constructor(
    private readonly trackService: TrackService,
    private readonly skipDownloadBurst: SkipDownloadBurstService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async process(job: Job<TrackEntity, void>): Promise<void> {
    await delayYoutubeQueueJob(this.configService);
    const skippedExisting = await this.trackService.downloadFromYoutube(
      job.data,
    );
    await this.skipDownloadBurst.recordDownloadJobResult(skippedExisting);
  }
}
