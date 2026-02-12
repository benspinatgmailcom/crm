import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Lead } from '@crm/db';
import { PaginatedResult } from '../common/pagination.dto';
import { LeadService } from './lead.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { QueryLeadDto } from './dto/query-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

@ApiTags('Lead')
@Controller('leads')
export class LeadController {
  constructor(private readonly leadService: LeadService) {}

  @Post()
  @ApiOperation({ summary: 'Create lead' })
  @ApiResponse({ status: 201, description: 'Lead created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Conflict' })
  create(@Body() dto: CreateLeadDto): Promise<Lead> {
    return this.leadService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List leads (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated list of leads' })
  findAll(@Query() query: QueryLeadDto): Promise<PaginatedResult<Lead>> {
    return this.leadService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get lead by ID' })
  @ApiResponse({ status: 200, description: 'Lead found' })
  @ApiResponse({ status: 404, description: 'Lead not found' })
  findOne(@Param('id') id: string): Promise<Lead> {
    return this.leadService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update lead' })
  @ApiResponse({ status: 200, description: 'Lead updated' })
  @ApiResponse({ status: 404, description: 'Lead not found' })
  @ApiResponse({ status: 409, description: 'Conflict' })
  update(@Param('id') id: string, @Body() dto: UpdateLeadDto): Promise<Lead> {
    return this.leadService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete lead' })
  @ApiResponse({ status: 204, description: 'Lead deleted' })
  @ApiResponse({ status: 404, description: 'Lead not found' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.leadService.remove(id);
  }
}
