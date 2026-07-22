import { HttpException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import {
  AuthIdentifierRepairService,
  OfflineRepairRequest,
  OfflineRepairResult,
} from '../src/auth/auth-identifier-repair.service';
import { AuthIdentifierSubjectType } from '../src/auth/schemas/auth-identifier.schema';

type RepairCliAction = 'dry-run' | 'apply' | 'cancel';

export interface RepairCliInput extends OfflineRepairRequest {
  action: RepairCliAction;
  confirmation?: string;
}

export interface RepairCliOutput {
  status: 'ok' | 'refused' | 'resumable' | 'denied' | 'invalid';
  reason: string;
  operationId?: string;
  operationStatus?: string;
  assignmentCount?: number;
  batchCount?: number;
  replayed?: boolean;
}

export interface RepairCliIo {
  read(): Promise<string>;
  write(value: string): void;
  writeError(value: string): void;
}

const allowedTopLevel = new Set([
  'action',
  'token',
  'operationId',
  'manifest',
  'resumeId',
  'confirmation',
]);
const forbiddenActorKeys = new Set([
  'actor',
  'actorId',
  'requestedBy',
  'lastResumedBy',
]);

export function parseRepairCliInput(raw: string): RepairCliInput {
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    throw new Error('invalid-input');
  }
  if (!isObject(value)) throw new Error('invalid-input');
  if (
    Object.keys(value).some(
      (key) => !allowedTopLevel.has(key) || forbiddenActorKeys.has(key),
    )
  ) {
    throw new Error('invalid-input');
  }
  if (
    !['dry-run', 'apply', 'cancel'].includes(String(value.action)) ||
    typeof value.token !== 'string' ||
    typeof value.operationId !== 'string' ||
    !isObject(value.manifest)
  ) {
    throw new Error('invalid-input');
  }
  validateManifest(value.manifest);
  return value as unknown as RepairCliInput;
}

export async function runRepairCli(
  service: AuthIdentifierRepairService,
  io: RepairCliIo,
): Promise<number> {
  let input: RepairCliInput;
  try {
    input = parseRepairCliInput(await io.read());
  } catch {
    io.write(JSON.stringify(fixedOutput('invalid', 'invalid-input')));
    return 1;
  }

  if (
    (input.action === 'apply' && input.confirmation !== 'APPLY') ||
    (input.action === 'cancel' && input.confirmation !== 'CANCEL')
  ) {
    io.write(JSON.stringify(fixedOutput('refused', 'confirmation-required')));
    return 2;
  }

  try {
    const result = await invoke(service, input);
    io.write(JSON.stringify(successOutput(result)));
    return 0;
  } catch (error) {
    const status = error instanceof HttpException ? error.getStatus() : 500;
    if (status === 401 || status === 403) {
      io.write(JSON.stringify(fixedOutput('denied', 'authorization-denied')));
      return 4;
    }
    if (status === 503 || status === 409) {
      io.write(JSON.stringify(fixedOutput('resumable', 'repair-paused')));
      return 3;
    }
    io.write(JSON.stringify(fixedOutput('invalid', 'repair-rejected')));
    return 1;
  }
}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  try {
    const service = app.get(AuthIdentifierRepairService);
    const exitCode = await runRepairCli(service, {
      read: readStandardInput,
      write: (value) => process.stdout.write(`${value}\n`),
      writeError: (value) => process.stderr.write(`${value}\n`),
    });
    process.exitCode = exitCode;
  } finally {
    await app.close();
  }
}

async function invoke(
  service: AuthIdentifierRepairService,
  input: RepairCliInput,
): Promise<OfflineRepairResult> {
  const request: OfflineRepairRequest = {
    token: input.token,
    operationId: input.operationId,
    manifest: input.manifest,
    resumeId: input.resumeId,
  };
  if (input.action === 'dry-run') return service.dryRun(request);
  if (input.action === 'apply') return service.apply(request);
  return service.cancel(request);
}

function successOutput(result: OfflineRepairResult): RepairCliOutput {
  return {
    status: 'ok',
    reason: result.reasonCategory,
    operationId: result.operationId,
    operationStatus: result.status,
    assignmentCount: result.assignmentCount,
    batchCount: result.batchCount,
    replayed: result.replayed,
  };
}

function fixedOutput(
  status: RepairCliOutput['status'],
  reason: string,
): RepairCliOutput {
  return { status, reason };
}

function validateManifest(manifest: Record<string, unknown>): void {
  const allowed = new Set(['conflictId', 'retainedSubject', 'reassignments']);
  if (
    Object.keys(manifest).some(
      (key) => !allowed.has(key) || forbiddenActorKeys.has(key),
    ) ||
    typeof manifest.conflictId !== 'string' ||
    !Array.isArray(manifest.reassignments)
  ) {
    throw new Error('invalid-input');
  }
  if (manifest.retainedSubject !== undefined) {
    validateSubject(manifest.retainedSubject, false);
  }
  for (const reassignment of manifest.reassignments) {
    validateSubject(reassignment, true);
  }
}

function validateSubject(value: unknown, requiresIdentifier: boolean): void {
  if (!isObject(value)) throw new Error('invalid-input');
  const allowed = new Set([
    'subjectType',
    'subjectId',
    ...(requiresIdentifier ? ['newIdentifier'] : []),
  ]);
  if (
    Object.keys(value).some(
      (key) => !allowed.has(key) || forbiddenActorKeys.has(key),
    ) ||
    !Object.values(AuthIdentifierSubjectType).includes(
      value.subjectType as AuthIdentifierSubjectType,
    ) ||
    typeof value.subjectId !== 'string' ||
    (requiresIdentifier && typeof value.newIdentifier !== 'string')
  ) {
    throw new Error('invalid-input');
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readStandardInput(): Promise<string> {
  return new Promise((resolve, reject) => {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk: string) => {
      input += chunk;
    });
    process.stdin.on('end', () => resolve(input));
    process.stdin.on('error', reject);
  });
}

if (require.main === module) {
  void main().catch(() => {
    process.stdout.write(
      `${JSON.stringify(fixedOutput('invalid', 'repair-command-failed'))}\n`,
    );
    process.exitCode = 1;
  });
}
