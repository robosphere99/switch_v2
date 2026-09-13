import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Zap, Power, AlertCircle, Clock, Settings2, Filter, User, Calendar, ShieldCheck, RefreshCw } from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { Card } from "../components/ui/Card";
import { CardHeader } from "../components/ui/CardHeader";
import { CardTitle } from "../components/ui/CardTitle";
import { CardDescription } from "../components/ui/CardDescription";
import { CardContent } from "../components/ui/CardContent";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";

export function Settings() {
    const [homes, setHomes] = useState<any[]>([]);
    const [selectedHomeId, setSelectedHomeId] = useState<number | null>(null);
    const [devices, setDevices] = useState<any[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);
    const [members, setMembers] = useState<any[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    const [selectedTimeRange, setSelectedTimeRange] = useState<string>("");
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get("/homes").then((res: any) => {
            const body = res.data;
            if (body && body.success && body.data && body.data.length > 0) {
                const adminHomes = body.data.filter((h: any) => {
                    const role = h.role || (h.members && h.members[0] && h.members[0].role);
                    return role === 'admin' || role === 'owner' || role === 'system_admin';
                });
                setHomes(adminHomes);
                if (adminHomes.length > 0) {
                    const hId = adminHomes[0].homeId || adminHomes[0].id;
                    setSelectedHomeId(hId);
                    fetchDevices(hId);
                    fetchMembers(hId);
                    fetchLogs(hId, null, null, "");
                } else {
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        });
    }, []);

    const fetchDevices = (homeId: number) => {
        api.get(`/homes/${homeId}/devices`).then((res: any) => {
            const body = res.data;
            if (body && body.success && body.data) {
                setDevices(body.data);
            }
        });
    };

    const fetchMembers = (homeId: number) => {
        api.get(`/homes/${homeId}/members`).then((res: any) => {
            const body = res.data;
            if (body && body.success && body.data) {
                setMembers(body.data);
            }
        });
    };

    const fetchLogs = (homeId: number, deviceId: number | null, userId: number | null, timeRange: string) => {
        setLoading(true);
        let url = `/homes/${homeId}/activity?limit=50`;
        if (deviceId) url += `&deviceId=${deviceId}`;
        if (userId) url += `&userId=${userId}`;
        if (timeRange) url += `&timeRange=${timeRange}`;
        api.get(url).then((res: any) => {
            const body = res.data;
            if (body && body.success && body.data) {
                setLogs(body.data);
            } else {
                setLogs([]);
            }
        }).catch(() => {
            setLogs([]);
        }).finally(() => {
            setLoading(false);
        });
    };

    const capitalize = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

    const handleRefresh = () => {
        if (selectedHomeId) {
            fetchLogs(selectedHomeId, selectedDeviceId, selectedUserId, selectedTimeRange);
        }
    };

    return (
        <div className="page-enter mx-auto max-w-5xl px-4 py-8 sm:px-6">
            <PageHeader
                title="Settings & Audit Logs"
                subtitle="Monitor device events, status toggles, and user actions across your managed homes."
                actions={
                    <Button
                        variant="secondary"
                        size="sm"
                        leftIcon={<RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />}
                        onClick={handleRefresh}
                        disabled={loading || !selectedHomeId}
                    >
                        Refresh Logs
                    </Button>
                }
            />

            {/* Home selector tabs */}
            {homes.length > 1 && (
                <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-2">
                    {homes.map((home: any) => {
                        const hId = home.homeId || home.id;
                        const isSelected = selectedHomeId === hId;
                        const hName = capitalize(home.name || home.home?.name) || `Home ${hId}`;
                        return (
                            <button
                                key={hId}
                                onClick={() => {
                                    setSelectedHomeId(hId);
                                    setSelectedDeviceId(null);
                                    setSelectedUserId(null);
                                    setSelectedTimeRange("");
                                    fetchDevices(hId);
                                    fetchMembers(hId);
                                    fetchLogs(hId, null, null, "");
                                }}
                                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                                    isSelected
                                        ? "bg-brand text-white shadow-sm shadow-brand/20"
                                        : "bg-surface-elevated text-text-muted hover:text-text-primary border border-border/60 hover:bg-surface-secondary"
                                }`}
                            >
                                <ShieldCheck className="h-4 w-4" />
                                {hName}
                            </button>
                        );
                    })}
                </div>
            )}

            <Card className="mb-8">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Settings2 className="h-5 w-5 text-brand" />
                                Filter Activity Logs
                            </CardTitle>
                            <CardDescription>
                                Narrow down events by target hardware, specific household member, or time window.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        {/* Device Filter */}
                        <div>
                            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
                                <Filter className="h-3.5 w-3.5" />
                                Hardware Device
                            </label>
                            <select
                                value={selectedDeviceId || ""}
                                onChange={(e) => {
                                    const val = e.target.value ? Number(e.target.value) : null;
                                    setSelectedDeviceId(val);
                                    if (selectedHomeId) fetchLogs(selectedHomeId, val, selectedUserId, selectedTimeRange);
                                }}
                                className="w-full rounded-xl border border-border/80 bg-surface-primary px-3.5 py-2.5 text-sm font-medium text-text-primary shadow-xs outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                            >
                                <option value="">All Connected Devices</option>
                                {devices.map((device: any) => (
                                    <option key={device.id} value={device.id}>{device.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* User Filter */}
                        <div>
                            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
                                <User className="h-3.5 w-3.5" />
                                Member
                            </label>
                            <select
                                value={selectedUserId || ""}
                                onChange={(e) => {
                                    const val = e.target.value ? Number(e.target.value) : null;
                                    setSelectedUserId(val);
                                    if (selectedHomeId) fetchLogs(selectedHomeId, selectedDeviceId, val, selectedTimeRange);
                                }}
                                className="w-full rounded-xl border border-border/80 bg-surface-primary px-3.5 py-2.5 text-sm font-medium text-text-primary shadow-xs outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                            >
                                <option value="">Everyone (All Members)</option>
                                {members.map((member: any) => (
                                    <option key={member.userId} value={member.userId}>{capitalize(member.user?.username || 'Unknown')}</option>
                                ))}
                            </select>
                        </div>

                        {/* Time Filter */}
                        <div>
                            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
                                <Calendar className="h-3.5 w-3.5" />
                                Time Horizon
                            </label>
                            <select
                                value={selectedTimeRange}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setSelectedTimeRange(val);
                                    if (selectedHomeId) fetchLogs(selectedHomeId, selectedDeviceId, selectedUserId, val);
                                }}
                                className="w-full rounded-xl border border-border/80 bg-surface-primary px-3.5 py-2.5 text-sm font-medium text-text-primary shadow-xs outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                            >
                                <option value="">All Time History</option>
                                <option value="24h">Past 24 Hours</option>
                                <option value="7d">Past 7 Days</option>
                                <option value="30d">Past 30 Days</option>
                            </select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Logs Timeline */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Audit Trail</CardTitle>
                        <Badge variant="neutral">{logs.length} Recorded Events</Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="space-y-3 py-4">
                            <Skeleton className="h-16 w-full rounded-xl" />
                            <Skeleton className="h-16 w-full rounded-xl" />
                            <Skeleton className="h-16 w-full rounded-xl" />
                        </div>
                    ) : logs.length === 0 ? (
                        <EmptyState
                            icon={<Clock className="h-8 w-8 text-text-muted" />}
                            title="No activity recorded"
                            description="No actions match the active filters, or you don't have administrator privileges for this home."
                        />
                    ) : (
                        <div className="divide-y divide-border/60">
                            {logs.map((item) => {
                                const date = new Date(item.createdAt);
                                const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

                                let ActionIcon = Zap;
                                let iconStyle = "text-brand bg-brand/10 dark:bg-brand/20";

                                const isTurnedOn = item.logMessage?.toLowerCase().includes('turned on');
                                const isTurnedOff = item.logMessage?.toLowerCase().includes('turned off');

                                if (isTurnedOn) {
                                    ActionIcon = Power;
                                    iconStyle = "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400";
                                } else if (isTurnedOff) {
                                    ActionIcon = Power;
                                    iconStyle = "text-rose-600 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400";
                                } else if (item.logType === 'error') {
                                    ActionIcon = AlertCircle;
                                    iconStyle = "text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400";
                                }

                                const msgFormatted = item.logMessage?.replace('Device status changed to', 'turned') || 'Action executed';

                                return (
                                    <div key={item.id} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconStyle}`}>
                                            <ActionIcon className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-text-primary">
                                                <span className="font-semibold text-text-primary">{capitalize(item.actor?.username || 'System')}</span>{' '}
                                                <span className="text-text-secondary">{msgFormatted}</span>{' '}
                                                <span className="font-semibold text-brand">{item.device?.name || 'Device'}</span>
                                            </p>
                                            <div className="mt-1 flex items-center gap-2 text-xs text-text-muted">
                                                <Clock className="h-3.5 w-3.5" />
                                                <span>{dateStr} at {timeStr}</span>
                                                {item.logType && (
                                                    <span className="rounded-md bg-surface-secondary px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-text-muted">
                                                        {item.logType}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
