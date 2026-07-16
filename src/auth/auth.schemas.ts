import { z } from 'zod';

export const identityUserSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  email: z.string().email(),
  fullName: z.string(),
  name: z.string(),
  userCode: z.string().nullable(),
  status: z.string(),
  department: z.string().nullable(),
  jobTitle: z.string().nullable(),
  mustChangePassword: z.boolean(),
  mfaEnabled: z.boolean(),
  roles: z.array(z.string()),
  legacyRoles: z.array(z.string()),
  permissions: z.array(z.string()),
});

export const sessionPayloadSchema = z.object({
  accessToken: z.string().min(1),
  tokenType: z.literal('Bearer'),
  expiresIn: z.string(),
  user: identityUserSchema,
});
