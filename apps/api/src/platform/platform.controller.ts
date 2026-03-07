import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/constants';
import { PlatformService, ProvisionTenantResult, TenantDetail, TenantListItem } from './platform.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { SetTenantStatusDto } from './dto/set-tenant-status.dto';
import { CreateTenantAdminDto } from './dto/create-tenant-admin.dto';

@ApiTags('Platform')
@Controller('platform/tenants')
@ApiBearerAuth()
@Roles(Role.GLOBAL_ADMIN)
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Get()
  @ApiOperation({ summary: 'List all tenants (GLOBAL_ADMIN only)' })
  @ApiResponse({ status: 200, description: 'List of tenants' })
  listTenants(): Promise<TenantListItem[]> {
    return this.platformService.listTenants();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tenant by id' })
  @ApiResponse({ status: 200, description: 'Tenant detail' })
  @ApiResponse({ status: 404, description: 'Not found' })
  getTenant(@Param('id') id: string): Promise<TenantDetail> {
    return this.platformService.getTenant(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create tenant (provisioned with defaults + optional initial admin)' })
  @ApiResponse({ status: 201, description: 'Tenant created; includes initialAdmin when provided' })
  @ApiResponse({ status: 409, description: 'Slug already exists' })
  createTenant(@Body() dto: CreateTenantDto): Promise<ProvisionTenantResult> {
    return this.platformService.createTenant(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update tenant' })
  @ApiResponse({ status: 200, description: 'Tenant updated' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiResponse({ status: 409, description: 'Slug already exists' })
  updateTenant(@Param('id') id: string, @Body() dto: UpdateTenantDto): Promise<TenantDetail> {
    return this.platformService.updateTenant(id, dto);
  }

  @Post(':id/set-status')
  @ApiOperation({ summary: 'Set tenant status (ACTIVE | SUSPENDED | DELETED)' })
  @ApiResponse({ status: 200, description: 'Tenant status updated' })
  @ApiResponse({ status: 404, description: 'Not found' })
  setTenantStatus(
    @Param('id') id: string,
    @Body() dto: SetTenantStatusDto,
  ): Promise<TenantDetail> {
    return this.platformService.setTenantStatus(id, dto.status);
  }

  @Post(':id/create-admin')
  @ApiOperation({ summary: 'Create a tenant admin user (sends set-password email)' })
  @ApiResponse({ status: 201, description: 'User created' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiResponse({ status: 409, description: 'Email already exists in tenant' })
  createTenantAdmin(
    @Param('id') id: string,
    @Body() dto: CreateTenantAdminDto,
  ): Promise<{ id: string; email: string; role: string }> {
    return this.platformService.createTenantAdmin(id, dto);
  }
}
