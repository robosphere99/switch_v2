import { api, extractApiError } from './client';

export const getHomes = async () => {
    try {
        const res = await api.get('/homes');
        return res.data;
    } catch (e) {
        throw extractApiError(e);
    }
};

export const getDevices = async (homeId: number) => {
    try {
        const res = await api.get(`/homes/${homeId}/devices`);
        return res.data;
    } catch (e) {
        throw extractApiError(e);
    }
};

export const toggleDevice = async (homeId: number, deviceId: number, status: 'on' | 'off') => {
    try {
        const res = await api.post(`/homes/${homeId}/devices/${deviceId}/status`, { status });
        return res.data;
    } catch (e) {
        throw extractApiError(e);
    }
};

export const getSchedules = async (homeId: number) => {
    try {
        const res = await api.get(`/homes/${homeId}/schedules`);
        return res.data;
    } catch (e) {
        throw extractApiError(e);
    }
};

export const deleteSchedule = async (homeId: number, scheduleId: number) => {
    try {
        const res = await api.delete(`/homes/${homeId}/schedules/${scheduleId}`);
        return res.data;
    } catch (e) {
        throw extractApiError(e);
    }
};

export const getHomeMembers = async (homeId: number) => {
    try {
        const res = await api.get(`/homes/${homeId}/members`);
        return res.data;
    } catch (e) {
        throw extractApiError(e);
    }
};

export const getHomeActivity = async (homeId: number, limit: number = 50, deviceId?: number | null, userId?: number | null, timeRange?: string) => {
    try {
        let url = `/homes/${homeId}/activity?limit=${limit}`;
        if (deviceId) url += `&deviceId=${deviceId}`;
        if (userId) url += `&userId=${userId}`;
        if (timeRange) url += `&timeRange=${timeRange}`;
        const res = await api.get(url);
        return { success: true, data: res.data };
    } catch (e: any) {
        return { success: false, error: extractApiError(e) };
    }
};
