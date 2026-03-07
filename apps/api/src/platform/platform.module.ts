import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { TenantProvisioningService } from './tenant-provisioning.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [PlatformController],
  providers: [PlatformService, TenantProvisioningService],
  exports: [PlatformService],
})
export class PlatformModule {}
