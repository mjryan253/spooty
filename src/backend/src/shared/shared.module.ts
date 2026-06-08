import { Module } from '@nestjs/common';
import { UtilsService } from './utils.service';
import { ConfigModule } from '@nestjs/config';
import { SpotifyService } from './spotify.service';
import { SpotdlService } from './spotdl.service';
import { SpotifyApiService } from './spotify-api.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ConfigModule, AuthModule],
  providers: [UtilsService, SpotifyService, SpotdlService, SpotifyApiService],
  controllers: [],
  exports: [UtilsService, SpotifyService, SpotdlService, SpotifyApiService],
})
export class SharedModule {}
