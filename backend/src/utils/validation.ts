import { z } from 'zod';

export const CATEGORY_VALUES = ['TRAVEL', 'EQUIPMENT', 'LEAVE', 'EXPENSE', 'OTHER'] as const;

export const loginSchema = z.object({
  email: z.string().email('A valid email is required.'),
  password: z.string().min(1, 'Password is required.'),
});

export const createApplicationSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters.').max(200),
  category: z.enum(CATEGORY_VALUES, {
    errorMap: () => ({ message: `Category must be one of: ${CATEGORY_VALUES.join(', ')}` }),
  }),
  description: z.string().trim().min(1, 'Description is required.').max(5000),
  amount: z
    .number({ invalid_type_error: 'Amount must be a number.' })
    .positive('Amount must be greater than zero.')
    .finite(),
});

// Same shape as create — editing replaces the editable fields wholesale.
// Kept as a separate schema (rather than reusing createApplicationSchema
// directly) so the two can diverge later without surprise coupling.
export const updateApplicationSchema = createApplicationSchema;

export const transitionSchema = z.object({
  comment: z.string().trim().max(2000).optional(),
});

export const queueFilterSchema = z.object({
  status: z
    .enum(['SUBMITTED', 'UNDER_REVIEW', 'RETURNED', 'APPROVED', 'REJECTED', 'ALL'])
    .optional(),
});

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;
export type TransitionInput = z.infer<typeof transitionSchema>;
