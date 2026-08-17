import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PLANS, useCampaigns, useMerchants, type MerchantRow } from "./-data";
import {
  MerchantDialog,
  PlanBadge,
  PlanSelect,
  StatusBadge,
  SubscriptionBadge,
  UNSET,
  useReviewActions,
} from "./-ui";

export const Route = createFileRoute("/console/merchants")({
  component: Merchants,
});

function Merchants() {
  const { isAdmin } = useAuth();
  const merchants = useMerchants(isAdmin);
  const campaigns = useCampaigns(isAdmin);
  const { setPlan } = useReviewActions();

  const [q, setQ] = useState("");
  const [planFilter, setPlanFilter] = useState("全部");
  const [statusFilter, setStatusFilter] = useState("全部");
  const [open, setOpen] = useState<MerchantRow | null>(null);

  const all = merchants.data ?? [];
  const cList = campaigns.data ?? [];
  const kw = q.trim().toLowerCase();

  const rows = all
    .filter(
      (m) =>
        !kw ||
        m.store_name.toLowerCase().includes(kw) ||
        (m.contact_name ?? "").toLowerCase().includes(kw) ||
        (m.email ?? "").toLowerCase().includes(kw) ||
        (m.region ?? "").toLowerCase().includes(kw),
    )
    .filter((m) => {
      if (planFilter === "全部") return true;
      if (planFilter === UNSET) return !m.foodie_plan;
      return m.foodie_plan === planFilter;
    })
    .filter((m) => statusFilter === "全部" || m.verification_status === statusFilter);

  const campaignCount = (userId: string) => cList.filter((c) => c.merchant_id === userId).length;

  const planCards = PLANS.map((p) => {
    const list = all.filter((m) => m.foodie_plan === p.key);
    return {
      ...p,
      count: list.length,
      pending: list.filter((m) => m.verification_status === "pending").length,
    };
  });
  const unsetCount = all.filter((m) => !m.foodie_plan).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#3F2E1E]">商家管理</h1>
          <p className="mt-1 text-sm text-[#A08E7C]">
            共 {all.length} 家商家．檢視註冊資料、設定方案別與審核狀態
          </p>
        </div>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜尋店名、聯絡人、Email"
          className="w-full border-[#EFE3D6] bg-white sm:w-64"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {planCards.map((p) => (
          <Card
            key={p.key}
            className={`cursor-pointer border-[#EFE3D6] transition-colors ${
              planFilter === p.key
                ? "border-[#FF8300] bg-[#FFF4E8]"
                : "bg-white hover:border-[#FFC894]"
            }`}
            onClick={() => setPlanFilter(planFilter === p.key ? "全部" : p.key)}
          >
            <CardHeader className="pb-1">
              <p className="text-sm font-semibold text-[#3F2E1E]">{p.label}</p>
              <p className="text-xs text-[#A08E7C]">{p.desc}</p>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-[#3F2E1E]">
                {p.count}
                <span className="ml-1 text-sm font-normal text-[#A08E7C]">家</span>
              </p>
              {p.pending > 0 && (
                <p className="mt-1 text-xs font-medium text-[#FF8300]">{p.pending} 筆待審核</p>
              )}
            </CardContent>
          </Card>
        ))}
        <Card
          className={`cursor-pointer border-[#EFE3D6] transition-colors ${
            planFilter === UNSET
              ? "border-[#FF8300] bg-[#FFF4E8]"
              : "bg-white hover:border-[#FFC894]"
          }`}
          onClick={() => setPlanFilter(planFilter === UNSET ? "全部" : UNSET)}
        >
          <CardHeader className="pb-1">
            <p className="text-sm font-semibold text-[#3F2E1E]">未設定方案</p>
            <p className="text-xs text-[#A08E7C]">尚未指派方案別</p>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[#3F2E1E]">
              {unsetCount}
              <span className="ml-1 text-sm font-normal text-[#A08E7C]">家</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-[#EFE3D6] bg-white">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base text-[#3F2E1E]">
            商家清單（{rows.length}／{all.length}）
          </CardTitle>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32 border-[#EFE3D6]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="全部">全部狀態</SelectItem>
                <SelectItem value="pending">待審核</SelectItem>
                <SelectItem value="approved">已通過</SelectItem>
                <SelectItem value="rejected">已拒絕</SelectItem>
              </SelectContent>
            </Select>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="w-36 border-[#EFE3D6]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="全部">全部方案</SelectItem>
                {PLANS.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.label}
                  </SelectItem>
                ))}
                <SelectItem value={UNSET}>{UNSET}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>店名</TableHead>
                <TableHead>方案別</TableHead>
                <TableHead>訂閱狀態</TableHead>
                <TableHead>設定方案</TableHead>
                <TableHead>聯絡人</TableHead>
                <TableHead>地區</TableHead>
                <TableHead className="text-right">案件數</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium text-[#3F2E1E]">{m.store_name}</TableCell>
                  <TableCell>
                    <PlanBadge plan={m.foodie_plan} />
                  </TableCell>
                  <TableCell>
                    <SubscriptionBadge status={m.foodie_subscription_status} />
                  </TableCell>
                  <TableCell>
                    <PlanSelect value={m.foodie_plan} onChange={(v) => setPlan(m.id, v)} />
                  </TableCell>
                  <TableCell>{m.contact_name ?? "—"}</TableCell>
                  <TableCell>{m.region ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {campaignCount(m.user_id)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={m.verification_status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setOpen(m)}>
                      檢視
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-[#A08E7C]">
                    {all.length === 0 ? "尚無商家資料" : "沒有符合條件的商家"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <MerchantDialog merchant={open} onClose={() => setOpen(null)} />
    </div>
  );
}
