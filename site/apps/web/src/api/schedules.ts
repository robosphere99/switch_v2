import type { ApiResponse, Schedule } from "@robosphere/shared";
import { api } from "./client";

export interface ScheduleWithDevice extends Schedule {
  device?: { id: number; name: string; type: string } | null;
}

export interface CreateScheduleInput {
  deviceId: number;
  action: "on" | "off";
  type: "once" | "daily" | "weekly" | "cron";
  runAt?: string | null;
  cron?: string | null;
}

export interface UpdateScheduleInput {
  action?: "on" | "off";
  enabled?: boolean;
  runAt?: string | null;
  cron?: string | null;
}

export async function listSchedules(
  homeId: number,
): Promise<ApiResponse<ScheduleWithDevice[]>> {
  const { data } = await api.get<ApiResponse<ScheduleWithDevice[]>>(
    `/homes/${homeId}/schedules`,
  );
  return data;
}

export async function createSchedule(
  homeId: number,
  input: CreateScheduleInput,
): Promise<ApiResponse<ScheduleWithDevice>> {
  const { data } = await api.post<ApiResponse<ScheduleWithDevice>>(
    `/homes/${homeId}/schedules`,
    input,
  );
  return data;
}

export async function updateSchedule(
  homeId: number,
  scheduleId: number,
  input: UpdateScheduleInput,
): Promise<ApiResponse<ScheduleWithDevice>> {
  const { data } = await api.patch<ApiResponse<ScheduleWithDevice>>(
    `/homes/${homeId}/schedules/${scheduleId}`,
    input,
  );
  return data;
}

export async function deleteSchedule(
  homeId: number,
  scheduleId: number,
): Promise<ApiResponse<{ message: string }>> {
  const { data } = await api.delete<ApiResponse<{ message: string }>>(
    `/homes/${homeId}/schedules/${scheduleId}`,
  );
  return data;
}
