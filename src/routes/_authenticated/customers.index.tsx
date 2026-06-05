import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listCustomers, createCustomer } from "@/lib/customers/customers.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search } from "lucide-react";
import { formatMoney } from "@/lib/invoices/invoice-math";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/customers/")({
  head: () => ({ meta: [{ title: "العملاء" }] }),
  component: CustomersPage,
});

function CustomersPage() {
  const [search, setSearch] = useState("");
  const fetchFn = useServerFn(listCustomers);
  const { data, isLoading } = useQuery({
    queryKey: ["customers", search],
    queryFn: () => fetchFn({ data: { search } }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">العملاء</h1>
        <NewCustomerDialog />
      </div>

      <div className="relative max-w-sm">
        <Search className="h-4 w-4 absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="ابحث باسم العميل…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pe-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>الهاتف</TableHead>
                <TableHead>الإيميل</TableHead>
                <TableHead>الرقم الضريبي</TableHead>
                <TableHead className="text-end">الرصيد</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">جاري التحميل…</TableCell></TableRow>
              ) : !data || data.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">لا يوجد عملاء بعد.</TableCell></TableRow>
              ) : (
                data.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link to="/customers/$id" params={{ id: c.id }} className="text-primary hover:underline font-medium">
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell dir="ltr" className="text-start">{c.phone || "—"}</TableCell>
                    <TableCell dir="ltr" className="text-start">{c.email || "—"}</TableCell>
                    <TableCell>{c.tax_number || "—"}</TableCell>
                    <TableCell className="text-end font-mono">{formatMoney(c.balance)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function NewCustomerDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", tax_number: "" });
  const qc = useQueryClient();
  const createFn = useServerFn(createCustomer);
  const m = useMutation({
    mutationFn: () => createFn({ data: form }),
    onSuccess: () => {
      toast.success("تم إضافة العميل");
      qc.invalidateQueries({ queryKey: ["customers"] });
      setForm({ name: "", phone: "", email: "", tax_number: "" });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 ms-1" /> عميل جديد</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>إضافة عميل جديد</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>الاسم *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>الهاتف</Label>
            <Input dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>الإيميل</Label>
            <Input dir="ltr" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>الرقم الضريبي</Label>
            <Input value={form.tax_number} onChange={(e) => setForm({ ...form, tax_number: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={!form.name || m.isPending} onClick={() => m.mutate()}>
            {m.isPending ? "جاري الحفظ…" : "حفظ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}