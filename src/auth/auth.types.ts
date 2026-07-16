export interface IdentityUser {
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  name: string;
  userCode: string | null;
  status: string;
  department: string | null;
  jobTitle: string | null;
  mustChangePassword: boolean;
  mfaEnabled: boolean;
  roles: string[];
  legacyRoles: string[];
  permissions: string[];
}

export interface SessionPayload {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: IdentityUser;
}

export interface LoginInput {
  tenantId: string;
  email: string;
  password: string;
}
