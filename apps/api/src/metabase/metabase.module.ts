import { Module } from '@nestjs/common';
import { MetabaseController } from './metabase.controller';

@Module({
  controllers: [MetabaseController],
})
export class MetabaseModule {}
