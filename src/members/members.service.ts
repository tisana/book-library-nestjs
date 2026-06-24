import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
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

    if (dto.membershipTypeId !== undefined) {
      await this.membershipTypesService.validateActivePolicy(
        dto.membershipTypeId,
      );
      member.membershipTypeId = dto.membershipTypeId;
    }

    if (dto.fullName !== undefined) {
      member.fullName = dto.fullName;
    }

    if (dto.email !== undefined) {
      member.email = dto.email.toLowerCase();
    }

    if (dto.phone !== undefined) {
      member.phone = dto.phone;
    }

    if (dto.status !== undefined) {
      member.status = dto.status;
    }

    if (dto.activeLoanCount !== undefined) {
      member.activeLoanCount = dto.activeLoanCount;
    }

    member.updatedBy = actor?.id;

    return this.toResponse(await member.save());
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

    member.loginIdentifier = normalizedLoginIdentifier;
    member.passwordHash = await bcrypt.hash(
      password,
      MEMBER_PASSWORD_HASH_ROUNDS,
    );
    member.passwordUpdatedAt = new Date();
    member.authStatus = MemberAuthStatus.Active;
    member.updatedBy = actor?.id;

    return this.toResponse(await member.save());
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
}

export function getMemberId(member: Partial<MemberDocument>): string {
  const maybeObjectId = member._id as { toString?: () => string } | undefined;
  return member.id ?? maybeObjectId?.toString?.() ?? '';
}
