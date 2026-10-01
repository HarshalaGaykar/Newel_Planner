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
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: (exception as Error).message, statusCode: status };

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      ...(typeof message === 'object' ? message : { message }),
    };

    this.logger.error(
      `${request.method} ${request.url} ${status} - Error: ${JSON.stringify(message)}`,
    );

    // A response can already be finished by the time we get here (e.g. a
    // streamed/file download that failed partway through). Writing to it again
    // throws ERR_HTTP_HEADERS_SENT, which would otherwise escape as an
    // unhandled exception on top of the original error.
    if (response.headersSent) {
      return;
    }

    response.status(status).json(errorResponse);
  }
}
