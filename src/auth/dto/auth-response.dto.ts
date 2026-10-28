import { Role, UserStatus } from '@prisma/client';

export interface UserSafeProfile {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  department: string | null;
  avatarUrl: string | null;
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoginResponse {
  accessToken: string;
  user: UserSafeProfile;
}

export interface LogoutResponse {
  message: string;
}
