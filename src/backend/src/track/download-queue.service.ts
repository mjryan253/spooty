import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentEnum } from '../environmentEnum';

/**
 * Minimal in-process job queue replacing BullMQ/Redis. Runs jobs with a bounded
 * concurrency and paces job starts to at most YT_DOWNLOADS_PER_MINUTE.
 */
@Injectable()
export class DownloadQueueService {
  private readonly logger = new Logger(DownloadQueueService.name);
  private readonly queue: Array<() => Promise<void>> = [];
  private readonly concurrency: number;
  private readonly intervalMs: number;
  private active = 0;
  private nextStart = 0;

  constructor(private readonly configService: ConfigService) {
    this.concurrency = Math.max(
      1,
      Number(
        this.configService.get<string>(EnvironmentEnum.DOWNLOAD_CONCURRENCY),
      ) || 1,
    );
    const perMinute = Math.max(
      1,
      Number(this.configService.get<string>('YT_DOWNLOADS_PER_MINUTE')) || 3,
    );
    this.intervalMs = Math.floor(60000 / perMinute);
  }

  enqueue(job: () => Promise<void>): void {
    this.queue.push(job);
    this.pump();
  }

  private pump(): void {
    while (this.active < this.concurrency && this.queue.length > 0) {
      const job = this.queue.shift()!;
      this.active += 1;
      void this.run(job).finally(() => {
        this.active -= 1;
        this.pump();
      });
    }
  }

  private async run(job: () => Promise<void>): Promise<void> {
    const now = Date.now();
    const wait = Math.max(0, this.nextStart - now);
    this.nextStart = Math.max(now, this.nextStart) + this.intervalMs;
    if (wait > 0) {
      await new Promise((res) => setTimeout(res, wait));
    }
    try {
      await job();
    } catch (err) {
      this.logger.error(err);
    }
  }
}
