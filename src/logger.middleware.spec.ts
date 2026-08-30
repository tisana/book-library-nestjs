import { Logger } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { LoggerMiddleware } from './logger.middleware';

describe('LoggerMiddleware', () => {
  it('should be defined', () => {
    expect(new LoggerMiddleware()).toBeDefined();
  });

  it('logs the request method and path and continues the request once', () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const next = jest.fn() as NextFunction;

    try {
      new LoggerMiddleware().use(
        { method: 'PATCH', path: '/books/book-1' } as Request,
        {} as Response,
        next,
      );

      expect(logSpy).toHaveBeenCalledWith('PATCH /books/book-1');
      expect(next).toHaveBeenCalledTimes(1);
    } finally {
      logSpy.mockRestore();
    }
  });
});
