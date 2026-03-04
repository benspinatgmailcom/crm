import { ApiPropertyOptional } from '@nestjs/swagger';
import { PartialType, OmitType } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { CreateOpportunityDto } from './create-opportunity.dto';

const Base = PartialType(OmitType(CreateOpportunityDto, ['accountId', 'ownerId'] as const));

export class UpdateOpportunityDto extends Base {
  /** Reassign owner (ADMIN or current owner only). */
  @ApiPropertyOptional({ description: 'New owner user ID' })
  @IsOptional()
  @IsString()
  ownerId?: string;
}
