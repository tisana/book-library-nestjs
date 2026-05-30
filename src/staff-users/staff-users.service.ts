import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PasswordHasherService } from '../auth/password-hasher.service';
import { AuditActor } from '../common/audit/audit-context';
import {
  StaffRole,
  StaffUserStatus,
} from '../common/enums/library-status.enum';
import {
  CreateStaffUserDto,
  StaffUserQueryDto,
  StaffUserResponseDto,
} from './dto/staff-user.dto';
import {
  StaffUserDocument,
  StaffUserModelName,
} from './schemas/staff-user.schema';

@Injectable()
export class StaffUsersService {
  constructor(
    @InjectModel(StaffUserModelName)
    private readonly staffUserModel: Model<StaffUserDocument>,
    private readonly passwordHasher: PasswordHasherService,
  ) {}

  async create(
    dto: CreateStaffUserDto,
    actor?: AuditActor,
  ): Promise<StaffUserResponseDto> {
    const email = dto.email.toLowerCase();
    const modelWithExists = this.staffUserModel as Model<StaffUserDocument> & {
      exists?: (filter: Record<string, unknown>) => Promise<unknown>;
    };

    if (modelWithExists.exists && (await modelWithExists.exists({ email }))) {
      throw new ConflictException('Staff user email already exists');
    }

    const passwordHash = await this.passwordHasher.hash(dto.password);
    const created = await new this.staffUserModel({
      email,
      displayName: dto.displayName,
      passwordHash,
      roles: dto.roles,
      status: StaffUserStatus.Active,
      createdBy: actor?.id,
      updatedBy: actor?.id,
    }).save();

    return this.toResponse(created);
  }

  async findAll(query: StaffUserQueryDto): Promise<StaffUserResponseDto[]> {
    const filter: Record<string, unknown> = {};

    if (query.status) {
      filter.status = query.status;
    }

    if (query.role) {
      filter.roles = query.role;
    }

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
      .findOne({ email: email.toLowerCase() })
      .select('+passwordHash')
      .exec();
  }

  async findActiveById(id: string): Promise<StaffUserDocument> {
    const user = await this.staffUserModel.findById(id).exec();

    if (!user || user.status !== StaffUserStatus.Active) {
      throw new NotFoundException('Active staff user not found');
    }

    return user;
  }

  async touchLastLogin(id: string): Promise<void> {
    await this.staffUserModel.updateOne(
      { _id: id },
      { $set: { lastLoginAt: new Date() } },
    );
  }

  toResponse(user: Partial<StaffUserDocument> & { id?: string }): StaffUserResponseDto {
    const maybeObjectId = user._id as { toString?: () => string } | undefined;

    return {
      id: user.id ?? maybeObjectId?.toString?.() ?? '',
      email: user.email ?? '',
      displayName: user.displayName ?? '',
      roles: user.roles ?? [StaffRole.Staff],
      status: user.status,
      lastLoginAt: user.lastLoginAt,
    };
  }
}

export function getStaffUserId(user: Partial<StaffUserDocument>): string {
  const maybeObjectId = user._id as { toString?: () => string } | undefined;
  return user.id ?? maybeObjectId?.toString?.() ?? '';
}
