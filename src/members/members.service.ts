import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditActor } from '../common/audit/audit-context';
import { MemberStatus } from '../common/enums/library-status.enum';
import { MembershipTypesService } from '../membership-types/membership-types.service';
import {
  CreateMemberDto,
  MemberPolicyStatusResponseDto,
  MemberQueryDto,
  MemberResponseDto,
  UpdateMemberDto,
} from './dto/member.dto';
import { MemberDocument, MemberModelName } from './schemas/member.schema';

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
    await this.membershipTypesService.validateActivePolicy(dto.membershipTypeId);

    const memberNumber = dto.memberNumber.trim().toUpperCase();
    const modelWithExists = this.memberModel as Model<MemberDocument> & {
      exists?: (filter: Record<string, unknown>) => Promise<unknown>;
    };

    if (
      modelWithExists.exists &&
      (await modelWithExists.exists({ memberNumber }))
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

  async findAll(query: MemberQueryDto = new MemberQueryDto()): Promise<MemberResponseDto[]> {
    const filter: Record<string, unknown> = {};

    if (query.q) {
      filter.$or = [
        { memberNumber: new RegExp(query.q, 'i') },
        { fullName: new RegExp(query.q, 'i') },
        { email: new RegExp(query.q, 'i') },
      ];
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.membershipTypeId) {
      filter.membershipTypeId = query.membershipTypeId;
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

  private async findDocumentById(id: string): Promise<MemberDocument> {
    const member = await this.memberModel.findById(id).exec();

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
}
