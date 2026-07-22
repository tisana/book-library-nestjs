import {
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
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
import {
  MemberAuthStatus,
  MemberStatus,
} from '../common/enums/library-status.enum';
import {
  containsLiteral,
  equals,
  toMongoObjectId,
} from '../common/mongo/mongo-query.helpers';
import { MembershipTypesService } from '../membership-types/membership-types.service';
import {
  CreateMemberDto,
  MemberPolicyStatusResponseDto,
  MemberQueryDto,
  MemberResponseDto,
  UpdateMemberDto,
} from './dto/member.dto';
import { MemberDocument, MemberModelName } from './schemas/member.schema';
import { MemberSelfServiceProfileDto } from './dto/member-self-service.dto';

const MEMBER_PASSWORD_HASH_ROUNDS = 12;

@Injectable()
export class MembersService {
  constructor(
    @InjectModel(MemberModelName)
    private readonly memberModel: Model<MemberDocument>,
    private readonly membershipTypesService: MembershipTypesService,
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
    dto: CreateMemberDto,
    actor?: AuditActor,
  ): Promise<MemberResponseDto> {
    await this.membershipTypesService.validateActivePolicy(
      dto.membershipTypeId,
    );

    const memberNumber = dto.memberNumber.trim().toUpperCase();
    const modelWithExists = this.memberModel as Model<MemberDocument> & {
      exists?: (filter: Record<string, unknown>) => Promise<unknown>;
    };

    if (
      modelWithExists.exists &&
      (await modelWithExists.exists({ memberNumber: equals(memberNumber) }))
    ) {
      throw new ConflictException('Member number already exists');
    }

    const created = await new this.memberModel({
      memberNumber,
      fullName: dto.fullName,
      email: dto.email?.toLowerCase(),
      phone: dto.phone,
      membershipTypeId: dto.membershipTypeId,
      status: MemberStatus.Active,
      activeLoanCount: dto.activeLoanCount ?? 0,
      authVersion: 0,
      createdBy: actor?.id,
      updatedBy: actor?.id,
    }).save();

    return this.toResponse(created);
  }

  async findAll(
    query: MemberQueryDto = new MemberQueryDto(),
  ): Promise<MemberResponseDto[]> {
    const filter: Record<string, unknown> = {};

    if (query.q) {
      const search = containsLiteral(query.q);
      filter.$or = [
        { memberNumber: search },
        { fullName: search },
        { email: search },
      ];
    }

    if (query.status) {
      filter.status = equals(query.status);
    }

    if (query.membershipTypeId) {
      filter.membershipTypeId = equals(
        toMongoObjectId(query.membershipTypeId, 'membershipTypeId'),
      );
    }

    const members = await this.memberModel
      .find(filter)
      .sort({ memberNumber: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .exec();

    return members.map((member) => this.toResponse(member));
  }

  async findOne(id: string): Promise<MemberResponseDto> {
    return this.toResponse(await this.findDocumentById(id));
  }

  async findSelfServiceProfile(
    id: string,
  ): Promise<MemberSelfServiceProfileDto> {
    const member = await this.findDocumentById(id);
    const membershipType = await this.membershipTypesService.findOne(
      member.membershipTypeId.toString(),
    );

    return {
      id: getMemberId(member),
      memberNumber: member.memberNumber,
      displayName: member.fullName,
      email: member.email,
      phone: member.phone,
      membershipStatus: member.status,
      membershipTypeId: member.membershipTypeId.toString(),
      membershipTypeCode: membershipType.code,
      membershipTypeName: membershipType.name,
      activeLoanCount: member.activeLoanCount,
    };
  }

  async update(
    id: string,
    dto: UpdateMemberDto,
    actor?: AuditActor,
  ): Promise<MemberResponseDto> {
    const member = await this.findDocumentById(id);
    const previousEmail = member.email;
    const nextEmail = dto.email?.trim().toLowerCase();
    const emailChanged =
      nextEmail !== undefined && nextEmail !== (previousEmail ?? undefined);
    const statusChanged = dto.status !== undefined && dto.status !== member.status;

    if (emailChanged && nextEmail) {
      await this.reserveIdentifier(
        nextEmail,
        AuthIdentifierType.Email,
        getMemberId(member),
        actor?.id,
      );
    }

    if (dto.membershipTypeId !== undefined) {
      await this.membershipTypesService.validateActivePolicy(
        dto.membershipTypeId,
      );
      member.membershipTypeId = dto.membershipTypeId;
    }

    if (dto.fullName !== undefined) {
      member.fullName = dto.fullName;
    }

    if (nextEmail !== undefined) {
      member.email = nextEmail;
    }

    if (dto.phone !== undefined) {
      member.phone = dto.phone;
    }

    if (statusChanged) {
      member.status = dto.status;
      member.authVersion = (member.authVersion ?? 0) + 1;
    }

    if (emailChanged) {
      member.authVersion = (member.authVersion ?? 0) + 1;
    }

    if (dto.activeLoanCount !== undefined) {
      member.activeLoanCount = dto.activeLoanCount;
    }

    member.updatedBy = actor?.id;

    try {
      const saved = await member.save();
      if (emailChanged && previousEmail) {
        await this.releaseIdentifier(
          previousEmail,
          getMemberId(member),
          actor?.id,
        );
      }
      if (emailChanged || statusChanged) {
        await this.revokeSessions(getMemberId(member), 'member-account-updated');
      }
      await this.recordMemberChange(member, actor, emailChanged, statusChanged);
      return this.toResponse(saved);
    } catch (error) {
      if (emailChanged && nextEmail) {
        await this.releaseIdentifier(nextEmail, getMemberId(member), actor?.id);
      }
      throw error;
    }
  }

  async getPolicyStatus(id: string): Promise<MemberPolicyStatusResponseDto> {
    const member = await this.findDocumentById(id);
    const membershipType =
      await this.membershipTypesService.validateActivePolicy(
        member.membershipTypeId.toString(),
      );
    const remainingAllowance = Math.max(
      membershipType.maxActiveLoans - member.activeLoanCount,
      0,
    );
    const eligibleByStatus = member.status === MemberStatus.Active;
    const withinLimit = member.activeLoanCount < membershipType.maxActiveLoans;

    return {
      memberId: member.id ?? member._id.toString(),
      status: member.status,
      membershipTypeId: member.membershipTypeId.toString(),
      maxActiveLoans: membershipType.maxActiveLoans,
      activeLoanCount: member.activeLoanCount,
      remainingAllowance,
      eligibleByStatus,
      withinLimit,
      limitReached: !withinLimit,
    };
  }

  async findByLoginIdentifierWithPassword(
    loginIdentifier: string,
  ): Promise<MemberDocument | null> {
    const normalized = this.normalizeLoginIdentifier(loginIdentifier);

    return this.memberModel
      .findOne({
        $or: [
          { loginIdentifier: equals(normalized) },
          { memberNumber: equals(loginIdentifier.trim().toUpperCase()) },
          { email: equals(normalized) },
        ],
      })
      .select('+passwordHash')
      .exec();
  }

  async findActiveById(id: string): Promise<MemberDocument> {
    const member = await this.findDocumentById(id);

    if (
      member.status !== MemberStatus.Active ||
      member.authStatus !== MemberAuthStatus.Active
    ) {
      throw new NotFoundException('Active member not found');
    }

    return member;
  }

  async touchLastLogin(id: string): Promise<void> {
    await this.memberModel.updateOne(
      { _id: equals(toMongoObjectId(id)) },
      { $set: { lastLoginAt: new Date() } },
    );
  }

  async setMemberCredentials(
    id: string,
    loginIdentifier: string,
    password: string,
    actor?: AuditActor,
  ): Promise<MemberResponseDto> {
    const member = await this.findDocumentById(id);
    const previousLoginIdentifier = member.loginIdentifier;
    const normalizedLoginIdentifier =
      this.normalizeLoginIdentifier(loginIdentifier);
    const modelWithExists = this.memberModel as Model<MemberDocument> & {
      exists?: (filter: Record<string, unknown>) => Promise<unknown>;
    };

    if (
      modelWithExists.exists &&
      (await modelWithExists.exists({
        _id: { $ne: member._id },
        loginIdentifier: equals(normalizedLoginIdentifier),
      }))
    ) {
      throw new ConflictException('Member login identifier already exists');
    }

    await this.reserveIdentifier(
      normalizedLoginIdentifier,
      AuthIdentifierType.LoginIdentifier,
      getMemberId(member),
      actor?.id,
    );

    member.loginIdentifier = normalizedLoginIdentifier;
    member.passwordHash = await bcrypt.hash(
      password,
      MEMBER_PASSWORD_HASH_ROUNDS,
    );
    member.passwordUpdatedAt = new Date();
    member.authStatus = MemberAuthStatus.Active;
    member.authVersion = (member.authVersion ?? 0) + 1;
    member.updatedBy = actor?.id;

    try {
      const saved = await member.save();
      if (
        previousLoginIdentifier &&
        previousLoginIdentifier !== normalizedLoginIdentifier
      ) {
        await this.releaseIdentifier(
          previousLoginIdentifier,
          getMemberId(member),
          actor?.id,
        );
      }
      await this.revokeSessions(getMemberId(member), 'member-credentials-updated');
      await this.recordMemberChange(member, actor, true, false);
      return this.toResponse(saved);
    } catch (error) {
      await this.releaseIdentifier(
        normalizedLoginIdentifier,
        getMemberId(member),
        actor?.id,
      );
      throw error;
    }
  }

  private async findDocumentById(id: string): Promise<MemberDocument> {
    const member = await this.memberModel
      .findOne({ _id: equals(toMongoObjectId(id)) })
      .exec();

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    return member;
  }

  async bumpAuthVersion(id: string): Promise<void> {
    await this.memberModel.updateOne(
      { _id: equals(toMongoObjectId(id)) },
      { $inc: { authVersion: 1 } },
    );
  }

  private toResponse(member: MemberDocument): MemberResponseDto {
    return {
      id: member.id ?? member._id.toString(),
      memberNumber: member.memberNumber,
      fullName: member.fullName,
      email: member.email,
      phone: member.phone,
      membershipTypeId: member.membershipTypeId.toString(),
      status: member.status,
      activeLoanCount: member.activeLoanCount,
    };
  }

  private normalizeLoginIdentifier(loginIdentifier: string): string {
    return loginIdentifier.trim().toLowerCase();
  }

  private async reserveIdentifier(
    normalizedIdentifier: string,
    identifierType: AuthIdentifierType,
    subjectId: string,
    actorId = 'system',
  ): Promise<void> {
    if (!this.identifierModel) return;
    const existing = await this.identifierModel
      .findOne({ normalizedIdentifier })
      .exec();
    if (existing) {
      if (
        existing.status === AuthIdentifierStatus.Active &&
        existing.subjectType === AuthIdentifierSubjectType.Member &&
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
            identifierType,
            subjectType: AuthIdentifierSubjectType.Member,
            subjectId,
            updatedBy: actorId,
          },
          $unset: { releasedAt: '' },
        },
      );
      return;
    }
    try {
      await this.identifierModel.create({
        normalizedIdentifier,
        identifierType,
        subjectType: AuthIdentifierSubjectType.Member,
        subjectId,
        status: AuthIdentifierStatus.Active,
        createdBy: actorId,
        updatedBy: actorId,
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: number }).code === 11000
      ) {
        throw new ConflictException('Sign-in identifier is already reserved');
      }
      throw error;
    }
  }

  private async releaseIdentifier(
    normalizedIdentifier: string,
    subjectId: string,
    actorId = 'system',
  ): Promise<void> {
    if (!this.identifierModel) return;
    await this.identifierModel.updateOne(
      {
        normalizedIdentifier,
        subjectType: AuthIdentifierSubjectType.Member,
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
    );
  }

  private async revokeSessions(subjectId: string, reason: string): Promise<void> {
    if (!this.refreshTokenFamilyModel) return;
    await this.refreshTokenFamilyModel.updateMany(
      {
        subjectType: AuthSubjectType.Member,
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

  private async recordMemberChange(
    member: MemberDocument,
    actor: AuditActor | undefined,
    identifierChanged: boolean,
    statusChanged: boolean,
  ): Promise<void> {
    if (!this.securityActivityService) return;
    const common = {
      actorType: actor
        ? SecurityActivityActorType.Staff
        : SecurityActivityActorType.System,
      actorId: actor?.id,
      targetType: 'member',
      targetId: getMemberId(member),
      subjectType: 'member',
      subjectId: getMemberId(member),
      outcome: SecurityActivityOutcome.Success,
    };
    if (identifierChanged) {
      await this.securityActivityService.record({
        ...common,
        eventType: SecurityActivityEventType.IdentifierReservationRecovered,
        reasonCategory: 'member-identifier-updated',
      });
    }
    if (statusChanged) {
      await this.securityActivityService.record({
        ...common,
        eventType: SecurityActivityEventType.AccountStatusChanged,
        reasonCategory: 'member-status-updated',
      });
    }
  }
}

export function getMemberId(member: Partial<MemberDocument>): string {
  const maybeObjectId = member._id as { toString?: () => string } | undefined;
  return member.id ?? maybeObjectId?.toString?.() ?? '';
}
