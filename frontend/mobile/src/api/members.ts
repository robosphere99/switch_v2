import { api, extractApiError } from './client';

export interface Invitation {
    id: number;
    homeId: number;
    email: string;
    inviteCode: string;
    role: 'owner' | 'admin' | 'member' | 'viewer';
    status: 'pending' | 'accepted' | 'expired';
    expiresAt: string;
    createdAt: string;
}

export const inviteMember = async (homeId: number, email: string | undefined, role: 'admin' | 'member' | 'viewer') => {
    try {
        const body: Record<string, unknown> = { role };
        if (email) body.email = email;
        const res = await api.post(`/homes/${homeId}/invitations`, body);
        return res.data;
    } catch (e) {
        throw extractApiError(e);
    }
};

export const listInvitations = async (homeId: number) => {
    try {
        const res = await api.get(`/homes/${homeId}/invitations`);
        return res.data;
    } catch (e) {
        throw extractApiError(e);
    }
};

export const revokeInvitation = async (homeId: number, invitationId: number) => {
    try {
        const res = await api.delete(`/homes/${homeId}/invitations/${invitationId}`);
        return res.data;
    } catch (e) {
        throw extractApiError(e);
    }
};

export const changeMemberRole = async (homeId: number, userId: number, role: 'owner' | 'admin' | 'member' | 'viewer') => {
    try {
        const res = await api.patch(`/homes/${homeId}/members/${userId}/role`, { role });
        return res.data;
    } catch (e) {
        throw extractApiError(e);
    }
};

export const updateMemberSafety = async (
    homeId: number,
    userId: number,
    input: { restricted?: boolean; dailyLimitMinutes?: number | null }
) => {
    try {
        const res = await api.patch(`/homes/${homeId}/members/${userId}/safety`, input);
        return res.data;
    } catch (e) {
        throw extractApiError(e);
    }
};

export const setMemberDeviceAccess = async (homeId: number, userId: number, deviceIds: number[]) => {
    try {
        const res = await api.put(`/homes/${homeId}/members/${userId}/access`, { deviceIds });
        return res.data;
    } catch (e) {
        throw extractApiError(e);
    }
};

export const removeMember = async (homeId: number, userId: number) => {
    try {
        const res = await api.delete(`/homes/${homeId}/members/${userId}`);
        return res.data;
    } catch (e) {
        throw extractApiError(e);
    }
};

export const acceptInvite = async (inviteCode: string) => {
    try {
        const res = await api.post('/homes/invitations/accept', { inviteCode });
        return res.data;
    } catch (e) {
        throw extractApiError(e);
    }
};
