import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listHomes, createHome, renameHome, transferHome, deleteHome, listMembers } from "../api/homes";
import { Modal } from "../components/Modal";

export function Homes() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<{ id: number; name: string } | null>(null);
  const [transferring, setTransferring] = useState<{ id: number } | null>(null);
  const [transferTarget, setTransferTarget] = useState("");
  const [error, setError] = useState("");

  const homes = useQuery({ queryKey: ["homes"], queryFn: listHomes, refetchInterval: 30_000 });
  const membersForTransfer = useQuery({
    queryKey: ["members", transferring?.id],
    queryFn: () => listMembers(transferring!.id),
    enabled: transferring !== null,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["homes"] });

  const create = useMutation({
    mutationFn: () => createHome(newName),
    onSuccess: () => {
      setNewName("");
      invalidate();
    },
  });

  const rename = useMutation({
    mutationFn: () => renameHome(renaming!.id, renaming!.name),
    onSuccess: () => {
      setRenaming(null);
      invalidate();
    },
  });

  const transfer = useMutation({
    mutationFn: () => transferHome(transferring!.id, Number(transferTarget)),
    onSuccess: () => {
      setTransferring(null);
      setTransferTarget("");
      invalidate();
    },
    onError: () => setError("Transfer failed"),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteHome(id),
    onSuccess: invalidate,
  });

  return (
    <div className="page-enter mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold">🏠 Homes</h1>
      <p className="mb-8 text-sm text-gray-500">
        Your family homes. Devices belong to a home — you own the home you created.
      </p>

      {error && (
        <p className="mb-4 rounded bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>
      )}

      {/* Create */}
      <div className="mb-8 flex gap-3 rounded-xl border border-brand/20 bg-night-800 p-5">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New home name (e.g. Sharma Family Home)"
          className="flex-1 rounded-lg border border-brand/20 bg-night-900 px-3 py-2.5 text-sm outline-none focus:border-brand"
        />
        <button
          onClick={() => create.mutate()}
          disabled={!newName || create.isPending}
          className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Create Home
        </button>
      </div>

      {/* List */}
      <div className="space-y-4">
        {homes.data?.success &&
          homes.data.data.map((h) => {
            const role = h.members[0]?.role;
            const isOwner = role === "owner";
            return (
              <div
                key={h.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-200 bg-night-800 px-5 py-4"
              >
                <div>
                  <h3 className="text-lg font-semibold">🏠 {h.name}</h3>
                  <p className="text-xs text-gray-500">
                    {h._count.devices} devices · {h._count.members} members · you are{" "}
                    <span className="text-brand">{role}</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {isOwner && (
                    <>
                      <button
                        onClick={() => setRenaming({ id: h.id, name: h.name })}
                        className="rounded bg-gray-100/60 px-3 py-1.5 text-gray-700 hover:bg-gray-200"
                      >
                        ✏️ Rename
                      </button>
                      <button
                        onClick={() => {
                          setTransferring({ id: h.id });
                          setTransferTarget("");
                        }}
                        className="rounded bg-gray-100/60 px-3 py-1.5 text-gray-700 hover:bg-gray-200"
                      >
                        👑 Transfer
                      </button>
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              `Delete "${h.name}"? All its devices, rooms and memberships will be removed.`,
                            )
                          ) {
                            remove.mutate(h.id);
                          }
                        }}
                        className="rounded bg-red-900/40 px-3 py-1.5 text-red-400 hover:bg-red-900/60"
                      >
                        🗑️ Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
      </div>

      {/* Rename modal */}
      {renaming && (
        <Modal title={`Rename home`} onClose={() => setRenaming(null)}>
          <input
            value={renaming.name}
            onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
            className="mb-4 w-full rounded-lg border border-brand/20 bg-night-900 px-3 py-2.5 text-sm outline-none focus:border-brand"
          />
          <button
            onClick={() => rename.mutate()}
            disabled={!renaming.name || rename.isPending}
            className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Save
          </button>
        </Modal>
      )}

      {/* Transfer modal */}
      {transferring && (
        <Modal title={`Transfer ownership`} onClose={() => setTransferring(null)}>
          <p className="mb-4 text-sm text-gray-500">
            Choose a member to become the new owner. You will become an admin.
          </p>
          <select
            value={transferTarget}
            onChange={(e) => setTransferTarget(e.target.value)}
            className="mb-4 w-full rounded-lg border border-brand/20 bg-night-900 px-3 py-2.5 text-sm outline-none focus:border-brand"
          >
            <option value="">— select member —</option>
            {membersForTransfer.data?.success &&
              membersForTransfer.data.data
                .filter((m) => m.role !== "owner")
                .map((m) => (
                  <option key={m.id} value={m.userId}>
                    {m.user?.username} ({m.role})
                  </option>
                ))}
          </select>
          <button
            onClick={() => transfer.mutate()}
            disabled={!transferTarget || transfer.isPending}
            className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Transfer Ownership
          </button>
        </Modal>
      )}
    </div>
  );
}
