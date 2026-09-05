import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Clock, Trash2, Power, Plus, Loader2 } from "lucide-react";

export function Automations() {
    const [loading, setLoading] = useState(true);
    const [schedules, setSchedules] = useState<any[]>([]);
    const [devices, setDevices] = useState<any[]>([]);
    const [homeId, setHomeId] = useState<number | null>(null);

    // Form State
    const [isCreating, setIsCreating] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [newSched, setNewSched] = useState({
        deviceId: "",
        action: "off",
        type: "once",
        minutesDelay: 5
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const hRes = await api.get('/homes');
            if (hRes.data.length > 0) {
                const hId = hRes.data[0].id; // or homeId depending on schema
                setHomeId(hId);

                const [schRes, devRes] = await Promise.all([
                    api.get(`/homes/${hId}/schedules`),
                    api.get(`/homes/${hId}/devices`)
                ]);

                setSchedules(schRes.data);
                setDevices(devRes.data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!homeId || !newSched.deviceId) return;
        setSubmitting(true);

        // Calculate runAt from minutesDelay
        const runAt = new Date(Date.now() + newSched.minutesDelay * 60000).toISOString();

        try {
            await api.post(`/homes/${homeId}/schedules`, {
                deviceId: parseInt(newSched.deviceId),
                action: newSched.action,
                type: newSched.type,
                runAt
            });
            setIsCreating(false);
            loadData(); // Reload list securely
        } catch (err) {
            console.error(err);
            alert("Failed to create routine");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!homeId) return;
        if (!confirm("Are you sure you want to stop this routine?")) return;
        try {
            await api.delete(`/homes/${homeId}/schedules/${id}`);
            setSchedules(prev => prev.filter(s => s.id !== id));
        } catch (e) {
            alert("Failed to delete");
        }
    };

    if (loading) {
        return <div className="flex h-64 items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;
    }

    return (
        <div className="max-w-4xl mx-auto p-6 pt-10">
            <div className="flex justify-between items-center mb-10">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 border-b-4 border-blue-500 inline-block pb-1">Automations</h1>
                    <p className="text-gray-500 mt-3 font-medium">Create self-driving physical routines for your smart home.</p>
                </div>
                {!isCreating && (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-500/30 transition-all"
                    >
                        <Plus size={20} /> New Timer
                    </button>
                )}
            </div>

            {isCreating && (
                <div className="bg-white p-6 rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 mb-8 animate-in fade-in slide-in-from-top-4">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800"><Clock className="text-blue-500" /> Schedule Device</h2>
                    <form onSubmit={handleCreate} className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Target Device</label>
                                <select required
                                    value={newSched.deviceId}
                                    onChange={(e) => setNewSched({ ...newSched, deviceId: e.target.value })}
                                    className="w-full border-gray-300 rounded-xl shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2.5 outline-none border"
                                >
                                    <option value="">Select a device...</option>
                                    {devices.map(d => <option key={d.id} value={d.id}>{d.name} {d.room ? `(${d.room.name})` : ''}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Action</label>
                                <select
                                    value={newSched.action}
                                    onChange={(e) => setNewSched({ ...newSched, action: e.target.value })}
                                    className="w-full border-gray-300 rounded-xl shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2.5 outline-none border"
                                >
                                    <option value="on">Turn ON</option>
                                    <option value="off">Turn OFF</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Execute Timer In (Minutes)</label>
                                <input
                                    type="number" min="1" max="1440" required
                                    value={newSched.minutesDelay}
                                    onChange={(e) => setNewSched({ ...newSched, minutesDelay: parseInt(e.target.value) })}
                                    className="w-full border-gray-300 rounded-xl shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2.5 outline-none border"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                            <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 font-bold text-gray-500 hover:text-gray-700">Cancel</button>
                            <button type="submit" disabled={submitting} className="bg-blue-600 px-6 py-2 rounded-lg font-bold text-white shadow-md flex items-center gap-2">
                                {submitting && <Loader2 size={16} className="animate-spin" />} Save Timer
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid gap-4">
                {schedules.length === 0 && !isCreating && (
                    <div className="text-center py-16 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                        <Clock className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                        <h3 className="text-lg font-bold text-gray-900">No active routines</h3>
                        <p className="text-gray-500 font-medium">Create your first automated timer above.</p>
                    </div>
                )}

                {schedules.map(sched => {
                    const runDate = new Date(sched.runAt);
                    const isON = sched.action === 'on';
                    return (
                        <div key={sched.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-4">
                                <div className={`p-4 rounded-xl shadow-inner ${isON ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                                    <Power size={24} />
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-gray-900 text-lg">{sched.device?.name || 'Device'}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`text-[11px] font-black tracking-wider uppercase px-2.5 py-0.5 rounded-full ${isON ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                                            Turn {sched.action}
                                        </span>
                                        <span className="text-sm font-semibold text-gray-500 flex items-center gap-1.5 border-l border-gray-300 pl-2">
                                            <Clock size={14} />
                                            {sched.type === 'once' ? <span>Executes at <b>{runDate.toLocaleTimeString()}</b> ({runDate.toLocaleDateString()})</span> : sched.cron}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => handleDelete(sched.id)} className="p-3 text-red-400 hover:text-white hover:bg-red-500 rounded-xl transition-colors">
                                <Trash2 size={20} />
                            </button>
                        </div>
                    )
                })}
            </div>
        </div>
    );
}
