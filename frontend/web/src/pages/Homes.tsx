import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listHomes, createHome, renameHome, transferHome, deleteHome, listMembers } from "../api/homes";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Alert } from "../components/ui/Alert";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { Home as HomeIcon, Plus, Edit2, Crown, Trash2, Users, Cpu } from "lucide-react";

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
    onError: () => setError("Failed to create home"),
  });

  const rename = useMutation({
    mutationFn: () => renameHome(renaming!.id, renaming!.name),
    onSuccess: () => {
      setRenaming(null);
      invalidate();
    },
    onError: () => setError("Failed to rename home"),
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
    onError: () => setError("Failed to delete home"),
  });

  return (
    <div className="page-enter mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          Family Homes
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage your residential locations, device memberships, and ownership permissions.
        </p>
      </div>

      {error && (
        <div className="mb-6">
          <Alert variant="danger" onClose={() => setError("")}>
            {error}
          </Alert>
        </div>
      )}

      {/* Create Home Card */}
      <div className="mb-8 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Add New Home</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Skyline Residence or City Flat"
            className="flex-1"
          />
          <Button
            onClick={() => create.mutate()}
            disabled={!newName.trim() || create.isPending}
            loading={create.isPending}
            variant="primary"
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Create Home
          </Button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {homes.isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <Skeleton className="h-6 w-1/3 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Zero State */}
      {!homes.isLoading && homes.data?.success && homes.data.data.length === 0 && (
        <EmptyState
          icon={<HomeIcon className="h-8 w-8 text-slate-400" />}
          title="No Homes Found"
          description="You are not part of any home yet. Create your first home to start adding smart devices."
        />
      )}

      {/* List */}
      <div className="space-y-4">
        {homes.data?.success &&
          homes.data.data.map((h) => {
            const role = h.members[0]?.role ?? "member";
            const isOwner = role === "owner";
            return (
              <div
                key={h.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 dark:bg-brand/15 text-brand">
                    <HomeIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {h.name}
                      </h3>
                      <Badge
                        variant={isOwner ? "primary" : role === "admin" ? "info" : "neutral"}
                      >
                        {role}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Cpu className="h-3.5 w-3.5 text-slate-400" />
                        {h._count.devices} {h._count.devices === 1 ? "device" : "devices"}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-slate-400" />
                        {h._count.members} {h._count.members === 1 ? "member" : "members"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
                  {isOwner && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRenaming({ id: h.id, name: h.name })}
                        leftIcon={<Edit2 className="h-3.5 w-3.5" />}
                      >
                        Rename
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setTransferring({ id: h.id });
                          setTransferTarget("");
                        }}
                        leftIcon={<Crown className="h-3.5 w-3.5" />}
                      >
                        Transfer
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          if (
                            confirm(
                              `Delete "${h.name}"? All associated devices, rooms, and memberships will be permanently removed.`
                            )
                          ) {
                            remove.mutate(h.id);
                          }
                        }}
                        leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
      </div>

      {/* Rename modal */}
      {renaming && (
        <Modal title="Rename Home" onClose={() => setRenaming(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (renaming.name.trim()) rename.mutate();
            }}
            className="space-y-4"
          >
            <Input
              label="Home Name"
              value={renaming.name}
              onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
              autoFocus
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setRenaming(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={!renaming.name.trim() || rename.isPending}
                loading={rename.isPending}
              >
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Transfer modal */}
      {transferring && (
        <Modal title="Transfer Ownership" onClose={() => setTransferring(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Select an existing home member to become the new primary owner. Your role will be reassigned to Admin.
            </p>
            <Select
              label="Select Member"
              value={transferTarget}
              onChange={(e) => setTransferTarget(e.target.value)}
            >
              <option value="">— Select a member —</option>
              {membersForTransfer.data?.success &&
                membersForTransfer.data.data
                  .filter((m) => m.role !== "owner")
                  .map((m) => (
                    <option key={m.id} value={m.userId}>
                      {m.user?.username ?? `User #${m.userId}`} ({m.role})
                    </option>
                  ))}
            </Select>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setTransferring(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => transfer.mutate()}
                disabled={!transferTarget || transfer.isPending}
                loading={transfer.isPending}
              >
                Confirm Transfer
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
