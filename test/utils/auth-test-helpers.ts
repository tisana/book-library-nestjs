import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

import { StaffRole } from '../../src/common/enums/library-status.enum';

export interface AuthTestUserInput {
  email: string;
  password: string;
  displayName?: string;
  roles: StaffRole[];
}

export interface AuthenticatedTestUser {
  accessToken: string;
  user: {
    id: string;
    email: string;
    displayName?: string;
    roles: StaffRole[];
  };
}

export const adminTestUser: AuthTestUserInput = {
  email: 'admin@example.com',
  password: 'correct-horse-battery-staple',
  displayName: 'Admin User',
  roles: [StaffRole.Admin],
};

export const staffTestUser: AuthTestUserInput = {
  email: 'staff@example.com',
  password: 'correct-horse-battery-staple',
  displayName: 'Staff User',
  roles: [StaffRole.Staff],
};

export async function loginAs(
  app: INestApplication,
  credentials: Pick<AuthTestUserInput, 'email' | 'password'>,
): Promise<AuthenticatedTestUser> {
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send(credentials)
    .expect(200);

  return response.body as AuthenticatedTestUser;
}

export function authHeader(
  user: Pick<AuthenticatedTestUser, 'accessToken'>,
): string {
  return `Bearer ${user.accessToken}`;
}

export async function authenticatedRequest(
  app: INestApplication,
  user: Pick<AuthenticatedTestUser, 'accessToken'>,
) {
  return request(app.getHttpServer()).set('Authorization', authHeader(user));
}
