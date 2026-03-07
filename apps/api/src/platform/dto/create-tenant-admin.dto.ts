import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional } from 'class-validator';
import { Role } from '../../auth/constants';

export class CreateTenantAdminDto {
  @ApiProperty({ example: 'admin@tenant.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ enum: Role, default: Role.ADMIN })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
