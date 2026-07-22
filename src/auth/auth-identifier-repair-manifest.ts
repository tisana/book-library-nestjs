import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';
import { UnprocessableEntityException } from '@nestjs/common';
import { AuthIdentifierSubjectType } from './schemas/auth-identifier.schema';

export const AUTH_IDENTIFIER_REPAIR_MANIFEST_SALT =
  'book-library/auth-identifier-repair-manifest/v1';
export const AUTH_IDENTIFIER_REPAIR_MANIFEST_KEY_LENGTH = 32;

export interface RepairManifestSubject {
  subjectType: AuthIdentifierSubjectType;
  subjectId: string;
}

export interface RepairManifestReassignment extends RepairManifestSubject {
  newIdentifier: string;
}

export interface AuthIdentifierRepairManifest {
  conflictId: string;
  retainedSubject?: RepairManifestSubject;
  reassignments: RepairManifestReassignment[];
}

export interface HashedRepairManifest {
  canonicalJson: string;
  derivedKey: Buffer;
  manifestHash: string;
  manifestKeyVersion: number;
}

export function normalizeRepairManifest(
  manifest: AuthIdentifierRepairManifest,
): AuthIdentifierRepairManifest {
  const conflictId = manifest.conflictId.trim();
  if (!conflictId) {
    throw new UnprocessableEntityException('Conflict id is required');
  }
  const reassignments = manifest.reassignments
    .map((item) => ({
      subjectType: item.subjectType,
      subjectId: item.subjectId.trim(),
      newIdentifier: item.newIdentifier.trim().toLowerCase(),
    }))
    .sort(
      (left, right) =>
        left.subjectType.localeCompare(right.subjectType) ||
        left.subjectId.localeCompare(right.subjectId),
    );
  if (
    !reassignments.length ||
    reassignments.some((item) => !item.subjectId || !item.newIdentifier)
  ) {
    throw new UnprocessableEntityException(
      'Every repair reassignment requires a subject and identifier',
    );
  }

  return {
    conflictId,
    reassignments,
    ...(manifest.retainedSubject
      ? {
          retainedSubject: {
            subjectType: manifest.retainedSubject.subjectType,
            subjectId: manifest.retainedSubject.subjectId.trim(),
          },
        }
      : {}),
  };
}

export function canonicalizeRepairManifest(
  manifest: AuthIdentifierRepairManifest,
): string {
  return canonicalJson(normalizeRepairManifest(manifest));
}

export function deriveRepairManifestKey(
  keyMaterial: string | Buffer,
  manifestKeyVersion: number,
): Buffer {
  if (!Number.isSafeInteger(manifestKeyVersion) || manifestKeyVersion < 1) {
    throw new UnprocessableEntityException(
      'Manifest key version must be a positive integer',
    );
  }
  return Buffer.from(
    hkdfSync(
      'sha256',
      decodeKeyMaterial(keyMaterial),
      Buffer.from(AUTH_IDENTIFIER_REPAIR_MANIFEST_SALT, 'utf8'),
      Buffer.from(`key-version:${manifestKeyVersion}`, 'utf8'),
      AUTH_IDENTIFIER_REPAIR_MANIFEST_KEY_LENGTH,
    ),
  );
}

export function hashRepairManifest(
  manifest: AuthIdentifierRepairManifest,
  keyMaterial: string | Buffer,
  manifestKeyVersion: number,
): HashedRepairManifest {
  const canonicalJson = canonicalizeRepairManifest(manifest);
  const derivedKey = deriveRepairManifestKey(keyMaterial, manifestKeyVersion);
  return {
    canonicalJson,
    derivedKey,
    manifestHash: createHmac('sha256', derivedKey)
      .update(canonicalJson, 'utf8')
      .digest('base64url'),
    manifestKeyVersion,
  };
}

export function verifyRepairManifest(
  manifest: AuthIdentifierRepairManifest,
  expectedHash: string,
  keyMaterial: string | Buffer,
  manifestKeyVersion: number,
): boolean {
  const actual = Buffer.from(
    hashRepairManifest(manifest, keyMaterial, manifestKeyVersion).manifestHash,
    'base64url',
  );
  let expected: Buffer;
  try {
    expected = Buffer.from(expectedHash, 'base64url');
  } catch {
    return false;
  }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function decodeKeyMaterial(value: string | Buffer): Buffer {
  if (Buffer.isBuffer(value)) return value;
  const decoded = Buffer.from(value, 'base64url');
  return decoded.length > 0 && decoded.toString('base64url') === value
    ? decoded
    : Buffer.from(value, 'utf8');
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new UnprocessableEntityException(
        'Repair manifest contains a non-finite number',
      );
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (typeof value === 'object' && value) {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .filter((key) => object[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
      .join(',')}}`;
  }
  throw new UnprocessableEntityException(
    'Repair manifest contains an unsupported value',
  );
}
