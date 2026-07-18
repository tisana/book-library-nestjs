import {
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { PasswordHasherService } from '../auth/password-hasher.service';
import {
  AuthIdentifierDocument,
  AuthIdentifierModelName,
  AuthIdentifierStatus,
  AuthIdentifierSubjectType,
  AuthIdentifierType,
} from '../auth/schemas/auth-identifier.schema';
import {
  AuthSubjectType,
  RefreshTokenFamilyDocument,
  RefreshTokenFamilyModelName,
  RefreshTokenFamilyStatus,
} from '../auth/schemas/refresh-token-family.schema';
import {
  SecurityActivityActorType,
  SecurityActivityEventType,
  SecurityActivityOutcome,
} from '../auth/schemas/security-activity-event.schema';
import { SecurityActivityService } from '../auth/security-activity.service';
import { AuditActor } from '../common/audit/audit-context';
import { permissionsForStaffRoles } from '../common/enums/auth-permission.enum';
import {
  StaffRole,
  StaffUserStatus,
} from '../common/enums/library-status.enum';
import { equals, toMongoObjectId } from '../common/mongo/mongo-query.helpers';
import {
  CreateStaffUserDto,
  StaffUserQueryDto,
  StaffUserResponseDto,
  UpdateStaffUserDto,
} from './dto/staff-user.dto';
import {
  StaffUserDocument,
  StaffUserModelName,
} from './schemas/staff-user.schema';

const approvedRoles = new Set(Object.values(StaffRole));

@Injectable()
export class StaffUsersService {
  constructor(
    @InjectModel(StaffUserModelName)
    private readonly staffUserModel: Model<StaffUserDocument>,
    private readonly passwordHasher: PasswordHasherService,
    @Optional()
    @InjectModel(AuthIdentifierModelName)
    private readonly identifierModel?: Model<AuthIdentifierDocument>,
    @Optional()
    @InjectModel(RefreshTokenFamilyModelName)
    private readonly refreshTokenFamilyModel?: Model<RefreshTokenFamilyDocument>,
    @Optional()
    private readonly securityActivityService?: SecurityActivityService,
  ) {}

  async create(
    dto: CreateStaffUserDto,
    actor?: AuditActor,
  ): Promise<StaffUserResponseDto> {
    const email = this.normalizeEmail(dto.email);
    const roles = this.validateRoles(dto.roles);
    const modelWithExists = this.staffUserModel as Model<StaffUserDocument> & {
      exists?: (filter: Record<string, unknown>) => Promise<unknown>;
    };

    if (
      modelWithExists.exists &&
      (await modelWithExists.exists({ email: equals(email) }))
    ) {
      throw new ConflictException('Staff user email already exists');
    }

    const passwordHash = await this.passwordHasher.hash(dto.password);
    const subjectId = new Types.ObjectId();
    const document = new this.staffUserModel({
      _id: subjectId,
      email,
      displayName: dto.displayName,
      passwordHash,
      roles,
      status: StaffUserStatus.Active,
      authVersion: 0,
      passwordUpdatedAt: new Date(),
      createdBy: actor?.id,
      updatedBy: actor?.id,
    });

    const created = await this.persistCreateWithIdentifier(
      document,
      email,
      subjectId.toString(),
      actor?.id,
    );

    return this.toResponse(created);
  }

  async update(
    id: string,
    dto: UpdateStaffUserDto,
    actor?: AuditActor,
  ): Promise<StaffUserResponseDto> {
    const user = await this.findDocumentById(id);
    const previousEmail = user.email;
    const previousRoles = [...(user.roles ?? [])];
    const previousStatus = user.status;
    const nextEmail =
      dto.email === undefined ? previousEmail : this.normalizeEmail(dto.email);
    const nextRoles =
      dto.roles === undefined ? previousRoles : this.validateRoles(dto.roles);
    const emailChanged = nextEmail !== previousEmail;
    const rolesChanged = !this.sameRoles(previousRoles, nextRoles);
    const statusChanged = dto.status !== undefined && dto.status !== previousStatus;

    const applyUpdates = () => {
      user.email = nextEmail;
      user.roles = nextRoles;
      if (dto.displayName !== undefined) user.displayName = dto.displayName;
      if (dto.status !== undefined) user.status = dto.status;
      if (rolesChanged || statusChanged || emailChanged) {
        user.authVersion = (user.authVersion ?? 0) + 1;
      }
      user.updatedBy = actor?.id;
    };

    if (emailChanged && this.identifierModel) {
      await this.persistIdentifierChange(
        user,
        previousEmail,
        nextEmail,
        actor?.id,
        applyUpdates,
      );
    } else {
      applyUpdates();
      await user.save();
    }

    if (rolesChanged || statusChanged || emailChanged) {
      await this.revokeSessions(getStaffUserId(user), 'staff-account-updated');
    }
    await this.recordChanges(
      user,
      actor,
      previousRoles,
      previousStatus,
      rolesChanged,
      statusChanged,
    );

    return this.toResponse(user);
  }

  async findAll(query: StaffUserQueryDto): Promise<StaffUserResponseDto[]> {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = equals(query.status);
    if (query.role) filter.roles = equals(query.role);

    const users = await this.staffUserModel
      .find(filter)
      .sort({ email: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .exec();
    return users.map((user) => this.toResponse(user));
  }

  async findByEmailWithPassword(
    email: string,
  ): Promise<StaffUserDocument | null> {
    return this.staffUserModel
      .findOne({ email: equals(this.normalizeEmail(email)) })
      .select('+passwordHash')
      .exec();
  }

  async findActiveById(id: string): Promise<StaffUserDocument> {
    const user = await this.findDocumentById(id);
    if (user.status !== StaffUserStatus.Active) {
      throw new NotFoundException('Active staff user not found');
    }
    return user;
  }

  async touchLastLogin(id: string): Promise<void> {
    await this.staffUserModel.updateOne(
      { _id: equals(toMongoObjectId(id)) },
      { $set: { lastLoginAt: new Date() } },
    );
  }

  async bumpAuthVersion(id: string): Promise<void> {
    await this.staffUserModel.updateOne(
      { _id: equals(toMongoObjectId(id)) },
      { $inc: { authVersion: 1 } },
    );
  }

  toResponse(
    user: Partial<StaffUserDocument> & { id?: string },
  ): StaffUserResponseDto {
    const maybeObjectId = user._id as { toString?: () => string } | undefined;
    const roles = user.roles ?? [StaffRole.Staff];
    return {
      id: user.id ?? maybeObjectId?.toString?.() ?? '',
      email: user.email ?? '',
      displayName: user.displayName ?? '',
      roles,
      permissions: permissionsForStaffRoles(roles),
      status: user.status,
      lastLoginAt: user.lastLoginAt,
    };
  }

  private async findDocumentById(id: string): Promise<StaffUserDocument> {
    const user = await this.staffUserModel
      .findOne({ _id: equals(toMongoObjectId(id)) })
      .exec();
    if (!user) throw new NotFoundException('Staff user not found');
    return user;
  }

  private async persistCreateWithIdentifier(
    document: StaffUserDocument,
    email: string,
    subjectId: string,
    actorId?: string,
  ): Promise<StaffUserDocument> {
    if (!this.identifierModel) return document.save();

    const session = await this.startSession();
    if (session) {
      try {
        let created: StaffUserDocument | undefined;
        await session.withTransaction(async () => {
          await this.reserveIdentifier(email, subjectId, actorId, session);
          created = await document.save({ session });
        });
        if (created) return created;
      } catch (error) {
        if (!this.isTransactionUnavailable(error)) throw this.identifierError(error);
      } finally {
        await session.endSession();
      }
    }

    await this.reserveIdentifier(email, subjectId, actorId);
    try {
      return await document.save();
    } catch (error) {
      await this.releaseIdentifier(email, subjectId, actorId);
      throw error;
    }
  }

  private async persistIdentifierChange(
    user: StaffUserDocument,
    previousEmail: string,
    nextEmail: string,
    actorId: string | undefined,
    applyUpdates: () => void,
  ): Promise<void> {
    const subjectId = getStaffUserId(user);
    const session = await this.startSession();
    if (session) {
      try {
        let completed = false;
        await session.withTransaction(async () => {
          await this.reserveIdentifier(nextEmail, subjectId, actorId, session);
          applyUpdates();
          await user.save({ session });
          await this.releaseIdentifier(previousEmail, subjectId, actorId, session);
          completed = true;
        });
        if (completed) return;
      } catch (error) {
        if (!this.isTransactionUnavailable(error)) throw this.identifierError(error);
      } finally {
        await session.endSession();
      }
    }

    await this.reserveIdentifier(nextEmail, subjectId, actorId);
    try {
      applyUpdates();
      await user.save();
      await this.releaseIdentifier(previousEmail, subjectId, actorId);
    } catch (error) {
      await this.releaseIdentifier(nextEmail, subjectId, actorId);
      throw error;
    }
  }

  private async reserveIdentifier(
    normalizedIdentifier: string,
    subjectId: string,
    actorId = 'system',
    session?: ClientSession,
  ): Promise<void> {
    if (!this.identifierModel) return;
    const existing = await this.identifierModel
      .findOne({ normalizedIdentifier })
      .session(session ?? null)
      .exec();
    if (existing) {
      if (
        existing.status === AuthIdentifierStatus.Active &&
        existing.subjectType === AuthIdentifierSubjectType.Staff &&
        existing.subjectId === subjectId
      ) {
        return;
      }
      if (existing.status !== AuthIdentifierStatus.Released) {
        throw new ConflictException('Sign-in identifier is already reserved');
      }
      await this.identifierModel.updateOne(
        { _id: existing._id, status: AuthIdentifierStatus.Released },
        {
          $set: {
            status: AuthIdentifierStatus.Active,
            subjectType: AuthIdentifierSubjectType.Staff,
            subjectId,
            updatedBy: actorId,
          },
          $unset: { releasedAt: '' },
        },
        { session },
      );
      return;
    }

    try {
      await this.identifierModel.create(
        [
          {
            normalizedIdentifier,
            identifierType: AuthIdentifierType.Email,
            subjectType: AuthIdentifierSubjectType.Staff,
            subjectId,
            status: AuthIdentifierStatus.Active,
            createdBy: actorId,
            updatedBy: actorId,
          },
        ],
        { session },
      );
    } catch (error) {
      throw this.identifierError(error);
    }
  }

  private async releaseIdentifier(
    normalizedIdentifier: string,
    subjectId: string,
    actorId = 'system',
    session?: ClientSession,
  ): Promise<void> {
    if (!this.identifierModel) return;
    await this.identifierModel.updateOne(
      {
        normalizedIdentifier,
        subjectType: AuthIdentifierSubjectType.Staff,
        subjectId,
        status: AuthIdentifierStatus.Active,
      },
      {
        $set: {
          status: AuthIdentifierStatus.Released,
          releasedAt: new Date(),
          updatedBy: actorId,
        },
      },
      { session },
    );
  }

  private async startSession(): Promise<ClientSession | undefined> {
    const startSession = this.staffUserModel.db?.startSession;
    if (!startSession) return undefined;
    try {
      return await startSession.call(this.staffUserModel.db);
    } catch {
      return undefined;
    }
  }

  private async revokeSessions(subjectId: string, reason: string): Promise<void> {
    if (!this.refreshTokenFamilyModel) return;
    await this.refreshTokenFamilyModel.updateMany(
      {
        subjectType: AuthSubjectType.Staff,
        subjectId,
        status: RefreshTokenFamilyStatus.Active,
      },
      {
        $set: {
          status: RefreshTokenFamilyStatus.Revoked,
          revokedAt: new Date(),
          revokedReason: reason,
        },
        $unset: { currentTokenHash: '', previousTokenHash: '' },
      },
    );
  }

  private async recordChanges(
    user: StaffUserDocument,
    actor: AuditActor | undefined,
    previousRoles: StaffRole[],
    previousStatus: StaffUserStatus,
    rolesChanged: boolean,
    statusChanged: boolean,
  ): Promise<void> {
    if (!this.securityActivityService) return;
    const actorType = actor
      ? SecurityActivityActorType.Staff
      : SecurityActivityActorType.System;
    if (rolesChanged) {
      await this.securityActivityService.record({
        eventType: SecurityActivityEventType.RoleChanged,
        actorType,
        actorId: actor?.id,
        targetType: 'staff-user',
        targetId: getStaffUserId(user),
        subjectType: 'staff',
        subjectId: getStaffUserId(user),
        outcome: SecurityActivityOutcome.Success,
        reasonCategory: 'staff-roles-updated',
        context: { previousRoles, roles: user.roles },
      });
    }
    if (statusChanged) {
      await this.securityActivityService.record({
        eventType: SecurityActivityEventType.AccountStatusChanged,
        actorType,
        actorId: actor?.id,
        targetType: 'staff-user',
        targetId: getStaffUserId(user),
        subjectType: 'staff',
        subjectId: getStaffUserId(user),
        outcome: SecurityActivityOutcome.Success,
        reasonCategory: 'staff-status-updated',
        context: { previousStatus, status: user.status },
      });
    }
  }

  private validateRoles(roles: readonly StaffRole[]): StaffRole[] {
    const unique = Array.from(new Set(roles));
    if (!unique.length || unique.some((role) => !approvedRoles.has(role))) {
      throw new UnprocessableEntityException('Only approved staff roles are allowed');
    }
    return unique;
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private sameRoles(left: StaffRole[], right: StaffRole[]): boolean {
    return [...left].sort().join('|') === [...right].sort().join('|');
  }

  private identifierError(error: unknown): Error {
    if (
      error instanceof ConflictException ||
      (typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: number }).code === 11000)
    ) {
      return new ConflictException('Sign-in identifier is already reserved');
    }
    return error instanceof Error ? error : new Error('Identifier update failed');
  }

  private isTransactionUnavailable(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /transaction|replica set|mongos/i.test(message);
  }
}

export function getStaffUserId(user: Partial<StaffUserDocument>): string {
  const maybeObjectId = user._id as { toString?: () => string } | undefined;
  return user.id ?? maybeObjectId?.toString?.() ?? '';
}
