import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditActor } from '../common/audit/audit-context';
import { LibraryItemStatus } from '../common/enums/library-status.enum';
import { equals, toMongoObjectId } from '../common/mongo/mongo-query.helpers';
import {
  CreateMembershipTypeDto,
  MembershipTypeQueryDto,
  MembershipTypeResponseDto,
  UpdateMembershipTypeDto,
} from './dto/membership-type.dto';
import {
  MembershipTypeDocument,
  MembershipTypeModelName,
} from './schemas/membership-type.schema';

@Injectable()
export class MembershipTypesService {
  constructor(
    @InjectModel(MembershipTypeModelName)
    private readonly membershipTypeModel: Model<MembershipTypeDocument>,
  ) {}

  async create(
    dto: CreateMembershipTypeDto,
    actor?: AuditActor,
  ): Promise<MembershipTypeResponseDto> {
    const code = this.normalizeCode(dto.code);
    const modelWithExists = this.membershipTypeModel as Model<MembershipTypeDocument> & {
      exists?: (filter: Record<string, unknown>) => Promise<unknown>;
    };

    if (
      modelWithExists.exists &&
      (await modelWithExists.exists({ code: equals(code) }))
    ) {
      throw new ConflictException('Membership type code already exists');
    }

    const created = await new this.membershipTypeModel({
      code,
      name: dto.name,
      maxActiveLoans: dto.maxActiveLoans,
      status: LibraryItemStatus.Active,
      createdBy: actor?.id,
      updatedBy: actor?.id,
    }).save();

    return this.toResponse(created);
  }

  async findAll(
    query: MembershipTypeQueryDto = new MembershipTypeQueryDto(),
  ): Promise<MembershipTypeResponseDto[]> {
    const filter: Record<string, unknown> = {};

    if (query.status) {
      filter.status = equals(query.status);
    }

    const membershipTypes = await this.membershipTypeModel
      .find(filter)
      .sort({ code: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .exec();

    return membershipTypes.map((membershipType) =>
      this.toResponse(membershipType),
    );
  }

  async findOne(id: string): Promise<MembershipTypeResponseDto> {
    return this.toResponse(await this.findDocumentById(id));
  }

  async update(
    id: string,
    dto: UpdateMembershipTypeDto,
    actor?: AuditActor,
  ): Promise<MembershipTypeResponseDto> {
    const membershipType = await this.findDocumentById(id);

    if (dto.name !== undefined) {
      membershipType.name = dto.name;
    }

    if (dto.maxActiveLoans !== undefined) {
      membershipType.maxActiveLoans = dto.maxActiveLoans;
    }

    if (dto.status !== undefined) {
      membershipType.status = dto.status;
    }

    membershipType.updatedBy = actor?.id;

    return this.toResponse(await membershipType.save());
  }

  async validateActivePolicy(id: string): Promise<MembershipTypeResponseDto> {
    const membershipType = await this.findDocumentById(id);

    if (membershipType.status !== LibraryItemStatus.Active) {
      throw new ConflictException('Membership type is not active');
    }

    return this.toResponse(membershipType);
  }

  private async findDocumentById(id: string): Promise<MembershipTypeDocument> {
    const membershipType = await this.membershipTypeModel
      .findOne({ _id: equals(toMongoObjectId(id)) })
      .exec();

    if (!membershipType) {
      throw new NotFoundException('Membership type not found');
    }

    return membershipType;
  }

  private normalizeCode(code: string): string {
    return code.trim().toUpperCase();
  }

  private toResponse(
    membershipType: MembershipTypeDocument,
  ): MembershipTypeResponseDto {
    return {
      id: membershipType.id ?? membershipType._id.toString(),
      code: membershipType.code,
      name: membershipType.name,
      maxActiveLoans: membershipType.maxActiveLoans,
      status: membershipType.status,
    };
  }
}
