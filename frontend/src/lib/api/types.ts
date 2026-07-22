export type RoleArea = 'staff' | 'member';

export type StaffRole = 'admin' | 'staff';
export type AuthPermission =
  | 'catalog:read'
  | 'catalog:manage'
  | 'members:read'
  | 'members:manage'
  | 'membership-types:read'
  | 'membership-types:manage'
  | 'borrowings:read'
  | 'borrowings:manage'
  | 'staff-users:read'
  | 'staff-users:manage'
  | 'roles:read'
  | 'roles:manage'
  | 'security-events:read'
  | 'auth-identifiers:read'
  | 'auth-identifiers:manage'
  | 'member:self:read';
export type LibraryStatus = 'active' | 'deactivated';
export type MemberStatus = 'active' | 'suspended' | 'inactive';
export type MemberAuthStatus = 'active' | 'locked' | 'reset-required';
export type LoanState = 'active' | 'returned' | 'overdue';

export interface ApiErrorPayload {
  statusCode: number;
  message: string | string[];
  error?: string;
}

export interface NormalizedApiError {
  status: number;
  message: string;
  details?: ApiErrorPayload;
}

export interface StaffLoginRequest {
  email: string;
  password: string;
}

export interface MemberLoginRequest {
  loginIdentifier: string;
  password: string;
}

export interface SharedLoginRequest {
  identifier: string;
  password: string;
}

export interface StaffSessionUser {
  id: string;
  email: string;
  displayName: string;
  roles: StaffRole[];
  permissions: AuthPermission[];
  roleArea: 'staff';
}

export interface MemberSessionUser {
  id: string;
  memberNumber: string;
  displayName: string;
  email?: string;
  membershipStatus: MemberStatus;
  membershipTypeId?: string;
  membershipTypeCode?: string;
  membershipTypeName?: string;
  permissions: AuthPermission[];
  roleArea: 'member';
}

export type SessionUser = StaffSessionUser | MemberSessionUser;

export interface AuthTokenMetadata {
  tokenType: 'Bearer';
  expiresIn: number;
  scope: string;
  permissions: AuthPermission[];
  issuer?: string;
  audience?: string | string[];
  authVersion?: number;
}

export interface RefreshCookieSettings {
  httpOnly: true;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  path: string;
  maxAgeSeconds?: number;
}

export interface LoginResponse<TUser extends SessionUser = SessionUser> {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  scope: string;
  permissions: AuthPermission[];
  issuer?: string;
  audience?: string | string[];
  authVersion?: number;
  refreshCookie?: RefreshCookieSettings;
  user?: StaffSessionUser;
  member?: MemberSessionUser;
  principal?: TUser;
}

export interface StaffLoginResponse extends LoginResponse<StaffSessionUser> {
  roleArea: 'staff';
  user: StaffSessionUser;
  member?: never;
}

export interface MemberLoginResponse extends LoginResponse<MemberSessionUser> {
  roleArea: 'member';
  member: MemberSessionUser;
  user?: never;
}

export type SharedLoginResponse = StaffLoginResponse | MemberLoginResponse;

export interface CurrentAuthResponse {
  roleArea: RoleArea;
  user?: StaffSessionUser;
  member?: MemberSessionUser;
  permissions?: AuthPermission[];
}

export type StaffUserStatus = 'active' | 'suspended' | 'inactive';

export interface StaffUserView {
  id: string;
  email: string;
  displayName: string;
  roles: StaffRole[];
  permissions: AuthPermission[];
  status: StaffUserStatus;
  lastLoginAt?: string;
}

export interface RolePermissionReview {
  role: StaffRole;
  permissions: AuthPermission[];
}

export interface CreateStaffUserInput {
  email: string;
  displayName: string;
  password: string;
  roles: StaffRole[];
}

export interface UpdateStaffUserInput {
  email?: string;
  displayName?: string;
  roles?: StaffRole[];
  status?: StaffUserStatus;
}

export type AuthIdentifierSubjectType = 'staff' | 'member';
export type AuthIdentifierResolutionStatus =
  | 'reviewable'
  | 'manual-repair-required';
export type AuthIdentifierOperationState =
  | 'pending'
  | 'applying'
  | 'compensating'
  | 'finalizing'
  | 'failed-retryable'
  | 'completed'
  | 'failed-terminal';

export interface AuthIdentifierSubjectView {
  subjectType: AuthIdentifierSubjectType;
  subjectId: string;
  displayLabel: string;
}

export interface AuthIdentifierConflictView {
  id: string;
  normalizedIdentifier: string;
  resolutionStatus: AuthIdentifierResolutionStatus;
  subjects: AuthIdentifierSubjectView[];
}

export interface AuthIdentifierReassignmentInput {
  subjectType: AuthIdentifierSubjectType;
  subjectId: string;
  newIdentifier: string;
}

export interface ResolveAuthIdentifierConflictInput {
  operationId: string;
  retainedSubject?: Pick<
    AuthIdentifierSubjectView,
    'subjectType' | 'subjectId'
  >;
  reassignments: AuthIdentifierReassignmentInput[];
}

export interface AuthIdentifierResolutionResult {
  operationId: string;
  status: 'completed' | 'failed-terminal';
  replayed: boolean;
  outcome: 'success' | 'failure';
  reasonCategory: string;
}

export interface AuthIdentifierOperationView {
  operationId: string;
  status: AuthIdentifierOperationState;
  subjects: Array<{
    subjectType: AuthIdentifierSubjectType;
    subjectId: string;
  }>;
  currentStep?: string;
  completedAt?: string;
  outcome?: string;
  reasonCategory?: string;
  httpStatus?: number;
}

export type SecurityActivityEventType =
  | 'sign-in-success'
  | 'sign-in-failure'
  | 'authorization-denied'
  | 'role-changed'
  | 'account-status-changed'
  | 'identifier-conflict-detected'
  | 'identifier-conflict-resolved'
  | 'identifier-reservation-recovered'
  | 'identifier-repair-resumed'
  | 'token-refreshed'
  | 'refresh-replay-detected'
  | 'token-revoked'
  | 'sign-out';

export type SecurityActivityActorType = 'staff' | 'member' | 'system' | 'unknown';
export type SecurityActivityOutcome = 'success' | 'failure' | 'denied';

export interface SecurityActivityEventView {
  id: string;
  eventId?: string;
  eventType: SecurityActivityEventType;
  actorType: SecurityActivityActorType;
  actorId?: string;
  targetType?: string;
  targetId?: string;
  clientId?: string;
  subjectType?: string;
  subjectId?: string;
  outcome: SecurityActivityOutcome;
  reasonCategory?: string;
  identifierCorrelationHash?: string;
  correlationKeyVersion?: number;
  operationId?: string;
  requestId?: string;
  context?: Record<string, unknown>;
  createdAt: string;
}

export interface SecurityActivityQuery {
  eventType?: SecurityActivityEventType;
  actorType?: SecurityActivityActorType;
  outcome?: SecurityActivityOutcome;
  from?: string;
  to?: string;
  operationId?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface BookView {
  id: string;
  catalogIdentifier: string;
  title: string;
  author: string;
  isbn?: string;
  coverImageUrl?: string;
  categoryId: string;
  totalQuantity: number;
  availableQuantity: number;
  status: LibraryStatus;
}

export interface CatalogView {
  id: string;
  code: string;
  name: string;
  loanPeriodDays: number;
  status: LibraryStatus;
}

export interface MembershipTierView {
  id: string;
  code: string;
  name: string;
  maxActiveLoans: number;
  status: LibraryStatus;
}

export interface MemberView {
  id: string;
  memberNumber: string;
  fullName: string;
  email?: string;
  phone?: string;
  membershipTypeId: string;
  status: MemberStatus;
  activeLoanCount: number;
}

export interface MemberSelfServiceProfileView {
  id: string;
  memberNumber: string;
  displayName: string;
  email?: string;
  phone?: string;
  membershipStatus: MemberStatus;
  membershipTypeId: string;
  membershipTypeCode?: string;
  membershipTypeName?: string;
  activeLoanCount: number;
}

export interface MemberPolicyStatusView {
  memberId: string;
  status: MemberStatus;
  membershipTypeId: string;
  maxActiveLoans: number;
  activeLoanCount: number;
  remainingAllowance: number;
  eligibleByStatus: boolean;
  withinLimit: boolean;
  limitReached: boolean;
}

export interface BorrowingView {
  id: string;
  memberId: string;
  memberDisplayName?: string;
  memberNumber?: string;
  bookId: string;
  bookTitle?: string;
  bookCatalogIdentifier?: string;
  bookCategoryId: string;
  borrowedAt: string;
  dueAt: string;
  returnedAt?: string;
  status: LoanState;
  borrowedByStaffId: string;
  returnedByStaffId?: string;
}

export interface ListQuery {
  q?: string;
  status?: string;
  currentOnly?: boolean;
  page?: number;
  limit?: number;
}

export interface CreateBookInput {
  title: string;
  author?: string;
  isbn?: string;
  coverImageUrl?: string;
  catalogIdentifier: string;
  categoryId: string;
  totalQuantity: number;
}

export interface UpdateBookInput extends Partial<CreateBookInput> {
  status?: LibraryStatus;
}

export interface CreateCatalogInput {
  code: string;
  name: string;
  loanPeriodDays: number;
}

export interface UpdateCatalogInput extends Partial<CreateCatalogInput> {
  status?: LibraryStatus;
}

export interface CreateMembershipTierInput {
  code: string;
  name: string;
  maxActiveLoans: number;
}

export interface UpdateMembershipTierInput extends Partial<CreateMembershipTierInput> {
  status?: LibraryStatus;
}

export interface CreateMemberInput {
  memberNumber: string;
  fullName: string;
  email?: string;
  phone?: string;
  membershipTypeId: string;
}

export interface UpdateMemberInput extends Partial<CreateMemberInput> {
  status?: MemberStatus;
  activeLoanCount?: number;
}

export interface CreateBorrowingInput {
  memberId: string;
  bookId: string;
}

export interface ReturnBorrowingInput {
  returnedAt?: string;
}
