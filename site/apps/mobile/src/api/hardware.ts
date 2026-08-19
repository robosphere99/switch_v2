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
