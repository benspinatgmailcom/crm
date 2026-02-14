import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  Query,
  Req,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/constants';
import { ActivityService } from '../activity/activity.service';

const ENTITY_TYPES = ['account', 'contact', 'lead', 'opportunity'] as const;

@ApiTags('Upload')
@Controller('uploads')
@ApiBearerAuth()
export class UploadController {
  constructor(private readonly activityService: ActivityService) {}

  @Post()
  @Roles(Role.ADMIN, Role.USER)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        entityType: { type: 'string', enum: [...ENTITY_TYPES] },
        entityId: { type: 'string' },
      },
      required: ['file', 'entityType', 'entityId'],
    },
  })
  @ApiOperation({ summary: 'Upload file for an entity' })
  @ApiResponse({ status: 201, description: 'File uploaded and file_uploaded activity created' })
  @ApiResponse({ status: 400, description: 'Missing file or invalid entity' })
  async upload(
    @Req() req: Request & { file?: { buffer: Buffer; originalname: string } },
    @Body('entityType') entityType: string,
    @Body('entityId') entityId: string,
  ) {
    const file = req.file;
    if (!file) throw new BadRequestException('No file provided');
    if (!entityType || !entityId) {
      throw new BadRequestException('entityType and entityId are required');
    }
    if (!ENTITY_TYPES.includes(entityType as (typeof ENTITY_TYPES)[number])) {
      throw new BadRequestException('Invalid entityType');
    }

    const uploadsDir = path.join(process.cwd(), 'uploads', entityType, entityId);
    fs.mkdirSync(uploadsDir, { recursive: true });
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext);
    const safeName = `${randomUUID()}-${baseName.replace(/[^a-zA-Z0-9_-]/g, '_')}${ext}`;
    const destPath = path.join(uploadsDir, safeName);
    fs.writeFileSync(destPath, file.buffer);

    const relativePath = path.join(entityType, entityId, safeName).replace(/\\/g, '/');
    await this.activityService.createRaw({
      entityType: entityType as (typeof ENTITY_TYPES)[number],
      entityId,
      type: 'file_uploaded',
      payload: {
        filename: file.originalname,
        path: relativePath,
      },
    });

    return { ok: true, path: relativePath };
  }

  @Get('download')
  @Roles(Role.ADMIN, Role.USER, Role.VIEWER)
  @ApiOperation({ summary: 'Download file by path' })
  @ApiResponse({ status: 200, description: 'File content' })
  @ApiResponse({ status: 400, description: 'Invalid path' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async download(@Query('path') pathParam: string, @Res() res: Response) {
    if (!pathParam || pathParam.includes('..') || pathParam.startsWith('/')) {
      throw new BadRequestException('Invalid path');
    }
    const fullPath = path.join(process.cwd(), 'uploads', pathParam);
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      throw new NotFoundException('File not found');
    }
    const filename = path.basename(fullPath).replace(/^[a-f0-9-]+-/, '');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.sendFile(path.resolve(fullPath));
  }
}
