import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, IsString, IsUrl, MaxLength, MinLength, ValidateIf, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TenantStatus } from '@crm/db';
import { InitialAdminDto } from './initial-admin.dto';

export class CreateTenantDto {
  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'acme-corp', description: 'Unique URL-safe slug (lowercase, hyphens)' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  slug: string;

  @ApiPropertyOptional({ example: 'Acme Corporation' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  displayName?: string;

  @ApiPropertyOptional({ enum: TenantStatus, default: TenantStatus.ACTIVE })
  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus;

  @ApiPropertyOptional({ description: 'Full URL (https://...) or relative path (e.g. /tenants/acme/logo.svg)' })
  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '' && !String(v).startsWith('/'))
  @IsUrl()
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Full URL (https://...) or relative path (e.g. /tenants/acme/favicon.svg)' })
  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '' && !String(v).startsWith('/'))
  @IsUrl()
  faviconUrl?: string;

  @ApiPropertyOptional({ example: '#1976d2' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  primaryColor?: string;

  @ApiPropertyOptional({ example: '#ff9800' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  accentColor?: string;

  @ApiPropertyOptional({ example: 'light', description: 'light | dark | system' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  themeMode?: string;

  @ApiPropertyOptional({ description: 'JSON settings object (merged with provisioning defaults)' })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Create first tenant admin as part of provisioning' })
  @IsOptional()
  @ValidateNested()
  @Type(() => InitialAdminDto)
  initialAdmin?: InitialAdminDto;
}
