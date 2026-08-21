import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Zap, Power, AlertCircle, Clock, Settings2, Filter, User, Calendar } from "lucide-react";


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
    }

    const fetchMembers = (homeId: number) => {
        api.get(`/homes/${homeId}/members`).then((res: any) => {
            const body = res.data;
            if (body && body.success && body.data) {
                setMembers(body.data);
            }
        });
    }

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
    }

    const capitalize = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

    return (
        <div className="mx-auto max-w-4xl p-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                <Settings2 className="w-8 h-8 text-brand" /> Settings
            </h1>
            <p className="text-gray-500 mb-6">Home configuration and Audit logs (Admins Only)</p>

            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Audit Logs</h2>

                {homes.length > 1 && (
                    <div className="flex gap-3 mb-4 overflow-x-auto pb-2">
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
                                    className={`px-4 py-2 rounded-full border text-sm font-medium transition ${isSelected ? 'bg-brand/10 border-brand text-brand' : 'bg-white border-gray-200 text-gray-600'}`}
                                >
                                    {hName}
                                </button>
                            );
                        })}
                    </div>
                )}

                {devices.length > 0 && (
                    <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Device Filter */}
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-1">
                                <span className="flex items-center justify-center bg-gray-100 p-1.5 rounded-lg text-gray-500">
                                    <Filter size={14} className="text-gray-500" />
                                </span>
                                Hardware
                            </label>
                            <select
                                value={selectedDeviceId || ""}
                                onChange={(e) => {
                                    const val = e.target.value ? Number(e.target.value) : null;
                                    setSelectedDeviceId(val);
                                    if (selectedHomeId) fetchLogs(selectedHomeId, val, selectedUserId, selectedTimeRange);
                                }}
                                className="w-full border border-gray-300 rounded-xl py-2 px-3 text-sm focus:ring-brand focus:border-brand shadow-sm bg-gray-50 cursor-pointer font-medium"
                            >
                                <option value="">All Connected Devices</option>
                                {devices.map((device: any) => (
                                    <option key={device.id} value={device.id}>{device.name}</option>
                                ))}
                            </select>
                        </div>
                        {/* User Filter */}
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-1">
                                <span className="flex items-center justify-center bg-gray-100 p-1.5 rounded-lg text-gray-500">
                                    <User size={14} className="text-gray-500" />
                                </span>
                                Member
                            </label>
                            <select
                                value={selectedUserId || ""}
                                onChange={(e) => {
                                    const val = e.target.value ? Number(e.target.value) : null;
                                    setSelectedUserId(val);
                                    if (selectedHomeId) fetchLogs(selectedHomeId, selectedDeviceId, val, selectedTimeRange);
                                }}
                                className="w-full border border-gray-300 rounded-xl py-2 px-3 text-sm focus:ring-brand focus:border-brand shadow-sm bg-gray-50 cursor-pointer font-medium"
                            >
                                <option value="">Everyone (All Members)</option>
                                {members.map((member: any) => (
                                    <option key={member.userId} value={member.userId}>{capitalize(member.user?.username || 'Unknown')}</option>
                                ))}
                            </select>
                        </div>
                        {/* Time Filter */}
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-1">
                                <span className="flex items-center justify-center bg-gray-100 p-1.5 rounded-lg text-gray-500">
                                    <Calendar size={14} className="text-gray-500" />
                                </span>
                                Time Range
                            </label>
                            <select
                                value={selectedTimeRange}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setSelectedTimeRange(val);
                                    if (selectedHomeId) fetchLogs(selectedHomeId, selectedDeviceId, selectedUserId, val);
                                }}
                                className="w-full border border-gray-300 rounded-xl py-2 px-3 text-sm focus:ring-brand focus:border-brand shadow-sm bg-gray-50 cursor-pointer font-medium"
                            >
                                <option value="">Any Time (All History)</option>
                                <option value="24h">Last 24 Hours</option>
                                <option value="7d">Past 7 Days</option>
                                <option value="30d">Past 30 Days</option>
                            </select>
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="py-20 text-center text-gray-500">Loading activity...</div>
                ) : logs.length === 0 ? (
                    <div className="py-20 text-center text-gray-500 border rounded-2xl bg-gray-50 border-dashed">No activity recorded or viewing permission denied.</div>
                ) : (
                    <div className="space-y-4">
                        {logs.map((item) => {
                            const date = new Date(item.createdAt);
                            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });

                            let ActionIcon = Zap;
                            let iconColor = "text-brand bg-brand/10";

                            if (item.logMessage.toLowerCase().includes('turned on')) {
                                ActionIcon = Power;
                                iconColor = "text-emerald-600 bg-emerald-100";
                            } else if (item.logMessage.toLowerCase().includes('turned off')) {
                                ActionIcon = Power;
                                iconColor = "text-red-500 bg-red-100";
                            } else if (item.logType === 'error') {
                                ActionIcon = AlertCircle;
                                iconColor = "text-amber-500 bg-amber-100";
                            }

                            const msgFormatted = item.logMessage.replace('Device status changed to', 'turned');

                            return (
                                <div key={item.id} className="flex items-center gap-4 bg-gray-50/50 border border-gray-100 rounded-xl p-4">
                                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconColor}`}>
                                        <ActionIcon className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-gray-800 text-sm">
                                            <span className="font-bold">{capitalize(item.actor?.username || 'System')}</span> {msgFormatted} <span className="font-semibold text-night-900">{item.device?.name || 'Device'}</span>
                                        </p>
                                        <div className="flex items-center text-xs text-gray-500 mt-1">
                                            <Clock className="w-3.5 h-3.5 mr-1.5" />
                                            {dateStr} at {timeStr}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
