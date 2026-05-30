import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class PasswordHasherService {
  hash(rawPassword: string): Promise<string> {
    return bcrypt.hash(rawPassword, 12);
  }

  verify(passwordHash: string, rawPassword: string): Promise<boolean> {
    return bcrypt.compare(rawPassword, passwordHash);
  }
}
