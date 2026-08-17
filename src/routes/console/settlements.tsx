import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  currentPeriod,
  MISSING_TABLE,
  planOf,
  rawSupabase,
  TWD,
  useApplications,
  useFoodies,
  useMerchants,
  useSettlements,
  type ApplicationRow,
  type Settlement,
  type SettlementStatus,
} from "./-data";

export const Route = createFileRoute("/console/settlements")({
  component: Settlements,
});

const S_LABEL: Record<SettlementStatus, string> = {
  pending: "待對帳",
  invoiced: "已請款",
  paid: "已付款",
  void: "作廢",
};

function StatusBadge({ status }: { status: SettlementStatus }) {
  return (
    <Badge
      variant={status === "paid" ? "default" : status === "void" ? "destructive" : "secondary"}
    >
      {S_LABEL[status]}
    </Badge>
  );
}

function Settlements() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const settlements = useSettlements(isAdmin);
  const applications = useApplications(isAdmin);
  const merchants = useMerchants(isAdmin);
  const foodies = useFoodies(isAdmin);

  const [period, setPeriod] = useState(currentPeriod());
  const [target, setTarget] = useState<ApplicationRow | null>(null);
  const [amount, setAmount] = useState("");
  const [fee, setFee] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  // settlements 資料表尚未建立時，Postgres 回傳 42P01。
  const tableMissing = (settlements.error as { code?: string } | null)?.code === MISSING_TABLE;

  const sList = (settlements.data ?? []).filter((s) => !period || s.period === period);
  const aList = applications.data ?? [];
  const settledIds = new Set((settlements.data ?? []).map((s) => s.application_id));
  const billable = aList.filter((a) => a.completed && !settledIds.has(a.id));

  const merchantName = (id: string | undefined) =>
    merchants.data?.find((m) => m.user_id === id)?.store_name ?? "—";
  const foodieName = (id: string) => foodies.data?.find((f) => f.user_id === id)?.nickname ?? "—";

  const total = sList.reduce((n, s) => n + Number(s.amount), 0);
  const totalFee = sList.reduce((n, s) => n + Number(s.platform_fee), 0);
  const paid = sList.filter((s) => s.status === "paid").reduce((n, s) => n + Number(s.amount), 0);
  const unpaid = sList
    .filter((s) => s.status === "pending" || s.status === "invoiced")
    .reduce((n, s) => n + Number(s.amount), 0);

  const openDialog = (a: ApplicationRow) => {
    setTarget(a);
    // 依該商家的方案別預填金額與抽成，Enterprise 為客製報價故留空由人工填寫
    const merchant = merchants.data?.find((m) => m.user_id === a.campaigns?.merchant_id);
    const plan = planOf(merchant?.plan);
    setAmount(plan?.price != null ? String(plan.price) : "");
    setFee(plan?.platformFee != null ? String(plan.platformFee) : "");
    setNote("");
  };

  const create = async () => {
    if (!target) return;
    setBusy(true);
    const { error } = await rawSupabase.from("settlements").insert({
      application_id: target.id,
      merchant_id: target.campaigns?.merchant_id,
      creator_id: target.creator_id,
      period,
      amount: Number(amount) || 0,
      platform_fee: Number(fee) || 0,
      note: note || null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("已建立結算紀錄");
    setTarget(null);
    void qc.invalidateQueries({ queryKey: ["console-settlements"] });
  };

  const setStatus = async (s: Settlement, status: SettlementStatus) => {
    const { error } = await rawSupabase
      .from("settlements")
      .update({ status, paid_at: status === "paid" ? new Date().toISOString() : null })
      .eq("id", s.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`已更新為${S_LABEL[status]}`);
    void qc.invalidateQueries({ queryKey: ["console-settlements"] });
  };

  if (tableMissing) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-[#3F2E1E]">結算對帳</h1>
          <p className="mt-1 text-sm text-[#A08E7C]">記錄每筆合作的金額與付款狀態</p>
        </div>
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-base text-amber-900">尚未建立結算資料表</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-amber-800">
            <p>
              結算功能需要新的 <code className="rounded bg-amber-100 px-1">settlements</code>{" "}
              資料表。migration 檔案已經寫好，但還沒套用到 Supabase。
            </p>
            <p className="font-mono text-xs">supabase/migrations/20260814120000_settlements.sql</p>
            <p>套用之後重新整理此頁即可正常使用，其他頁面不受影響。</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#3F2E1E]">結算對帳</h1>
          <p className="mt-1 text-sm text-[#A08E7C]">記錄每筆合作的金額與付款狀態</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="period" className="text-xs text-[#A08E7C]">
            對帳期間
          </Label>
          <Input
            id="period"
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-40 border-[#EFE3D6] bg-white"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["本期總額", TWD.format(total)],
          ["平台服務費", TWD.format(totalFee)],
          ["已付款", TWD.format(paid)],
          ["未付款", TWD.format(unpaid)],
        ].map(([k, v]) => (
          <Card key={k} className="border-[#EFE3D6] bg-white">
            <CardHeader className="pb-1">
              <p className="text-xs text-[#A08E7C]">{k}</p>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums text-[#3F2E1E]">{v}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="records">
        <TabsList>
          <TabsTrigger value="records">結算紀錄 ({sList.length})</TabsTrigger>
          <TabsTrigger value="billable">待建立 ({billable.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="records">
          <Card className="border-[#EFE3D6] bg-white">
            <CardHeader>
              <CardTitle className="text-base">{period || "全部"} 結算明細</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>案件</TableHead>
                    <TableHead>商家</TableHead>
                    <TableHead>Foodie</TableHead>
                    <TableHead className="text-right">金額</TableHead>
                    <TableHead className="text-right">服務費</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sList.map((s) => {
                    const app = aList.find((a) => a.id === s.application_id);
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">
                          {app?.campaigns?.title ?? "—"}
                        </TableCell>
                        <TableCell>{merchantName(s.merchant_id)}</TableCell>
                        <TableCell>{foodieName(s.creator_id)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {TWD.format(Number(s.amount))}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {TWD.format(Number(s.platform_fee))}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={s.status} />
                        </TableCell>
                        <TableCell className="space-x-2 text-right">
                          {s.status !== "paid" && s.status !== "void" && (
                            <>
                              {s.status === "pending" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setStatus(s, "invoiced")}
                                >
                                  請款
                                </Button>
                              )}
                              <Button size="sm" onClick={() => setStatus(s, "paid")}>
                                標記已付
                              </Button>
                            </>
                          )}
                          {s.status === "paid" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setStatus(s, "invoiced")}
                            >
                              取消付款
                            </Button>
                          )}
                          {s.status !== "void" && (
                            <Button size="sm" variant="ghost" onClick={() => setStatus(s, "void")}>
                              作廢
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {sList.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-[#A08E7C]">
                        此期間尚無結算紀錄
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billable">
          <Card className="border-[#EFE3D6] bg-white">
            <CardHeader>
              <CardTitle className="text-base">已完成但尚未建立結算的合作</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>案件</TableHead>
                    <TableHead>商家</TableHead>
                    <TableHead>Foodie</TableHead>
                    <TableHead>完成時間</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {billable.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.campaigns?.title ?? "—"}</TableCell>
                      <TableCell>
                        {a.campaigns?.restaurant_name ?? merchantName(a.campaigns?.merchant_id)}
                      </TableCell>
                      <TableCell>{foodieName(a.creator_id)}</TableCell>
                      <TableCell className="text-sm text-[#A08E7C]">
                        {a.completed_at ? new Date(a.completed_at).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={() => openDialog(a)}>
                          建立結算
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {billable.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-[#A08E7C]">
                        沒有待建立結算的合作
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={target !== null} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>建立結算紀錄</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-[#A08E7C]">
              {target?.campaigns?.title} · {target ? foodieName(target.creator_id) : ""}
            </p>
            {(() => {
              const m = merchants.data?.find((x) => x.user_id === target?.campaigns?.merchant_id);
              const plan = planOf(m?.plan);
              return (
                <p className="rounded-md border border-[#EFE3D6] bg-[#FDF7F0] px-3 py-2 text-xs text-[#5C4630]">
                  {plan
                    ? `方案 ${plan.key}：${plan.desc}${plan.price == null ? "（金額需人工填寫）" : "，已自動預填"}`
                    : "此商家尚未設定方案別，金額需人工填寫"}
                </p>
              );
            })()}
            <div className="space-y-2">
              <Label htmlFor="amount">合作金額（TWD）</Label>
              <Input
                id="amount"
                type="number"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fee">平台服務費（TWD）</Label>
              <Input
                id="fee"
                type="number"
                min="0"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">備註</Label>
              <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <p className="text-xs text-[#A08E7C]">對帳期間：{period}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              取消
            </Button>
            <Button onClick={create} disabled={busy}>
              {busy ? "建立中…" : "建立"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
