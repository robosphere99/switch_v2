import type { QueryClient } from "@tanstack/react-query";
import type { ApiResponse, Device, DeviceStatus } from "@robosphere/shared";
import { setDeviceStatus } from "../api/devices";

export interface ToggleVars {
  device: Device;
  status: DeviceStatus;
}

export interface ToggleContext {
  /** Error pe restore karne ke liye original cache snapshot. */
  prev: ApiResponse<Device[]> | undefined;
}

export interface ToggleOptions {
  queryClient: QueryClient;
  homeId: number;
  setPending: (fn: (p: Record<number, "on" | "off">) => Record<number, "on" | "off">) => void;
  setError: (msg: string) => void;
  invalidate: () => void;
  onSecurityLock?: (deviceId: number) => void;
}

/**
 * Device toggle ke liye useMutation options — optimistic UI + rollback.
 *
 * Flow: tap → UI turant update (PENDING) → API call → server truth.
 * Error pe original snapshot restore hota hai (server kabhi galat state me
 * nahi chhodta). Har device apna pending rakhta hai — ek toggle baaki ko
 * block nahi karta.
 */
export function createToggleOptions({
  queryClient,
  homeId,
  setPending,
  setError,
  invalidate,
  onSecurityLock,
}: ToggleOptions) {
  return {
    mutationFn: ({ device, status }: ToggleVars) =>
      setDeviceStatus(homeId, device.id, status),

    onMutate: async ({ device, status }: ToggleVars): Promise<ToggleContext> => {
      await queryClient.cancelQueries({ queryKey: ["devices", homeId] });
      const prev = queryClient.getQueryData<ApiResponse<Device[]>>(["devices", homeId]);
      queryClient.setQueryData<ApiResponse<Device[]>>(["devices", homeId], (old) =>
        old?.success
          ? { ...old, data: old.data.map((d) => (d.id === device.id ? { ...d, status } : d)) }
          : old,
      );
      setPending((p) => ({ ...p, [device.id]: status }));
      return { prev };
    },

    onSuccess: (_r: unknown, vars: ToggleVars) => {
      setPending((p) => {
        const n = { ...p };
        delete n[vars.device.id];
        return n;
      });
    },

    onError: (e: unknown, vars: ToggleVars, ctx?: ToggleContext) => {
      if (ctx?.prev) queryClient.setQueryData(["devices", homeId], ctx.prev);
      setPending((p) => {
        const n = { ...p };
        delete n[vars.device.id];
        return n;
      });
      const resErr = e as any;
      const errMsg = resErr?.response?.data?.error?.message;
      if (resErr?.response?.status === 429 || (errMsg && errMsg.toLowerCase().includes('minute'))) {
        if (onSecurityLock) onSecurityLock(vars.device.id);
      }
      setError(errMsg ?? "Kuch galat ho gaya");
    },

    onSettled: () => invalidate(),
  };
}
