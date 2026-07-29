import { describe, expect, it } from 'vitest';
import { ApiClientError } from './client';
import { toMutationError } from './errors';

describe('toMutationError', () => {
  it.each([
    [400, 'title is required', 'Check the form', 'title is required'],
    [401, 'account email is unknown', 'Sign in failed', 'Invalid credentials.'],
    [403, 'forbidden', 'Permission denied', 'Your staff account cannot perform this action.'],
    [409, 'Identifier already exists', 'Request blocked', 'Identifier already exists'],
    [500, 'Service unavailable', 'Request failed', 'Service unavailable'],
  ] as const)(
    'maps HTTP %i errors to the appropriate view',
    (status, message, title, expectedMessage) => {
      expect(toMutationError(new ApiClientError(status, message))).toEqual({
        title,
        message: expectedMessage,
        fieldErrors: {},
      });
    },
  );

  it('maps array validation messages to fields but ignores malformed single-word messages', () => {
    expect(
      toMutationError(
        new ApiClientError(400, 'Validation failed', {
          statusCode: 400,
          message: ['title is required', 'author must be a string', 'invalid'],
        }),
      ),
    ).toEqual({
      title: 'Check the form',
      message: 'Validation failed',
      fieldErrors: {
        title: 'title is required',
        author: 'author must be a string',
      },
    });
  });

  it('uses the safe fallback for unknown errors', () => {
    expect(toMutationError(new Error('network failed'))).toEqual({
      title: 'Request failed',
      message: 'Something went wrong while contacting the API.',
      fieldErrors: {},
    });
  });
});
