import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

/** owner=me => current user's deals; owner=all => all (ADMIN default); owner=<userId> => that user (ADMIN only) */
export class PipelineQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by owner: "me" (current user), "all", or a user ID (ADMIN only)',
    example: 'me',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(me|all|.+)$/, {
    message: 'owner must be "me", "all", or a user ID',
  })
  owner?: string;
}
