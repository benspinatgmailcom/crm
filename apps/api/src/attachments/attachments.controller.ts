import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@crm/db';
import { AttachmentsService } from './attachments.service';

@ApiTags('Attachments')
@Controller('attachments')
@ApiBearerAuth()
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.USER)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['entityType', 'entityId', 'file'],
      properties: {
        entityType: { type: 'string', enum: ['account', 'contact', 'lead', 'opportunity'] },
        entityId: { type: 'string' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({ summary: 'Upload attachment' })
  @ApiResponse({ status: 201, description: 'Attachment created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: { body: { entityType?: string; entityId?: string } },
    @CurrentUser() user: User,
  ) {
    const entityType = req.body?.entityType;
    const entityId = req.body?.entityId;
    if (!entityType || !entityId) {
      throw new BadRequestException('entityType and entityId are required');
    }
    return this.attachmentsService.create(entityType, entityId, file, user);
  }

  @Get()
  @Roles(Role.ADMIN, Role.USER, Role.VIEWER)
  @ApiOperation({ summary: 'List attachments for entity' })
  @ApiResponse({ status: 200, description: 'List of attachments' })
  findAll(
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
  ) {
    return this.attachmentsService.findAll(entityType, entityId);
  }

  @Get(':id/download')
  @Roles(Role.ADMIN, Role.USER, Role.VIEWER)
  @ApiOperation({ summary: 'Download attachment (redirect/stream) or get presigned URL (?format=json)' })
  @ApiResponse({ status: 200, description: 'File stream (local), 302 redirect (S3), or JSON { url } when format=json' })
  @ApiResponse({ status: 404, description: 'Attachment not found' })
  async download(
    @Param('id') id: string,
    @Query('format') format: string | undefined,
    @Res() res: Response,
  ) {
    const { attachment, signedUrl, localFilePath } = await this.attachmentsService.getDownload(id);

    if (format === 'json') {
      if (signedUrl) {
        return res.json({ url: signedUrl, fileName: attachment.fileName });
      }
      return res.json({ url: null, fileName: attachment.fileName });
    }

    if (signedUrl) {
      res.redirect(302, signedUrl);
      return;
    }
    if (localFilePath) {
      const stats = await stat(localFilePath);
      res.setHeader('Content-Type', attachment.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${attachment.fileName}"`);
      res.setHeader('Content-Length', String(stats.size));
      createReadStream(localFilePath).pipe(res);
      return;
    }
    res.status(500).json({ statusCode: 500, message: 'Download not available' });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Delete attachment' })
  @ApiResponse({ status: 204, description: 'Attachment deleted' })
  @ApiResponse({ status: 404, description: 'Attachment not found' })
  async remove(@Param('id') id: string, @CurrentUser() user: User) {
    await this.attachmentsService.remove(id, user);
  }
}
