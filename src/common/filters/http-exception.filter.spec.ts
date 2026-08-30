import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter normalized response contract', () => {
  const invoke = (exception: unknown, url?: string) => {
    const response = {
      status: jest.fn(),
      json: jest.fn(),
    };
    response.status.mockReturnValue(response);
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => ({ url }),
      }),
    } as unknown as ArgumentsHost;

    new HttpExceptionFilter().catch(exception, host);

    return response;
  };

  it('returns a generic internal-error body for an unknown thrown value', () => {
    const response = invoke(new Error('database hostname must not leak'), '/books');

    expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'InternalServerError',
      path: '/books',
      timestamp: expect.any(String),
    });
  });

  it('normalizes a string HTTP exception response', () => {
    const response = invoke(
      new HttpException('temporarily unavailable', HttpStatus.SERVICE_UNAVAILABLE),
      '/health/ready',
    );

    expect(response.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      message: 'temporarily unavailable',
      error: 'HttpException',
      path: '/health/ready',
      timestamp: expect.any(String),
    });
  });

  it('normalizes an object HTTP exception response with its public details', () => {
    const response = invoke(
      new BadRequestException({
        message: 'ISBN is invalid',
        error: 'Bad Request',
        details: { field: 'isbn' },
      }),
      '/books',
    );

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'ISBN is invalid',
      error: 'Bad Request',
      details: { field: 'isbn' },
      path: '/books',
      timestamp: expect.any(String),
    });
  });

  it('preserves validation messages and details in the normalized HTTP body', () => {
    const response = invoke(
      new BadRequestException({
        message: ['email must be an email'],
        error: 'Bad Request',
        details: { field: 'email' },
      }),
      '/staff-users',
    );

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/staff-users',
        message: ['email must be an email'],
        details: { field: 'email' },
      }),
    );
  });

  it('uses an empty path when the HTTP request has no URL', () => {
    const response = invoke(new BadRequestException('missing request URL'));

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ path: '', message: 'missing request URL' }),
    );
  });
});
