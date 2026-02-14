import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/constants';
import { AttachmentsService } from './attachments.service';

@ApiTags('Attachments')
@Controller('attachments')
@ApiBearerAuth()
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Delete attachment (file + activity), create file_deleted log' })
  @ApiResponse({ status: 204, description: 'Attachment deleted' })
  @ApiResponse({ status: 404, description: 'Attachment not found' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.attachmentsService.remove(id);
  }
}
