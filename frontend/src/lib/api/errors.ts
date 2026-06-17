import { ApiClientError } from './client';

export interface MutationErrorView {
  title: string;
  message: string;
  fieldErrors: Record<string, string>;
}

export function toMutationError(error: unknown): MutationErrorView {
  if (error instanceof ApiClientError) {
    if (error.status === 409) {
      return {
        title: 'Request blocked',
        message: error.message || 'The backend rejected this change.',
        fieldErrors: {},
      };
    }

    if (error.status === 400) {
      return {
        title: 'Check the form',
        message: error.message || 'Some fields need attention.',
        fieldErrors: toFieldErrors(error.details?.message),
      };
    }

    if (error.status === 403) {
      return {
        title: 'Permission denied',
        message: 'Your staff account cannot perform this action.',
        fieldErrors: {},
      };
    }

    return {
      title: 'Request failed',
      message: error.message,
      fieldErrors: {},
    };
  }

  return {
    title: 'Request failed',
    message: 'Something went wrong while contacting the API.',
    fieldErrors: {},
  };
}

function toFieldErrors(message: string | string[] | undefined) {
  const messages = Array.isArray(message)
    ? message
    : message
      ? [message]
      : [];

  return messages.reduce<Record<string, string>>((accumulator, current) => {
    const [field, ...rest] = current.split(' ');
    if (field && rest.length > 0) {
      accumulator[field] = current;
    }
    return accumulator;
  }, {});
}
