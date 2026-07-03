import { MigrationDefinition } from '../migrate';

export const migration: MigrationDefinition = {
  version: '003',
  name: 'auth-roles-permissions',
  rollbackNotes: [
    'Drop authVersion, passwordUpdatedAt, and identity-link fields only after all tokens issued with auth_version have expired or been revoked.',
    'Drop refresh_token_families indexes and collection only after refresh-token rotation is disabled and outstanding refresh cookies are invalidated.',
    'Drop security_activity_events indexes and collection only after audit review requirements are replaced by another durable activity source.',
    'Drop identityProvider/identitySubject indexes only after future external IdP linking is disabled or migrated.',
  ],
  async up({ connection }) {
    const staffUsers = connection.collection('staffusers');
    const members = connection.collection('members');
    const refreshTokenFamilies = connection.collection(
      'refresh_token_families',
    );
    const securityActivityEvents = connection.collection(
      'security_activity_events',
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
      { $set: { passwordUpdatedAt: new Date() } },
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

    await refreshTokenFamilies.createIndex({ familyId: 1 }, { unique: true });
    await refreshTokenFamilies.createIndex(
      { currentTokenHash: 1 },
      { unique: true, sparse: true },
    );
    await refreshTokenFamilies.createIndex({
      subjectType: 1,
      subjectId: 1,
      status: 1,
    });
    await refreshTokenFamilies.createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0 },
    );

    await securityActivityEvents.createIndex({ createdAt: -1 });
    await securityActivityEvents.createIndex({
      eventType: 1,
      createdAt: -1,
    });
    await securityActivityEvents.createIndex({
      actorType: 1,
      actorId: 1,
      createdAt: -1,
    });
    await securityActivityEvents.createIndex({
      subjectType: 1,
      subjectId: 1,
      createdAt: -1,
    });
  },
};
