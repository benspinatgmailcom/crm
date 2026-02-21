import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const response =
      exception instanceof HttpException ? exception.getResponse() : null;
    const message =
      response != null && typeof response === 'object' && 'message' in response
        ? (response as { message?: string | string[] }).message
        : exception instanceof Error
          ? exception.message
          : 'Internal server error';
    const errorMessage = Array.isArray(message) ? message[0] : String(message);

    const payload: Record<string, unknown> =
      response != null &&
      typeof response === 'object' &&
      !Array.isArray(response)
        ? { ...(response as Record<string, unknown>), statusCode: status }
        : {
            statusCode: status,
            message: errorMessage,
            error: exception instanceof HttpException ? exception.name : 'Error',
          };

    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.url} ${status} ${String(payload.message ?? errorMessage)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    res.status(status).json(payload);
  }
}
