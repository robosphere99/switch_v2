import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { getSupportUnread } from "../api/admin";
import { getSocket } from "../lib/socket";

/** Admin navbar me unread support replies ka live badge — support:new realtime event se update. */
export function SupportUnreadBadge() {
  const queryClient = useQueryClient();

  const unread = useQuery({
    queryKey: ["support", "admin", "unread"],
    queryFn: async () => {
      const r = await getSupportUnread();
      return r.success ? r.data.unread : 0;
    },
    refetchInterval: 30_000,
  });

  // User reply aaye → turant badge update (support:new realtime event)
  useEffect(() => {
    const socket = getSocket();
    const onNew = () => {
      queryClient.invalidateQueries({ queryKey: ["support", "admin", "unread"] });
    };
    socket.on("support:new", onNew);
    return () => {
      socket.off("support:new", onNew);
    };
  }, [queryClient]);

  const count = unread.data ?? 0;
  if (count <= 0) return null;
  return (
    <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow">
      {count > 9 ? "9+" : count}
    </span>
  );
}
