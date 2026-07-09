import { UnauthorizedException } from '@nestjs/common';
import {
  AuthSubjectType,
  RefreshTokenFamilyStatus,
} from './schemas/refresh-token-family.schema';
import { TokenSessionService } from './token-session.service';

class FakeRefreshTokenFamilyModel {
  documents: any[] = [];

  async create(document: any) {
    const stored = this.withSave({ ...document });
    this.documents.push(stored);
    return stored;
  }

  findOne(filter: Record<string, any>) {
    const document = this.documents.find((candidate) =>
      Object.entries(filter).every(([key, expected]) => {
        if (expected && typeof expected === 'object' && '$gt' in expected) {
          return candidate[key] > expected.$gt;
        }

        return candidate[key] === expected;
      }),
    );

    return { exec: async () => document };
  }

  async updateMany(filter: Record<string, any>, update: Record<string, any>) {
    this.documents
      .filter((candidate) =>
        Object.entries(filter).every(
          ([key, expected]) => candidate[key] === expected,
        ),
      )
      .forEach((candidate) => Object.assign(candidate, update.$set));
  }

  private withSave(document: any) {
    return {
      ...document,
      save: jest.fn(async () => document),
    };
  }
}

describe('TokenSessionService', () => {
  let model: FakeRefreshTokenFamilyModel;
  let service: TokenSessionService;

  beforeEach(() => {
    model = new FakeRefreshTokenFamilyModel();
    service = new TokenSessionService(model as any);
  });

  it('stores only refresh token hashes when creating a family', async () => {
    const result = await service.createFamily({
      clientId: 'web',
      subjectType: AuthSubjectType.Staff,
      subjectId: 'staff-user-id',
      scopes: ['catalog:read'],
      authVersion: 0,
      ttlSeconds: 60,
    });

    expect(result.refreshToken).toEqual(expect.any(String));
    expect(model.documents[0].currentTokenHash).toHaveLength(64);
    expect(model.documents[0].currentTokenHash).not.toBe(result.refreshToken);
  });

  it('rotates refresh tokens and preserves the previous hash', async () => {
    const created = await service.createFamily({
      clientId: 'web',
      subjectType: AuthSubjectType.Staff,
      subjectId: 'staff-user-id',
      scopes: ['catalog:read'],
      authVersion: 0,
      ttlSeconds: 60,
    });

    const rotated = await service.rotate(created.refreshToken);

    expect(rotated.refreshToken).not.toBe(created.refreshToken);
    expect(model.documents[0].previousTokenHash).toBe(
      service.hashRefreshToken(created.refreshToken),
    );
    expect(model.documents[0].currentTokenHash).toBe(
      service.hashRefreshToken(rotated.refreshToken),
    );
  });

  it('marks a family replayed when a previous refresh token is reused', async () => {
    const created = await service.createFamily({
      clientId: 'web',
      subjectType: AuthSubjectType.Staff,
      subjectId: 'staff-user-id',
      scopes: ['catalog:read'],
      authVersion: 0,
      ttlSeconds: 60,
    });

    await service.rotate(created.refreshToken);

    await expect(service.rotate(created.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(model.documents[0].status).toBe(RefreshTokenFamilyStatus.Replayed);
    expect(model.documents[0].revokedReason).toBe('refresh-token-replay');
  });
});
