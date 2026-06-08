import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as fs from 'fs';
import { resolve } from 'path';
import { EnvironmentEnum } from './environmentEnum';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  await app.listen(process.env.PORT || 3000);
}
bootstrap();

if (!process.env[EnvironmentEnum.DOWNLOADS_PATH]) {
  throw new Error('DOWNLOADS_PATH environment variable is missing');
}
const folderName = resolve(
  __dirname,
  process.env[EnvironmentEnum.DOWNLOADS_PATH],
);
if (!fs.existsSync(folderName)) {
  fs.mkdirSync(folderName);
}
