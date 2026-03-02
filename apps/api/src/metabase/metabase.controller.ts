import { BadRequestException, Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import * as jwt from 'jsonwebtoken';

@ApiTags('Metabase')
@Controller('metabase')
export class MetabaseController {
  @Get('dashboard-embed-url')
  @ApiOperation({ summary: 'Get signed Metabase dashboard embed URL' })
  @ApiResponse({ status: 200, description: 'iframeUrl for embedding the dashboard' })
  @ApiResponse({ status: 400, description: 'Metabase env not configured' })
  getDashboardEmbedUrl(): { iframeUrl: string } {
    const siteUrl = process.env.METABASE_SITE_URL;
    const embedSecret = process.env.METABASE_EMBED_SECRET;
    const dashboardId = process.env.METABASE_DASHBOARD_ID;

    if (!siteUrl || !embedSecret || !dashboardId) {
      throw new BadRequestException(
        'METABASE_SITE_URL, METABASE_EMBED_SECRET, and METABASE_DASHBOARD_ID must be set',
      );
    }

    const exp = Math.floor(Date.now() / 1000) + 10 * 60; // 10 minutes from now
    const payload = {
      resource: { dashboard: parseInt(dashboardId, 10) },
      params: {},
      exp,
    };

    const token = jwt.sign(payload, embedSecret, { algorithm: 'HS256' });
    const iframeUrl = `${siteUrl.replace(/\/$/, '')}/embed/dashboard/${token}#bordered=true&titled=true`;

    return { iframeUrl };
  }
}
