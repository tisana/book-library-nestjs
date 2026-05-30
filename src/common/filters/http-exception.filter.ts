import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

interface NormalizedErrorResponse {
  statusCode: number;
  message: string | string[];
  error?: string;
  details?: unknown;
  path: string;
  timestamp: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<{ url?: string }>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    response
      .status(status)
      .json(this.normalizeResponse(exception, status, request.url ?? ''));
  }

  private normalizeResponse(
    exception: unknown,
    statusCode: number,
    path: string,
  ): NormalizedErrorResponse {
    const base = {
      statusCode,
      path,
      timestamp: new Date().toISOString(),
    };

    if (!(exception instanceof HttpException)) {
      return {
        ...base,
        message: 'Internal server error',
        error: 'InternalServerError',
      };
    }

    const exceptionResponse = exception.getResponse();

    if (typeof exceptionResponse === 'string') {
      return {
        ...base,
        message: exceptionResponse,
        error: exception.name,
      };
    }

    if (this.isRecord(exceptionResponse)) {
      const message = exceptionResponse.message;

      return {
        ...base,
        message:
          typeof message === 'string' || Array.isArray(message)
            ? message
            : exception.message,
        error:
          typeof exceptionResponse.error === 'string'
            ? exceptionResponse.error
            : exception.name,
        details: exceptionResponse.details,
      };
    }

    return {
      ...base,
      message: exception.message,
      error: exception.name,
    };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
