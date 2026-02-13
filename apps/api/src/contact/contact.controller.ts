import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Contact } from '@crm/db';
import { PaginatedResult } from '../common/pagination.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/constants';
import { ContactService } from './contact.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { QueryContactDto } from './dto/query-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@ApiTags('Contact')
@Controller('contacts')
@ApiBearerAuth()
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Create contact' })
  @ApiResponse({ status: 201, description: 'Contact created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  create(@Body() dto: CreateContactDto): Promise<Contact> {
    return this.contactService.create(dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.USER, Role.VIEWER)
  @ApiOperation({ summary: 'List contacts (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated list of contacts' })
  findAll(@Query() query: QueryContactDto): Promise<PaginatedResult<Contact>> {
    return this.contactService.findAll(query);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.USER, Role.VIEWER)
  @ApiOperation({ summary: 'Get contact by ID' })
  @ApiResponse({ status: 200, description: 'Contact found' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  findOne(@Param('id') id: string): Promise<Contact> {
    return this.contactService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Update contact' })
  @ApiResponse({ status: 200, description: 'Contact updated' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  update(@Param('id') id: string, @Body() dto: UpdateContactDto): Promise<Contact> {
    return this.contactService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Delete contact' })
  @ApiResponse({ status: 204, description: 'Contact deleted' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.contactService.remove(id);
  }
}
