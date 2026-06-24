import { z } from 'zod';

export const listQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const staffLoginSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export const memberLoginSchema = z.object({
  loginIdentifier: z.string().trim().min(1),
  password: z.string().min(8),
});

export const bookSchema = z.object({
  catalogIdentifier: z.string().trim().min(1),
  title: z.string().trim().min(1),
  author: z.string().trim().min(1),
  isbn: z.string().trim().optional(),
  coverImageUrl: z.url().optional(),
  categoryId: z.string().trim().min(1),
  totalQuantity: z.coerce.number().int().min(0),
  availableQuantity: z.coerce.number().int().min(0),
  status: z.enum(['active', 'deactivated']),
});

export const catalogSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  loanPeriodDays: z.coerce.number().int().positive(),
  status: z.enum(['active', 'deactivated']),
});

export const membershipTierSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  maxActiveLoans: z.coerce.number().int().positive(),
  status: z.enum(['active', 'deactivated']),
});

export const memberSchema = z.object({
  memberNumber: z.string().trim().min(1),
  fullName: z.string().trim().min(1),
  email: z.email().optional(),
  phone: z.string().trim().optional(),
  membershipTypeId: z.string().trim().min(1),
  status: z.enum(['active', 'suspended', 'inactive']),
  activeLoanCount: z.coerce.number().int().min(0),
});

export const borrowingSchema = z.object({
  memberId: z.string().trim().min(1),
  bookId: z.string().trim().min(1),
  borrowedAt: z.iso.datetime(),
  dueAt: z.iso.datetime(),
  status: z.enum(['active', 'returned', 'overdue']),
});

export const returnSchema = z.object({
  returnedAt: z.iso.datetime().optional(),
});

export const memberSelfServiceProfileSchema = z.object({
  id: z.string(),
  memberNumber: z.string(),
  displayName: z.string(),
  email: z.email().optional(),
  phone: z.string().optional(),
  membershipStatus: z.enum(['active', 'suspended', 'inactive']),
  membershipTypeId: z.string(),
  membershipTypeCode: z.string().optional(),
  membershipTypeName: z.string().optional(),
  activeLoanCount: z.number().int().min(0),
});

export const memberPolicyStatusSchema = z.object({
  memberId: z.string(),
  status: z.enum(['active', 'suspended', 'inactive']),
  membershipTypeId: z.string(),
  maxActiveLoans: z.number().int().min(0),
  activeLoanCount: z.number().int().min(0),
  remainingAllowance: z.number().int().min(0),
  eligibleByStatus: z.boolean(),
  withinLimit: z.boolean(),
  limitReached: z.boolean(),
});
