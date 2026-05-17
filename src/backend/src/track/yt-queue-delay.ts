import { ConfigService } from '@nestjs/config';
import { EnvironmentEnum } from '../environmentEnum';

export function getYoutubeQueueDelayMs(configService: ConfigService): number {
  const maxPerMinute = Math.max(
    1,
    parseInt(
      configService.get<string>(EnvironmentEnum.YT_DOWNLOADS_PER_MINUTE) ?? '3',
      10,
    ) || 3,
  );
  return Math.floor(60_000 / maxPerMinute);
}

export async function delayYoutubeQueueJob(
  configService: ConfigService,
): Promise<void> {
  await new Promise((res) =>
    setTimeout(res, getYoutubeQueueDelayMs(configService)),
  );
}
