import { Types } from 'mongoose';
import { MigrationConnection, MigrationDefinition } from '../migrate';

const MIGRATION_ACTOR = 'migration:003-auth-roles-permissions';
const DEFAULT_MAX_ASSIGNMENTS = 20;

export const AUTH_MIGRATION_REQUIRED_INDEXES = {
  auth_identifiers: [
    'uq_auth_identifier_normalized',
    'ix_auth_identifier_pending_operation',
    'ix_auth_identifier_activation_gate',
  ],
  auth_identifier_operations: [
    'uq_auth_identifier_operation_id',
    'uq_auth_identifier_operation_terminal_event',
    'ix_auth_identifier_operation_repair_key_policy',
    'ix_auth_identifier_operation_status_lease',
    'ttl_auth_identifier_operation',
  ],
  auth_identifier_repair_batches: [
    'uq_auth_identifier_repair_batch_checkpoint',
    'ix_auth_identifier_repair_batch_parent_status',
    'ttl_auth_identifier_repair_batch',
  ],
  refresh_token_families: [
    'uq_refresh_token_family_id',
    'uq_refresh_token_family_current_hash',
    'ix_refresh_token_family_last_rotation',
    'ttl_refresh_token_family',
  ],
  refresh_token_replay_markers: [
    'uq_refresh_replay_marker_token_hash',
    'uq_refresh_replay_marker_rotation_operation',
    'ix_refresh_replay_marker_status_lease',
    'ttl_refresh_replay_marker',
  ],
  auth_throttle_buckets: [
    'uq_auth_throttle_bucket_dimension_key',
    'ix_auth_throttle_bucket_key_version_expiry',
    'ttl_auth_throttle_bucket',
  ],
  security_activity_events: [
    'uq_security_activity_event_id',
    'ix_security_activity_created',
  ],
} as const;

interface IndexInspectionCollection {
  listIndexes(): { toArray(): Promise<Array<{ name?: string }>> };
}

export async function findMissingAuthMigrationIndexes(
  connection: MigrationConnection,
): Promise<string[]> {
  const missing: string[] = [];

  for (const [collectionName, requiredNames] of Object.entries(
    AUTH_MIGRATION_REQUIRED_INDEXES,
  )) {
    let actualNames = new Set<string>();

    try {
      const collection = connection.collection(
        collectionName,
      ) as unknown as IndexInspectionCollection;
      const indexes = await collection.listIndexes().toArray();
      actualNames = new Set(
        indexes
          .map((index) => index.name)
          .filter((name): name is string => Boolean(name)),
      );
    } catch {
      // A missing collection is reported as all of its required indexes missing.
    }

    for (const requiredName of requiredNames) {
      if (!actualNames.has(requiredName)) {
        missing.push(`${collectionName}.${requiredName}`);
      }
    }
  }

  return missing;
}

interface LegacyAccountDocument {
  _id: unknown;
  email?: unknown;
  loginIdentifier?: unknown;
  memberNumber?: unknown;
}

interface ExistingIdentifierDocument {
  _id: unknown;
  normalizedIdentifier: string;
}

interface IdentifierCandidate {
  normalizedIdentifier: string;
  identifierType: 'email' | 'member-number' | 'login-identifier';
  subjectType: 'staff' | 'member';
  subjectId: string;
}

interface AuthIdentifierMigrationDocument {
  _id: Types.ObjectId;
  normalizedIdentifier: string;
  identifierType: IdentifierCandidate['identifierType'];
  subjectType?: IdentifierCandidate['subjectType'];
  subjectId?: string;
  status: 'active' | 'conflict';
  conflictingSubjects?: Array<{
    subjectType: IdentifierCandidate['subjectType'];
    subjectId: string;
  }>;
  conflictResolutionStatus?: 'reviewable' | 'manual-repair-required';
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

function normalizeIdentifier(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

function configuredMaxAssignments(): number {
  const configured = Number.parseInt(
    process.env.AUTH_IDENTIFIER_MAX_OPERATION_ASSIGNMENTS ?? '',
    10,
  );

  return Number.isInteger(configured) && configured >= 2 && configured <= 100
    ? configured
    : DEFAULT_MAX_ASSIGNMENTS;
}

function addCandidate(
  groups: Map<string, Map<string, IdentifierCandidate>>,
  value: unknown,
  identifierType: IdentifierCandidate['identifierType'],
  subjectType: IdentifierCandidate['subjectType'],
  subjectId: unknown,
): void {
  const normalizedIdentifier = normalizeIdentifier(value);
  if (!normalizedIdentifier) {
    return;
  }

  const candidate: IdentifierCandidate = {
    normalizedIdentifier,
    identifierType,
    subjectType,
    subjectId: String(subjectId),
  };
  const subjects = groups.get(normalizedIdentifier) ?? new Map();
  const subjectKey = `${subjectType}:${candidate.subjectId}`;

  if (!subjects.has(subjectKey)) {
    subjects.set(subjectKey, candidate);
  }
  groups.set(normalizedIdentifier, subjects);
}

async function backfillAuthIdentifiers(
  connection: MigrationConnection,
  securityActivityEvents: ReturnType<MigrationConnection['collection']>,
  migrationStartedAt: Date,
): Promise<void> {
  const staffUsers = connection.collection<LegacyAccountDocument>('staffusers');
  const members = connection.collection<LegacyAccountDocument>('members');
  const authIdentifiers =
    connection.collection<AuthIdentifierMigrationDocument>('auth_identifiers');

  const [staffDocuments, memberDocuments, existingIdentifiers] =
    await Promise.all([
      staffUsers.find().sort({ _id: 1 }).toArray(),
      members.find().sort({ _id: 1 }).toArray(),
      authIdentifiers.find().sort({ normalizedIdentifier: 1 }).toArray(),
    ]);

  const candidateGroups = new Map<string, Map<string, IdentifierCandidate>>();

  for (const staff of staffDocuments) {
    addCandidate(candidateGroups, staff.email, 'email', 'staff', staff._id);
  }

  for (const member of memberDocuments) {
    addCandidate(
      candidateGroups,
      member.loginIdentifier,
      'login-identifier',
      'member',
      member._id,
    );
    addCandidate(
      candidateGroups,
      member.memberNumber,
      'member-number',
      'member',
      member._id,
    );
  }

  const existingByIdentifier = new Map(
    (existingIdentifiers as ExistingIdentifierDocument[]).map((identifier) => [
      identifier.normalizedIdentifier,
      identifier,
    ]),
  );
  const maxAssignments = configuredMaxAssignments();

  for (const normalizedIdentifier of [...candidateGroups.keys()].sort()) {
    const candidates = [
      ...candidateGroups.get(normalizedIdentifier)!.values(),
    ].sort((left, right) =>
      `${left.subjectType}:${left.subjectId}`.localeCompare(
        `${right.subjectType}:${right.subjectId}`,
      ),
    );
    const existing = existingByIdentifier.get(normalizedIdentifier);
    const identifierId = existing?._id ?? new Types.ObjectId();
    const primaryCandidate = candidates[0];
    const isConflict = candidates.length > 1;
    const migrationDocument: AuthIdentifierMigrationDocument = {
      _id: identifierId as Types.ObjectId,
      normalizedIdentifier,
      identifierType: primaryCandidate.identifierType,
      status: isConflict ? 'conflict' : 'active',
      createdBy: MIGRATION_ACTOR,
      updatedBy: MIGRATION_ACTOR,
      createdAt: migrationStartedAt,
      updatedAt: migrationStartedAt,
    };

    if (isConflict) {
      migrationDocument.conflictingSubjects = candidates.map(
        ({ subjectType, subjectId }) => ({ subjectType, subjectId }),
      );
      migrationDocument.conflictResolutionStatus =
        candidates.length > maxAssignments
          ? 'manual-repair-required'
          : 'reviewable';
    } else {
      migrationDocument.subjectType = primaryCandidate.subjectType;
      migrationDocument.subjectId = primaryCandidate.subjectId;
    }

    await authIdentifiers.updateMany(
      { normalizedIdentifier },
      { $setOnInsert: migrationDocument },
      { upsert: true },
    );

    if (isConflict) {
      await securityActivityEvents.updateMany(
        {
          eventId: `migration-003-identifier-conflict:${String(identifierId)}`,
        },
        {
          $setOnInsert: {
            eventId: `migration-003-identifier-conflict:${String(identifierId)}`,
            eventType: 'identifier-conflict-detected',
            actorType: 'system',
            targetType: 'auth-identifier',
            targetId: String(identifierId),
            outcome: 'denied',
            reasonCategory:
              migrationDocument.conflictResolutionStatus ===
              'manual-repair-required'
                ? 'legacy-identifier-conflict-oversized'
                : 'legacy-identifier-conflict',
            createdAt: migrationStartedAt,
          },
        },
        { upsert: true },
      );
    }
  }
}

async function createAuthIndexes(connection: MigrationConnection) {
  const authIdentifiers = connection.collection('auth_identifiers');
  const authIdentifierOperations = connection.collection(
    'auth_identifier_operations',
  );
  const authIdentifierRepairBatches = connection.collection(
    'auth_identifier_repair_batches',
  );
  const refreshTokenFamilies = connection.collection('refresh_token_families');
  const refreshTokenReplayMarkers = connection.collection(
    'refresh_token_replay_markers',
  );
  const authThrottleBuckets = connection.collection('auth_throttle_buckets');
  const securityActivityEvents = connection.collection(
    'security_activity_events',
  );

  await authIdentifiers.createIndex(
    { normalizedIdentifier: 1 },
    { unique: true, name: 'uq_auth_identifier_normalized' },
  );
  await authIdentifiers.createIndex(
    { subjectType: 1, subjectId: 1, status: 1 },
    { name: 'ix_auth_identifier_subject_status' },
  );
  await authIdentifiers.createIndex(
    { status: 1, updatedAt: -1 },
    { name: 'ix_auth_identifier_status_updated' },
  );
  await authIdentifiers.createIndex(
    { pendingOperationId: 1, status: 1 },
    { sparse: true, name: 'ix_auth_identifier_pending_operation' },
  );
  await authIdentifiers.createIndex(
    { activationGateOperationId: 1, status: 1 },
    { sparse: true, name: 'ix_auth_identifier_activation_gate' },
  );
  await authIdentifiers.createIndex(
    { lastOperationId: 1 },
    { sparse: true, name: 'ix_auth_identifier_last_operation' },
  );

  await authIdentifierOperations.createIndex(
    { operationId: 1 },
    { unique: true, name: 'uq_auth_identifier_operation_id' },
  );
  await authIdentifierOperations.createIndex(
    { terminalEventId: 1 },
    {
      unique: true,
      sparse: true,
      name: 'uq_auth_identifier_operation_terminal_event',
    },
  );
  await authIdentifierOperations.createIndex(
    {
      operationType: 1,
      status: 1,
      cleanupStatus: 1,
      manifestKeyVersion: 1,
    },
    {
      name: 'ix_auth_identifier_operation_repair_key_policy',
      partialFilterExpression: {
        operationType: 'offline-repair',
        manifestKeyVersion: { $exists: true },
      },
    },
  );
  await authIdentifierOperations.createIndex(
    { status: 1, leaseExpiresAt: 1 },
    { name: 'ix_auth_identifier_operation_status_lease' },
  );
  await authIdentifierOperations.createIndex(
    { leaseOwner: 1, leaseExpiresAt: 1 },
    { name: 'ix_auth_identifier_operation_owner_lease' },
  );
  await authIdentifierOperations.createIndex(
    { createdAt: -1 },
    { name: 'ix_auth_identifier_operation_created' },
  );
  await authIdentifierOperations.createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0, name: 'ttl_auth_identifier_operation' },
  );

  await authIdentifierRepairBatches.createIndex(
    { parentOperationId: 1, batchNumber: 1 },
    { unique: true, name: 'uq_auth_identifier_repair_batch_checkpoint' },
  );
  await authIdentifierRepairBatches.createIndex(
    { parentOperationId: 1, status: 1 },
    { name: 'ix_auth_identifier_repair_batch_parent_status' },
  );
  await authIdentifierRepairBatches.createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0, name: 'ttl_auth_identifier_repair_batch' },
  );

  await refreshTokenFamilies.createIndex(
    { familyId: 1 },
    { unique: true, name: 'uq_refresh_token_family_id' },
  );
  await refreshTokenFamilies.createIndex(
    { currentTokenHash: 1 },
    {
      unique: true,
      sparse: true,
      name: 'uq_refresh_token_family_current_hash',
    },
  );
  await refreshTokenFamilies.createIndex(
    { subjectType: 1, subjectId: 1, status: 1 },
    { name: 'ix_refresh_token_family_subject_status' },
  );
  await refreshTokenFamilies.createIndex(
    { lastRotationOperationId: 1 },
    { sparse: true, name: 'ix_refresh_token_family_last_rotation' },
  );
  await refreshTokenFamilies.createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0, name: 'ttl_refresh_token_family' },
  );

  await refreshTokenReplayMarkers.createIndex(
    { tokenHash: 1 },
    { unique: true, name: 'uq_refresh_replay_marker_token_hash' },
  );
  await refreshTokenReplayMarkers.createIndex(
    { rotationOperationId: 1 },
    { unique: true, name: 'uq_refresh_replay_marker_rotation_operation' },
  );
  await refreshTokenReplayMarkers.createIndex(
    { familyId: 1, expiresAt: 1 },
    { name: 'ix_refresh_replay_marker_family_expiry' },
  );
  await refreshTokenReplayMarkers.createIndex(
    { status: 1, leaseExpiresAt: 1 },
    { name: 'ix_refresh_replay_marker_status_lease' },
  );
  await refreshTokenReplayMarkers.createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0, name: 'ttl_refresh_replay_marker' },
  );

  await authThrottleBuckets.createIndex(
    { dimension: 1, keyVersion: 1, bucketKey: 1 },
    { unique: true, name: 'uq_auth_throttle_bucket_dimension_key' },
  );
  await authThrottleBuckets.createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0, name: 'ttl_auth_throttle_bucket' },
  );
  await authThrottleBuckets.createIndex(
    { dimension: 1, expiresAt: 1 },
    { name: 'ix_auth_throttle_bucket_dimension_expiry' },
  );
  await authThrottleBuckets.createIndex(
    { keyVersion: 1, expiresAt: 1 },
    { name: 'ix_auth_throttle_bucket_key_version_expiry' },
  );

  await securityActivityEvents.createIndex(
    { eventId: 1 },
    { unique: true, sparse: true, name: 'uq_security_activity_event_id' },
  );
  await securityActivityEvents.createIndex(
    { createdAt: -1 },
    { name: 'ix_security_activity_created' },
  );
  await securityActivityEvents.createIndex(
    { eventType: 1, createdAt: -1 },
    { name: 'ix_security_activity_type_created' },
  );
  await securityActivityEvents.createIndex(
    { actorType: 1, actorId: 1, createdAt: -1 },
    { name: 'ix_security_activity_actor_created' },
  );
  await securityActivityEvents.createIndex(
    { subjectType: 1, subjectId: 1, createdAt: -1 },
    { name: 'ix_security_activity_subject_created' },
  );
}

export const migration: MigrationDefinition = {
  version: '003',
  name: 'auth-roles-permissions',
  rollbackNotes: [
    'Legacy refresh-family revocation is irreversible: rollback must never restore currentTokenHash, previousTokenHash, or reactivate sessions revoked with security-upgrade-reauth.',
    `Remove only auth_identifiers whose createdBy is ${MIGRATION_ACTOR}, and only after verifying the referenced account still owns the original normalized identifier; never rewrite account, borrowing, staff-action, or security-event history.`,
    'Drop identifier, operation, repair-batch, throttle, and replay-marker indexes only after all upgraded authentication writers and reconciliation workers are disabled.',
    'Drop authVersion, passwordUpdatedAt, and identity-link fields only after all upgraded access credentials have expired or been revoked.',
    'Drop security_activity_events indexes and collection only after audit review requirements are replaced by another durable activity source.',
  ],
  async up({ connection }) {
    const migrationStartedAt = new Date();
    const staffUsers = connection.collection('staffusers');
    const members = connection.collection('members');
    const refreshTokenFamilies = connection.collection(
      'refresh_token_families',
    );
    const securityActivityEvents = connection.collection(
      'security_activity_events',
    );

    await refreshTokenFamilies.updateMany(
      { status: 'active' },
      {
        $set: {
          status: 'revoked',
          revokedAt: migrationStartedAt,
          revokedReason: 'security-upgrade-reauth',
        },
        $unset: { currentTokenHash: '', previousTokenHash: '' },
      },
    );
    await refreshTokenFamilies.updateMany(
      {},
      { $unset: { currentTokenHash: '', previousTokenHash: '' } },
    );

    await staffUsers.updateMany(
      { authVersion: { $exists: false } },
      { $set: { authVersion: 0 } },
    );
    await staffUsers.updateMany(
      {
        passwordHash: { $exists: true },
        passwordUpdatedAt: { $exists: false },
      },
      { $set: { passwordUpdatedAt: migrationStartedAt } },
    );
    await staffUsers.createIndex(
      { identityProvider: 1, identitySubject: 1 },
      { unique: true, sparse: true },
    );
    await staffUsers.createIndex({ status: 1, roles: 1 });

    await members.updateMany(
      { authVersion: { $exists: false } },
      { $set: { authVersion: 0 } },
    );
    await members.createIndex(
      { identityProvider: 1, identitySubject: 1 },
      { unique: true, sparse: true },
    );
    await members.createIndex({ authStatus: 1 });
    await members.createIndex({ status: 1, membershipTypeId: 1 });

    await createAuthIndexes(connection);
    await backfillAuthIdentifiers(
      connection,
      securityActivityEvents,
      migrationStartedAt,
    );
  },
};
