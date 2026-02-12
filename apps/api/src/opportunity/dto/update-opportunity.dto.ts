import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateOpportunityDto } from './create-opportunity.dto';

export class UpdateOpportunityDto extends PartialType(
  OmitType(CreateOpportunityDto, ['accountId'] as const),
) {}
