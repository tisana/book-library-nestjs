import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AuditKeyRotationPreflightInput,
  AuditKeyRotationPreflightResult,
  AuthIdentifierRepairKeyPolicyService,
} from '../src/auth/auth-identifier-repair-key-policy.service';
import {
  AuthIdentifierOperationModelName,
  AuthIdentifierOperationSchema,
} from '../src/auth/schemas/auth-identifier-operation.schema';
import {
  AuthThrottleBucketModelName,
  AuthThrottleBucketSchema,
} from '../src/auth/schemas/auth-throttle-bucket.schema';
import authConfig from '../src/config/auth.config';
import databaseConfig from '../src/config/database.config';

const MAX_PREVIOUS_KEYS = 2;
const INPUT_FIELDS = new Set([
  'candidateCurrentVersion',
  'candidatePreviousVersions',
]);

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [authConfig, databaseConfig],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri:
          configService.get<string>('database.uri') ??
          'mongodb://localhost:27017/bookstore',
        directConnection: true,
        serverSelectionTimeoutMS: 5000,
      }),
    }),
    MongooseModule.forFeature([
      {
        name: AuthIdentifierOperationModelName,
        schema: AuthIdentifierOperationSchema,
      },
      {
        name: AuthThrottleBucketModelName,
        schema: AuthThrottleBucketSchema,
      },
    ]),
  ],
  providers: [AuthIdentifierRepairKeyPolicyService],
})
class AuditKeyRotationPreflightModule {}

export interface AuditKeyRotationPreflightContext {
  get(
    type: typeof AuthIdentifierRepairKeyPolicyService,
  ): Pick<AuthIdentifierRepairKeyPolicyService, 'preflightRotation'>;
  close(): Promise<void>;
}

export type AuditKeyRotationPreflightContextFactory =
  () => Promise<AuditKeyRotationPreflightContext>;

export interface AuditKeyRotationProcessResult {
  exitCode: 0 | 1 | 2;
  output:
    | AuditKeyRotationPreflightResult
    | {
        status: 'error';
        reason: 'invalid-input' | 'preflight-failed';
        requiredPreviousVersions: number[];
        requiredPreviousCount: number;
        maxPreviousKeys: number;
      };
}

export function parseAuditKeyRotationPreflightInput(
  rawInput: string,
): AuditKeyRotationPreflightInput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawInput);
  } catch {
    throw new Error('invalid-input');
  }

  if (!isRecord(parsed)) {
    throw new Error('invalid-input');
  }

  const fields = Object.keys(parsed);
  if (
    fields.length !== INPUT_FIELDS.size ||
    fields.some((field) => !INPUT_FIELDS.has(field))
  ) {
    throw new Error('invalid-input');
  }

  const candidateCurrentVersion = parsed.candidateCurrentVersion;
  const candidatePreviousVersions = parsed.candidatePreviousVersions;

  if (
    !isPositiveVersion(candidateCurrentVersion) ||
    !Array.isArray(candidatePreviousVersions) ||
    candidatePreviousVersions.some((version) => !isPositiveVersion(version))
  ) {
    throw new Error('invalid-input');
  }

  const uniquePrevious = new Set(candidatePreviousVersions);
  if (
    uniquePrevious.size !== candidatePreviousVersions.length ||
    uniquePrevious.has(candidateCurrentVersion)
  ) {
    throw new Error('invalid-input');
  }

  return {
    candidateCurrentVersion,
    candidatePreviousVersions: [...candidatePreviousVersions],
  };
}

export async function runAuditKeyRotationPreflight(
  rawInput: string,
  contextFactory: AuditKeyRotationPreflightContextFactory = createPreflightContext,
): Promise<AuditKeyRotationProcessResult> {
  let input: AuditKeyRotationPreflightInput;
  try {
    input = parseAuditKeyRotationPreflightInput(rawInput);
  } catch {
    return errorResult('invalid-input');
  }

  let context: AuditKeyRotationPreflightContext | undefined;
  let result: AuditKeyRotationProcessResult;
  try {
    context = await contextFactory();
    const policy = context.get(AuthIdentifierRepairKeyPolicyService);
    const output = await policy.preflightRotation(input);
    result = { exitCode: output.status === 'ok' ? 0 : 2, output };
  } catch {
    result = errorResult('preflight-failed');
  }

  if (context) {
    try {
      await context.close();
    } catch {
      return errorResult('preflight-failed');
    }
  }
  return result;
}

async function createPreflightContext(): Promise<AuditKeyRotationPreflightContext> {
  const applicationContext = await NestFactory.createApplicationContext(
    AuditKeyRotationPreflightModule,
    { logger: false },
  );
  return {
    get: (type) => applicationContext.get(type),
    close: () => applicationContext.close(),
  };
}

function errorResult(
  reason: 'invalid-input' | 'preflight-failed',
): AuditKeyRotationProcessResult {
  return {
    exitCode: 1,
    output: {
      status: 'error',
      reason,
      requiredPreviousVersions: [],
      requiredPreviousCount: 0,
      maxPreviousKeys: MAX_PREVIOUS_KEYS,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isPositiveVersion(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

async function readStandardInput(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function main(): Promise<void> {
  const result = await runAuditKeyRotationPreflight(await readStandardInput());
  process.stdout.write(`${JSON.stringify(result.output)}\n`);
  process.exitCode = result.exitCode;
}

if (require.main === module) {
  void main();
}
