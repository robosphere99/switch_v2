import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import type { ApiResponse, Device } from "@robosphere/shared";
import { createToggleOptions, type ToggleContext, type ToggleVars } from "./deviceOptimistic";

// ---- mocks ----
vi.mock("../api/devices", () => ({
  setDeviceStatus: vi.fn(),
}));
import { setDeviceStatus } from "../api/devices";
const setStatusMock = vi.mocked(setDeviceStatus);

type PendingSetter = (fn: (p: Record<number, "on" | "off">) => Record<number, "on" | "off">) => void;

const makeDevice = (id: number, status: "on" | "off"): Device =>
  ({
    id,
    homeId: 10,
    name: `Device ${id}`,
    type: "bulb",
    status,
    offline: false,
    lastSeen: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
  }) as unknown as Device;

const cached = (devices: Device[]): ApiResponse<Device[]> => ({
  success: true,
  data: devices,
});

describe("createToggleOptions — optimistic lifecycle", () => {
  let qc: QueryClient;
  let setPending: PendingSetter;
  let setPendingMock: ReturnType<typeof vi.fn<PendingSetter>>;
  let setError: (msg: string) => void;
  let invalidate: () => void;
  let options: ReturnType<typeof createToggleOptions>;

  const cacheDevices = (): Device[] => {
    const d = qc.getQueryData<ApiResponse<Device[]>>(["devices", 10]);
    return d?.success ? d.data : [];
  };
  const statusOf = (id: number): "on" | "off" | undefined =>
    cacheDevices().find((d) => d.id === id)?.status;

  beforeEach(() => {
    vi.clearAllMocks();
    qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    setPendingMock = vi.fn<PendingSetter>((fn) => fn({}));
    setPending = setPendingMock;
    setError = vi.fn<(msg: string) => void>();
    invalidate = vi.fn<() => void>();
    options = createToggleOptions({
      queryClient: qc,
      homeId: 10,
      setPending,
      setError,
      invalidate,
    });
    qc.setQueryData(["devices", 10], cached([makeDevice(1, "off"), makeDevice(2, "on")]));
  });

  it("onMutate → device status turant update hota hai (optimistic), baaki untouched", async () => {
    const ctx = await options.onMutate({ device: makeDevice(1, "off"), status: "on" });

    expect(statusOf(1)).toBe("on");
    expect(statusOf(2)).toBe("on"); // untouched
    expect(setPending).toHaveBeenCalled();
    // Snapshot return hua — error pe restore ke liye
    expect(ctx.prev?.success && ctx.prev.data.find((d) => d.id === 1)?.status).toBe("off");
  });

  it("onError → rollback: original snapshot restore, pending clear, error message", async () => {
    const ctx = (await options.onMutate({ device: makeDevice(1, "off"), status: "on" })) as ToggleContext;
    // Optimistic state me cache ab "on" hai
    expect(statusOf(1)).toBe("on");

    await options.onError(new Error("network"), { device: makeDevice(1, "off"), status: "on" }, ctx);

    // Rollback — server truth wapas
    expect(statusOf(1)).toBe("off");
    expect(statusOf(2)).toBe("on");
    expect(setError).toHaveBeenCalledWith("Kuch galat ho gaya");
  });

  it("onError → API error envelope se message nikalta hai (DB error nahi dikhta)", async () => {
    const ctx = (await options.onMutate({ device: makeDevice(1, "off"), status: "on" })) as ToggleContext;
    const apiErr = {
      response: { data: { error: { message: "Is device ka access nahi hai" } } },
    };

    await options.onError(apiErr, { device: makeDevice(1, "off"), status: "on" }, ctx);

    expect(setError).toHaveBeenCalledWith("Is device ka access nahi hai");
    expect(statusOf(1)).toBe("off");
  });

  it("onSuccess → pending clear hota hai, optimistic state tab tak rehti hai", async () => {
    setStatusMock.mockResolvedValue({ success: true, data: makeDevice(1, "on") } as never);

    const vars: ToggleVars = { device: makeDevice(1, "off"), status: "on" };
    await options.onMutate(vars);
    await options.onSuccess({ success: true, data: makeDevice(1, "on") }, vars);

    // Success pe rollback NAHI — optimistic value refetch/invalidate se confirm hoti hai
    expect(statusOf(1)).toBe("on");
    // pending entry hat gayi (mutator ne {1: 'on'} add kiya tha)
    const lastCall = setPendingMock.mock.calls[setPendingMock.mock.calls.length - 1];
    expect(lastCall[0]({ 1: "on" })).toEqual({});
  });

  it("onSettled → invalidate chalta hai (server truth refetch)", async () => {
    await options.onSettled();
    expect(invalidate).toHaveBeenCalled();
  });

  it("mutationFn → setDeviceStatus ko homeId + deviceId + status deta hai", async () => {
    setStatusMock.mockResolvedValue({ success: true, data: makeDevice(1, "on") } as never);
    await options.mutationFn({ device: makeDevice(1, "off"), status: "on" });
    expect(setStatusMock).toHaveBeenCalledWith(10, 1, "on");
  });
});
