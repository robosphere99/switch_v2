import type { ApiResponse, AuthUser, LoginResponse } from "@robosphere/shared";
import { api } from "./client";

export interface SignupInput {
  username: string;
  email: string;
  password: string;
  homeName?: string;
}

export async function signup(input: SignupInput): Promise<ApiResponse<LoginResponse>> {
  const { data } = await api.post<ApiResponse<LoginResponse>>("/auth/signup", input);
  return data;
}

export async function login(input: {
  usernameEmail: string;
  password: string;
}): Promise<ApiResponse<LoginResponse>> {
  const { data } = await api.post<ApiResponse<LoginResponse>>("/auth/login", input);
  return data;
}

export async function updateProfile(input: {
  username?: string;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
  avatarUrl?: string | null;
  dob?: string | null;
  gender?: string | null;
  phone?: string | null;
  address?: string | null;
}): Promise<ApiResponse<AuthUser>> {
  const { data } = await api.patch<ApiResponse<AuthUser>>("/auth/me", input);
  return data;
}

export async function forgotPassword(email: string): Promise<ApiResponse<{ sent: true }>> {
  const { data } = await api.post<ApiResponse<{ sent: true }>>("/auth/forgot-password", { email });
  return data;
}

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<ApiResponse<{ message: string }>> {
  const { data } = await api.post<ApiResponse<{ message: string }>>("/auth/reset-password", {
    token,
    newPassword,
  });
  return data;
}
