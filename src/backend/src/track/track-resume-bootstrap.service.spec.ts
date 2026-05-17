import { Test, TestingModule } from '@nestjs/testing';
import { TrackResumeBootstrapService } from './track-resume-bootstrap.service';
import { TrackService } from './track.service';

describe('TrackResumeBootstrapService', () => {
  it('calls resumeStuckTracks on application bootstrap', async () => {
    const trackService = {
      resumeStuckTracks: jest.fn().mockResolvedValue(undefined),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrackResumeBootstrapService,
        { provide: TrackService, useValue: trackService },
      ],
    }).compile();

    const bootstrap = module.get(TrackResumeBootstrapService);
    await bootstrap.onApplicationBootstrap();

    expect(trackService.resumeStuckTracks).toHaveBeenCalledTimes(1);
  });
});
