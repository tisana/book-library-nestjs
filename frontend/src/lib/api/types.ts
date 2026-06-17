export type RoleArea = 'staff' | 'member';

export type StaffRole = 'admin' | 'staff';
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

export interface StaffSessionUser {
  id: string;
  email: string;
  displayName: string;
  roles: StaffRole[];
  roleArea: 'staff';
}

export interface MemberSessionUser {
  id: string;
  memberNumber: string;
  displayName: string;
  email?: string;
  membershipStatus: MemberStatus;
  roleArea: 'member';
}

export type SessionUser = StaffSessionUser | MemberSessionUser;

export interface LoginResponse<TUser extends SessionUser = SessionUser> {
  accessToken: string;
  user?: StaffSessionUser;
  member?: MemberSessionUser;
  principal?: TUser;
}

export interface BookView {
  id: string;
  catalogIdentifier: string;
  title: string;
  author: string;
  isbn?: string;
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
  bookId: string;
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
  page?: number;
  limit?: number;
}

export interface CreateBookInput {
  title: string;
  author?: string;
  isbn?: string;
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

export interface UpdateMembershipTierInput
  extends Partial<CreateMembershipTierInput> {
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
