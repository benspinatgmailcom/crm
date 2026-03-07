import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { requireTenantId } from '../common/tenant.util';
import { Role } from '../auth/constants';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@crm/db';
import { SearchService, SearchResponse } from './search.service';
import { QuerySearchDto } from './dto/query-search.dto';

@ApiTags('Search')
@Controller('search')
@ApiBearerAuth()
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @Roles(Role.ADMIN, Role.USER, Role.VIEWER)
  @ApiOperation({
    summary: 'Global search',
    description: 'Search across accounts, contacts, leads, opportunities. Query: q (min 2 chars), limit (optional, 1–10, default 5 per entity).',
  })
  @ApiResponse({ status: 200, description: 'Search results by entity type' })
  search(@Query() dto: QuerySearchDto, @CurrentUser() user: User): Promise<SearchResponse> {
    const tenantId = requireTenantId(user);
    const q = typeof dto.q === 'string' ? dto.q.trim() : '';
    if (q.length < 2) {
      throw new BadRequestException('Query must be at least 2 characters');
    }
    return this.searchService.search(q, dto.limit ?? 5, tenantId);
  }
}
