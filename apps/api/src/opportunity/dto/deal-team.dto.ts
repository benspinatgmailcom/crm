import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export const DEAL_TEAM_ROLES = ['Champion', 'Economic Buyer', 'Technical Stakeholder', 'Other'] as const;
export type DealTeamRole = (typeof DEAL_TEAM_ROLES)[number];

export class AddDealTeamMemberDto {
  @ApiProperty({ description: 'Contact ID (must belong to opportunity account)' })
  @IsString()
  contactId: string;

  @ApiProperty({ description: 'Buyer role', enum: DEAL_TEAM_ROLES })
  @IsString()
  @IsIn(DEAL_TEAM_ROLES)
  role: DealTeamRole;
}

export class UpdateDealTeamMemberDto {
  @ApiProperty({ description: 'Buyer role', enum: DEAL_TEAM_ROLES })
  @IsString()
  @IsIn(DEAL_TEAM_ROLES)
  role: DealTeamRole;
}
