import { Types } from 'mongoose';
import {
  AuthIdentifierDocument,
  AuthIdentifierStatus,
  AuthIdentifierSubjectType,
  AuthIdentifierType,
} from '../../src/auth/schemas/auth-identifier.schema';
import {
  StaffRole,
  StaffUserStatus,
} from '../../src/common/enums/library-status.enum';
import { StaffUserDocument } from '../../src/staff-users/schemas/staff-user.schema';

export interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason?: unknown): void;
}

export interface StaffFindQueryDouble<T> {
  sort(value: Record<string, 1 | -1>): StaffFindQueryDouble<T>;
  skip(value: number): StaffFindQueryDouble<T>;
  limit(value: number): StaffFindQueryDouble<T>;
  exec(): Promise<T>;
}

export interface IdentifierQueryDouble<T> {
  select(value: unknown): IdentifierQueryDouble<T>;
  session(value: unknown): IdentifierQueryDouble<T>;
  exec(): Promise<T>;
}

export interface StaffModelRecordedCalls {
  constructorInputs: unknown[];
  existsFilters: unknown[];
  findOneFilters: unknown[];
  findFilters: unknown[];
  sortValues: unknown[];
  skipValues: number[];
  limitValues: number[];
  updateOneArguments: unknown[][];
}

export interface IdentifierModelRecordedCalls {
  findOneFilters: unknown[];
  sessionValues: unknown[];
  updateOneArguments: unknown[][];
  createArguments: unknown[][];
}

export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

export function queryResult<T>(value: T): IdentifierQueryDouble<T> {
  const query = {} as IdentifierQueryDouble<T>;
  query.select = jest.fn(() => query);
  query.session = jest.fn(() => query);
  query.exec = jest.fn().mockResolvedValue(value);
  return query;
}

export function createStaffDocument(
  overrides: Partial<StaffUserDocument> = {},
): StaffUserDocument {
  const objectId = overrides._id ?? new Types.ObjectId('507f1f77bcf86cd799439011');
  const document = {
    _id: objectId,
    id: overrides.id ?? objectId.toString(),
    email: 'staff@example.test',
    displayName: 'Staff User',
    passwordHash: 'stored-password-hash',
    roles: [StaffRole.Staff],
    status: StaffUserStatus.Active,
    authVersion: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  } as StaffUserDocument;
  document.save = jest.fn().mockImplementation(async () => document);
  return document;
}

export function createStaffModelHarness(options: {
  document?: StaffUserDocument;
  existsResult?: unknown;
  findOneResult?: StaffUserDocument | null;
  findResult?: StaffUserDocument[];
  startSession?: jest.Mock;
} = {}): {
  model: jest.Mock & {
    exists: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
    updateOne: jest.Mock;
    db: { startSession?: jest.Mock };
  };
  document: StaffUserDocument;
  calls: StaffModelRecordedCalls;
} {
  const document = options.document ?? createStaffDocument();
  const calls: StaffModelRecordedCalls = {
    constructorInputs: [],
    existsFilters: [],
    findOneFilters: [],
    findFilters: [],
    sortValues: [],
    skipValues: [],
    limitValues: [],
    updateOneArguments: [],
  };
  const findOneResult =
    options.findOneResult === undefined ? document : options.findOneResult;
  const findResult = options.findResult ?? [document];

  const findChain = {} as StaffFindQueryDouble<StaffUserDocument[]>;
  findChain.sort = jest.fn((value: Record<string, 1 | -1>) => {
    calls.sortValues.push(value);
    return findChain;
  });
  findChain.skip = jest.fn((value: number) => {
    calls.skipValues.push(value);
    return findChain;
  });
  findChain.limit = jest.fn((value: number) => {
    calls.limitValues.push(value);
    return findChain;
  });
  findChain.exec = jest.fn().mockResolvedValue(findResult);

  const model = jest.fn().mockImplementation((input: unknown) => {
    calls.constructorInputs.push(input);
    if (typeof input === 'object' && input !== null) {
      Object.assign(document, input);
      document.id = document._id.toString();
    }
    return document;
  }) as jest.Mock & {
    exists: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
    updateOne: jest.Mock;
    db: { startSession?: jest.Mock };
  };
  model.exists = jest.fn(async (filter: unknown) => {
    calls.existsFilters.push(filter);
    return options.existsResult;
  });
  model.findOne = jest.fn((filter: unknown) => {
    calls.findOneFilters.push(filter);
    return queryResult(findOneResult);
  });
  model.find = jest.fn((filter: unknown) => {
    calls.findFilters.push(filter);
    return findChain;
  });
  model.updateOne = jest.fn(async (...args: unknown[]) => {
    calls.updateOneArguments.push(args);
    return { acknowledged: true, modifiedCount: 1 };
  });
  model.db = options.startSession
    ? { startSession: options.startSession }
    : {};

  return { model, document, calls };
}

export function createIdentifierModelHarness(options: {
  findOneResult?: AuthIdentifierDocument | null;
} = {}): {
  model: {
    findOne: jest.Mock;
    updateOne: jest.Mock;
    create: jest.Mock;
  };
  calls: IdentifierModelRecordedCalls;
} {
  const calls: IdentifierModelRecordedCalls = {
    findOneFilters: [],
    sessionValues: [],
    updateOneArguments: [],
    createArguments: [],
  };
  const findOneResult = options.findOneResult ?? null;

  const model = {
    findOne: jest.fn((filter: unknown) => {
      calls.findOneFilters.push(filter);
      const query = queryResult(findOneResult);
      query.session = jest.fn((value: unknown) => {
        calls.sessionValues.push(value);
        return query;
      });
      return query;
    }),
    updateOne: jest.fn(async (...args: unknown[]) => {
      calls.updateOneArguments.push(args);
      return { acknowledged: true, modifiedCount: 1 };
    }),
    create: jest.fn(async (...args: unknown[]) => {
      calls.createArguments.push(args);
      return [
        {
          normalizedIdentifier: 'admin@example.test',
          identifierType: AuthIdentifierType.Email,
          subjectType: AuthIdentifierSubjectType.Staff,
          status: AuthIdentifierStatus.Active,
        },
      ];
    }),
  };

  return { model, calls };
}
