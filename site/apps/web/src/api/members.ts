import type { ApiResponse, Home, HomeMember, HomeMemberRole, InvitationStatus } from "@robosphere/shared";
import { api } from "./client";

export interface Invitation {
  id: number;
  homeId: number;
  email: string;
  inviteCode: string;
  role: HomeMemberRole;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
}

export async function inviteMember(
  homeId: number,
  input: { email: string; role: "admin" | "member" | "viewer" },
): Promise<ApiResponse<Invitation>> {
  const { data } = await api.post<ApiResponse<Invitation>>(
    `/homes/${homeId}/invitations`,
    input,
  );
  return data;
}

export async function listInvitations(homeId: number): Promise<ApiResponse<Invitation[]>> {
  const { data } = await api.get<ApiResponse<Invitation[]>>(`/homes/${homeId}/invitations`);
  return data;
}

export async function revokeInvitation(
  homeId: number,
  invitationId: number,
): Promise<ApiResponse<Invitation>> {
  const { data } = await api.delete<ApiResponse<Invitation>>(
    `/homes/${homeId}/invitations/${invitationId}`,
  );
  return data;
}

export async function changeMemberRole(
  homeId: number,
  userId: number,
  role: HomeMemberRole,
): Promise<ApiResponse<HomeMember>> {
  const { data } = await api.patch<ApiResponse<HomeMember>>(
    `/homes/${homeId}/members/${userId}/role`,
    { role },
  );
  return data;
}

/** Child mode (restricted) + daily usage limit — sirf owner/admin. */
export async function updateMemberSafety(
  homeId: number,
  userId: number,
  input: { restricted?: boolean; dailyLimitMinutes?: number | null },
): Promise<ApiResponse<HomeMember>> {
  const { data } = await api.patch<ApiResponse<HomeMember>>(
    `/homes/${homeId}/members/${userId}/safety`,
    input,
  );
  return data;
}

/** Restricted member ke device grants replace karo (kaunse devices control kar sakega). */
export async function setMemberDeviceAccess(
  homeId: number,
  userId: number,
  deviceIds: number[],
): Promise<ApiResponse<{ deviceIds: number[] }>> {
  const { data } = await api.put<ApiResponse<{ deviceIds: number[] }>>(
    `/homes/${homeId}/members/${userId}/access`,
    { deviceIds },
  );
  return data;
}

export async function removeMember(
  homeId: number,
  userId: number,
): Promise<ApiResponse<{ message: string }>> {
  const { data } = await api.delete<ApiResponse<{ message: string }>>(
    `/homes/${homeId}/members/${userId}`,
  );
  return data;
}

export async function acceptInvite(inviteCode: string): Promise<ApiResponse<Home>> {
  const { data } = await api.post<ApiResponse<Home>>("/homes/invitations/accept", { inviteCode });
  return data;
}
