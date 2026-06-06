import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listInvoices } from "@/lib/invoices/invoices.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/invoices/invoice-math";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/invoices/")({
  head: () => ({ meta: [{ title: "الفواتير" }] }),
  component: InvoicesPage,
});

function InvoicesPage() {
  const [tab, setTab] = useState<"all" | "sales" | "quotation" | "credit_note">("all");
  const fn = useServerFn(listInvoices);
  const { data, isLoading } = useQuery({
    queryKey: ["invoices", tab],
    queryFn: () => fn({ data: tab === "all" ? {} : { invoice_type: tab } }),
  });

  const quotationSeq = (num: string) => {
    const m = num.match(/QT-(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">{tab === "quotation" ? "عروض الأسعار" : "الفواتير"}</h1>
        <Link to="/invoices/new"><Button><Plus className="h-4 w-4 ms-1" /> فاتورة جديدة</Button></Link>
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="grid w-full grid-cols-4 sm:w-auto sm:inline-flex">
          <TabsTrigger value="all">الكل</TabsTrigger>
          <TabsTrigger value="sales">مبيعات</TabsTrigger>
          <TabsTrigger value="quotation">عروض أسعار</TabsTrigger>
          <TabsTrigger value="credit_note">مرتجع</TabsTrigger>
        </TabsList>
      </Tabs>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الرقم</TableHead>
                {tab === "quotation" && <TableHead>التسلسل</TableHead>}
                <TableHead>التاريخ</TableHead>
                <TableHead>العميل</TableHead>
                {tab !== "quotation" && <TableHead>النوع</TableHead>}
                {tab === "quotation" && <TableHead>الصلاحية</TableHead>}
                <TableHead className="text-end">الإجمالي</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">جاري التحميل…</TableCell></TableRow>
              ) : !data || data.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">لا توجد فواتير بعد.</TableCell></TableRow>
              ) : data.map((inv: any) => {
                const seq = quotationSeq(inv.invoice_number);
                const ageDays = Math.floor((Date.now() - new Date(inv.invoice_date).getTime()) / 86400000);
                const expired = inv.invoice_type === "quotation" && ageDays > 7;
                return (
                <TableRow key={inv.id}>
                  <TableCell>
                    <Link to="/invoices/$id" params={{ id: inv.id }} className="text-primary hover:underline">
                      {inv.invoice_number}
                    </Link>
                  </TableCell>
                  {tab === "quotation" && (
                    <TableCell className="font-mono">{seq !== null ? `#${seq}` : "—"}</TableCell>
                  )}
                  <TableCell dir="ltr" className="text-start">{inv.invoice_date}</TableCell>
                  <TableCell>{inv.customers?.name ?? "—"}</TableCell>
                  {tab !== "quotation" && (
                    <TableCell>
                      <Badge variant={inv.invoice_type === "sales" ? "default" : inv.invoice_type === "quotation" ? "outline" : "secondary"}>
                        {inv.invoice_type === "sales" ? "مبيعات" : inv.invoice_type === "quotation" ? "عرض سعر" : "تعويضية"}
                      </Badge>
                    </TableCell>
                  )}
                  {tab === "quotation" && (
                    <TableCell>
                      <Badge variant={expired ? "secondary" : "default"}>
                        {expired ? "منتهي" : "ساري"}
                      </Badge>
                    </TableCell>
                  )}
                  <TableCell className="text-end font-mono">{formatMoney(inv.total)}</TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}