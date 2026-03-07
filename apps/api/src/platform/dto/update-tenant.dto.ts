import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, IsString, IsUrl, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { TenantStatus } from '@crm/db';

export class UpdateTenantDto {
  @ApiPropertyOptional({ example: 'Acme Corp' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ example: 'acme-corp' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  slug?: string;

  @ApiPropertyOptional({ example: 'Acme Corporation' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  displayName?: string;

  @ApiPropertyOptional({ enum: TenantStatus })
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

  @ApiPropertyOptional({ example: 'light' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  themeMode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
