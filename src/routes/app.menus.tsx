import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { requireCompanyAdmin } from "@/lib/guards";
import { useStore } from "@/lib/store";
import { useLang, loc } from "@/lib/i18n";
import { menusApi, queuesApi, branchesApi, type Menu, type QueueGroup } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import {
  Plus, Trash2, ChevronRight, Ticket, FolderOpen, GripVertical,
  Eye, EyeOff, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/menus")({
  beforeLoad: requireCompanyAdmin,
  component: Menus,
});

// A menu item is a "leaf" if it has a queue linked — it ends in a ticket issue
const isLeaf = (m: Menu) => !!m.queue_group_id;

function Menus() {
  const { user } = useAuthStore();
  const { currentCompanyId, currentBranchId } = useStore();
  const { lang } = useLang();
  const qc = useQueryClient();
  const companyId = user?.type === "company_user" ? user.company_id! : (currentCompanyId ?? "");

  const { data: menus = [], isLoading } = useQuery({
    queryKey: ["menus", companyId],
    queryFn: () => menusApi.list({ company_id: companyId }).then((r) => r.data),
    enabled: !!companyId,
  });

  const { data: queues = [] } = useQuery({
    queryKey: ["queues", companyId, currentBranchId],
    queryFn: () => queuesApi.list({
      company_id: companyId,
      ...(currentBranchId && { branch_id: currentBranchId }),
    }).then((r) => r.data),
    enabled: !!companyId,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["branches", companyId],
    queryFn: () => branchesApi.list({ company_id: companyId }).then((r) => r.data),
    enabled: !!companyId,
  });

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Menu | null>(null); // null = creating new
  const [parentId, setParentId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    label: "",
    queue_group_id: "",
    icon_class: "",
    is_visible: true,
  });

  const openCreate = (parent: Menu | null = null) => {
    setEditItem(null);
    setParentId(parent?.id ?? null);
    setForm({ name: "", label: "", queue_group_id: "", icon_class: "", is_visible: true });
    setDialogOpen(true);
  };

  const openEdit = (item: Menu) => {
    setEditItem(item);
    setParentId(item.parent_id ?? null);
    setForm({
      name: item.name,
      label: item.label ?? item.name,
      queue_group_id: item.queue_group_id ?? "",
      icon_class: item.icon_class ?? "",
      is_visible: item.is_visible,
    });
    setDialogOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: () =>
      menusApi.create({
        company_id: companyId,
        parent_id: parentId ?? undefined,
        name: form.name,
        label: form.label || form.name,
        queue_group_id: form.queue_group_id || undefined,
        icon_class: form.icon_class || undefined,
        is_visible: form.is_visible,
        sort_order: menus.length,
      }),
    onSuccess: () => {
      toast.success("Menu item created");
      setDialogOpen(false);
      void qc.invalidateQueries({ queryKey: ["menus"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      menusApi.update(editItem!.id, {
        name: form.name,
        label: form.label || form.name,
        queue_group_id: form.queue_group_id || null,
        icon_class: form.icon_class || undefined,
        is_visible: form.is_visible,
      }),
    onSuccess: () => {
      toast.success("Updated");
      setDialogOpen(false);
      void qc.invalidateQueries({ queryKey: ["menus"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => menusApi.delete(id),
    onSuccess: () => {
      toast.success("Deleted");
      void qc.invalidateQueries({ queryKey: ["menus"] });
    },
  });

  const moveMutation = useMutation({
    mutationFn: (items: Array<{ id: string; sort_order: number }>) =>
      menusApi.reorder(items),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["menus"] }),
  });

  const move = (items: Menu[], idx: number, dir: -1 | 1) => {
    const arr = [...items];
    const to = idx + dir;
    if (to < 0 || to >= arr.length) return;
    [arr[idx], arr[to]] = [arr[to], arr[idx]];
    moveMutation.mutate(arr.map((item, i) => ({ id: item.id, sort_order: i })));
  };

  const getQueueName = (queueGroupId: string | null | undefined) => {
    if (!queueGroupId) return null;
    const q = queues.find((q) => q.id === queueGroupId);
    return q ? (loc(q as unknown as Record<string, unknown>, "name", lang) || q.name_uz) : queueGroupId.slice(0, 8);
  };

  if (!companyId) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
        Select a company first.
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kiosk Menu Builder</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Build a tree of menus for your kiosk. Leaf items (with a queue linked) issue tickets.
          </p>
        </div>
        <Button onClick={() => openCreate()}>
          <Plus className="mr-1.5 h-4 w-4" /> Add menu item
        </Button>
      </div>

      {/* How it works */}
      <div className="mb-5 grid grid-cols-3 gap-3 text-sm">
        {[
          { icon: FolderOpen, title: "Category", desc: "No queue linked — navigates to sub-items", color: "text-blue-600" },
          { icon: Ticket,     title: "Service",  desc: "Queue linked — tapping issues a ticket",  color: "text-green-600" },
          { icon: ChevronRight, title: "Nesting", desc: "Categories can contain categories or services", color: "text-purple-600" },
        ].map(({ icon: Icon, title, desc, color }) => (
          <div key={title} className="flex items-start gap-3 rounded-xl border bg-card p-4">
            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${color}`} />
            <div>
              <p className="font-semibold text-sm">{title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : menus.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          <FolderOpen className="mx-auto mb-3 h-8 w-8 opacity-30" />
          <p className="font-medium">No menu items yet</p>
          <p className="mt-1 text-sm">Create your first item above. Add categories then link services to queues.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {menus.map((item, idx) => (
            <MenuTreeItem
              key={item.id}
              item={item}
              idx={idx}
              total={menus.length}
              depth={0}
              lang={lang}
              queues={queues as QueueGroup[]}
              onEdit={openEdit}
              onDelete={(id) => {
                if (confirm("Delete this item and all its children?")) deleteMutation.mutate(id);
              }}
              onAddChild={openCreate}
              onMove={(i, d) => move(menus, i, d)}
              getQueueName={getQueueName}
            />
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editItem ? "Edit menu item" : parentId ? "Add sub-item" : "Add menu item"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Consulting, Reception, Floor 2…"
                className="mt-1"
                autoFocus
              />
            </div>
            <div>
              <Label>Display label <span className="text-xs text-muted-foreground">(shown on kiosk button, defaults to name)</span></Label>
              <Input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder={form.name || "Label…"}
                className="mt-1"
              />
            </div>

            {/* Queue link — makes this item a leaf that issues tickets */}
            <div>
              <Label className="flex items-center gap-1.5">
                <Ticket className="h-3.5 w-3.5 text-green-600" />
                Link to queue
                <span className="text-xs text-muted-foreground font-normal ml-1">
                  (leave blank to make this a navigation category)
                </span>
              </Label>
              <Select
                value={form.queue_group_id || "__none__"}
                onValueChange={(v) => setForm({ ...form, queue_group_id: v === "__none__" ? "" : v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="No queue — category only" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <FolderOpen className="h-3.5 w-3.5" /> No queue — category
                    </span>
                  </SelectItem>
                  {(queues as QueueGroup[]).length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      No queues found — create queues first
                    </div>
                  ) : (
                    (queues as QueueGroup[]).map((q) => (
                      <SelectItem key={q.id} value={q.id}>
                        <span className="flex items-center gap-2">
                          <Ticket className="h-3.5 w-3.5 text-green-600" />
                          {loc(q as unknown as Record<string, unknown>, "name", lang) || q.name_uz}
                          <span className="text-muted-foreground text-xs">{q.prefix}</span>
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {form.queue_group_id ? (
                <p className="mt-1 text-xs text-green-600">
                  ✓ Tapping this item on the kiosk will issue a ticket
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  This item will open its sub-items when tapped
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={form.is_visible}
                onCheckedChange={(v) => setForm({ ...form, is_visible: v })}
              />
              <Label>Visible on kiosk</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => (editItem ? updateMutation.mutate() : createMutation.mutate())}
              disabled={!form.name || createMutation.isPending || updateMutation.isPending}
            >
              {editItem ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Recursive menu tree item ──────────────────────────────────────────────────
interface TreeItemProps {
  item: Menu;
  idx: number;
  total: number;
  depth: number;
  lang: string;
  queues: QueueGroup[];
  onEdit: (item: Menu) => void;
  onDelete: (id: string) => void;
  onAddChild: (parent: Menu) => void;
  onMove: (idx: number, dir: -1 | 1) => void;
  getQueueName: (id: string | null | undefined) => string | null;
}

function MenuTreeItem({ item, idx, total, depth, lang, queues, onEdit, onDelete, onAddChild, onMove, getQueueName }: TreeItemProps) {
  const [collapsed, setCollapsed] = useState(false);
  const hasChildren = (item.children?.length ?? 0) > 0;
  const leaf = isLeaf(item);
  const queueName = getQueueName(item.queue_group_id);

  return (
    <div>
      <div
        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 transition ${
          leaf
            ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20"
            : "border-border bg-card"
        }`}
        style={{ marginLeft: depth * 24 }}
      >
        {/* Drag handle + reorder */}
        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40" />
        <div className="flex flex-col gap-0.5 shrink-0">
          <button onClick={() => onMove(idx, -1)} disabled={idx === 0}
            className="rounded p-0.5 hover:bg-muted disabled:opacity-20 transition">
            <ChevronUp className="h-3 w-3" />
          </button>
          <button onClick={() => onMove(idx, 1)} disabled={idx === total - 1}
            className="rounded p-0.5 hover:bg-muted disabled:opacity-20 transition">
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        {/* Icon */}
        {leaf
          ? <Ticket className="h-4 w-4 shrink-0 text-green-600" />
          : <FolderOpen className="h-4 w-4 shrink-0 text-blue-500" />
        }

        {/* Label */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{item.label || item.name}</span>
            {!item.is_visible && (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">Hidden</Badge>
            )}
            {queueName && (
              <Badge variant="secondary" className="text-[10px] text-green-700 bg-green-100 dark:bg-green-900 dark:text-green-300">
                → {queueName}
              </Badge>
            )}
          </div>
          {item.name !== item.label && item.label && (
            <p className="text-xs text-muted-foreground">{item.name}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Collapse children */}
          {hasChildren && (
            <button onClick={() => setCollapsed(!collapsed)}
              className="rounded p-1.5 text-muted-foreground hover:bg-muted transition text-xs">
              {collapsed ? "▶" : "▼"}
            </button>
          )}
          {/* Add child */}
          {!leaf && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1"
              onClick={() => onAddChild(item)}>
              <Plus className="h-3 w-3" /> Add sub-item
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs"
            onClick={() => onEdit(item)}>
            Edit
          </Button>
          <button onClick={() => onDelete(item.id)}
            className="rounded p-1.5 text-destructive hover:bg-destructive/10 transition">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Children */}
      {!collapsed && hasChildren && (
        <div className="mt-1 space-y-1">
          {(item.children ?? []).map((child, cidx) => (
            <MenuTreeItem
              key={child.id}
              item={child}
              idx={cidx}
              total={item.children!.length}
              depth={depth + 1}
              lang={lang}
              queues={queues}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
              onMove={(i, d) => {
                const arr = [...item.children!];
                const to = i + d;
                if (to < 0 || to >= arr.length) return;
                [arr[i], arr[to]] = [arr[to], arr[i]];
                // Would call reorder API here for children
              }}
              getQueueName={getQueueName}
            />
          ))}
        </div>
      )}
    </div>
  );
}

