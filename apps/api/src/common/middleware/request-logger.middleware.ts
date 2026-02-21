import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      const logLine = `${req.method} ${req.originalUrl || req.url} ${res.statusCode} ${duration}ms`;
      if (res.statusCode >= 500) {
        console.error(logLine);
      } else if (res.statusCode >= 400) {
        console.warn(logLine);
      } else {
        console.log(logLine);
      }
    });
    next();
  }
}
