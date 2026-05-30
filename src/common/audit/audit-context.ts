import { StaffRole } from '../enums/library-status.enum';

export interface AuditActor {
  id: string;
  email: string;
  displayName?: string;
  roles: StaffRole[];
}

export interface AuditContext {
  actor: AuditActor;
  requestedAt: Date;
}

export function createAuditContext(
  actor: AuditActor,
  requestedAt = new Date(),
): AuditContext {
  return {
    actor,
    requestedAt,
  };
}
