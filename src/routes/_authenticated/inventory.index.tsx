import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  listInventory,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
} from "@/lib/inventory/inventory.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Pencil, Trash2, Package } from "lucide-react";
import { formatMoney } from "@/lib/invoices/invoice-math";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/inventory/")({
  head: () => ({ meta: [{ title: "المخزون — الأصناف" }] }),
  component: InventoryPage,
});

type Item = {
  id: string;
  name: string;
  batch_number: string | null;
  expiry_date: string | null;
  unit: string | null;
  unit_price: number;
};

function InventoryPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);

  const listFn = useServerFn(listInventory);
  const { data: items, isLoading } = useQuery({
    queryKey: ["inventory", search],
    queryFn: () => listFn({ data: { search } }),
  });

  const delFn = useServerFn(deleteInventoryItem);
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("تم الحذف");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <Package className="h-6 w-6" /> أصناف المخزون
        </h1>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4 ms-1" /> صنف جديد
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="بحث باسم الصنف…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-11 pe-9"
        />
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-center py-8">جاري التحميل…</div>
      ) : (items ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            لا توجد أصناف بعد — ابدأ بإضافة أول صنف.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {(items as Item[]).map((it) => (
            <Card key={it.id}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{it.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
                    {it.batch_number && <span>باتش: <span dir="ltr">{it.batch_number}</span></span>}
                    {it.expiry_date && <span>انتهاء: <span dir="ltr">{it.expiry_date}</span></span>}
                    {it.unit && <span>{it.unit}</span>}
                  </div>
                </div>
                <div className="text-end shrink-0">
                  <div className="font-mono font-bold">{formatMoney(it.unit_price)}</div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(it); setOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                    onClick={() => { if (confirm("حذف هذا الصنف؟")) del.mutate(it.id); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ItemDialog open={open} onOpenChange={setOpen} editing={editing} onSaved={() => {
        qc.invalidateQueries({ queryKey: ["inventory"] });
      }} />
    </div>
  );
}

function ItemDialog({
  open, onOpenChange, editing, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Item | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [batch, setBatch] = useState("");
  const [expiry, setExpiry] = useState("");
  const [unit, setUnit] = useState("علبة");
  const [price, setPrice] = useState("0");

  // Reset on open
  useStateReset(open, () => {
    setName(editing?.name ?? "");
    setBatch(editing?.batch_number ?? "");
    setExpiry(editing?.expiry_date ?? "");
    setUnit(editing?.unit ?? "علبة");
    setPrice(String(editing?.unit_price ?? "0"));
  });

  const createF = useServerFn(createInventoryItem);
  const updateF = useServerFn(updateInventoryItem);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        batch_number: batch.trim() || null,
        expiry_date: expiry || null,
        unit: unit.trim() || "علبة",
        unit_price: Number(price) || 0,
      };
      if (!payload.name) throw new Error("اسم الصنف مطلوب");
      if (editing) return updateF({ data: { id: editing.id, ...payload } });
      return createF({ data: payload });
    },
    onSuccess: () => {
      toast.success(editing ? "تم التحديث" : "تمت إضافة الصنف");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "تعديل صنف" : "صنف جديد"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>اسم الصنف *</Label>
            <Input className="h-11" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: باراسيتامول 500" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>رقم الباتش</Label>
              <Input className="h-11" dir="ltr" value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="BATCH-001" />
            </div>
            <div className="space-y-1.5">
              <Label>تاريخ الانتهاء</Label>
              <Input className="h-11" dir="ltr" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>الوحدة</Label>
              <Input className="h-11" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="علبة / شريط / كرتون" />
            </div>
            <div className="space-y-1.5">
              <Label>السعر *</Label>
              <Input className="h-11 font-mono" dir="ltr" type="number" inputMode="decimal" min="0" step="0.01"
                value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "جاري الحفظ…" : "حفظ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Tiny helper: re-run effect when `open` flips to true
import { useEffect } from "react";
function useStateReset(open: boolean, fn: () => void) {
  useEffect(() => {
    if (open) fn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}