import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Account } from '@crm/db';
import { PaginatedResult } from '../common/pagination.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/constants';
import { AccountService } from './account.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { QueryAccountDto } from './dto/query-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@ApiTags('Account')
@Controller('accounts')
@ApiBearerAuth()
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Post()
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Create account' })
  @ApiResponse({ status: 201, description: 'Account created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Conflict' })
  create(@Body() dto: CreateAccountDto): Promise<Account> {
    return this.accountService.create(dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.USER, Role.VIEWER)
  @ApiOperation({
    summary: 'List accounts (paginated)',
    description: 'Query params: page (default 1), pageSize (default 20), name (contains), industry (contains), sortBy (name|createdAt), sortDir (asc|desc)',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns { data, page, pageSize, total }',
  })
  findAll(@Query() query: QueryAccountDto): Promise<PaginatedResult<Account>> {
    return this.accountService.findAll(query);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.USER, Role.VIEWER)
  @ApiOperation({ summary: 'Get account by ID' })
  @ApiResponse({ status: 200, description: 'Account found' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  findOne(@Param('id') id: string): Promise<Account> {
    return this.accountService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Update account' })
  @ApiResponse({ status: 200, description: 'Account updated' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  @ApiResponse({ status: 409, description: 'Conflict' })
  update(@Param('id') id: string, @Body() dto: UpdateAccountDto): Promise<Account> {
    return this.accountService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Delete account' })
  @ApiResponse({ status: 204, description: 'Account deleted' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.accountService.remove(id);
  }
}
