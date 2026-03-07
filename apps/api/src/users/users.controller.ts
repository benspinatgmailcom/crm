import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/constants';
import { UsersService, UserListItem, UserActiveItem, CreateUserResult, ResetPasswordResult } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import type { User } from '@crm/db';

@ApiTags('Users')
@Controller('users')
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('active')
  @Roles(Role.ADMIN, Role.USER, Role.VIEWER)
  @ApiOperation({ summary: 'List active users for dropdowns (id, email, role)' })
  @ApiResponse({ status: 200, description: 'Active users for owner picker' })
  findActive(@CurrentUser() user: User): Promise<UserActiveItem[]> {
    return this.usersService.findActiveForDropdown(user.tenantId ?? null);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List all users (ADMIN only)' })
  @ApiResponse({ status: 200, description: 'List of users (id, email, role, isActive, createdAt, lastLoginAt)' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  findAll(@CurrentUser() user: User): Promise<UserListItem[]> {
    return this.usersService.findAll(user.tenantId ?? null);
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create user (ADMIN only)' })
  @ApiResponse({ status: 201, description: 'User created; set-password email sent' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  create(@Body() dto: CreateUserDto, @CurrentUser() user: User): Promise<CreateUserResult> {
    return this.usersService.create(dto, user.tenantId ?? null);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update user role or isActive (ADMIN only)' })
  @ApiResponse({ status: 200, description: 'User updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'User not found' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: User): Promise<UserListItem> {
    return this.usersService.update(id, dto, user.tenantId ?? null);
  }

  @Post(':id/reset-password')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Reset user password (ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Password reset; returns tempPassword' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'User not found' })
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() user: User,
  ): Promise<ResetPasswordResult> {
    return this.usersService.resetPassword(id, dto, user.tenantId ?? null);
  }
}
