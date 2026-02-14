import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [ActivityModule],
  controllers: [UploadController],
})
export class UploadModule {}
