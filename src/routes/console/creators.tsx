import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
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
import { collabStats, platformsOf, useApplications, useFoodies, type FoodieRow } from "./-data";
import { FoodieDialog, StatusBadge } from "./-ui";

export const Route = createFileRoute("/console/creators")({
  component: Creators,
});

/** KOC 與 KOL 以總粉絲數區分，門檻可依營運需求調整。 */
const KOL_THRESHOLD = 10000;

const PLATFORMS = ["全部", "Instagram", "Threads", "YouTube"];

function Creators() {
  const { isAdmin } = useAuth();
  const foodies = useFoodies(isAdmin);
  const applications = useApplications(isAdmin);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("全部");
  const [platformFilter, setPlatformFilter] = useState("全部");
  const [tierFilter, setTierFilter] = useState("全部");
  const [open, setOpen] = useState<FoodieRow | null>(null);

  const all = foodies.data ?? [];
  const apps = applications.data ?? [];
  const kw = q.trim().toLowerCase();

  const reachOf = (f: FoodieRow) => platformsOf(f).reduce((n, p) => n + p.followers, 0);
  const tierOf = (f: FoodieRow) => (reachOf(f) >= KOL_THRESHOLD ? "KOL" : "KOC");

  const rows = all
    .filter(
      (f) =>
        !kw ||
        f.nickname.toLowerCase().includes(kw) ||
        (f.real_name ?? "").toLowerCase().includes(kw) ||
        (f.ig_handle ?? "").toLowerCase().includes(kw) ||
        (f.email ?? "").toLowerCase().includes(kw),
    )
    .filter((f) => statusFilter === "全部" || f.verification_status === statusFilter)
    .filter(
      (f) => platformFilter === "全部" || platformsOf(f).some((p) => p.name === platformFilter),
    )
    .filter((f) => tierFilter === "全部" || tierOf(f) === tierFilter)
    .sort((a, b) => reachOf(b) - reachOf(a));

  const kolCount = all.filter((f) => tierOf(f) === "KOL").length;
  const kocCount = all.length - kolCount;
  const totalReach = all.reduce((n, f) => n + reachOf(f), 0);
  const pending = all.filter((f) => f.verification_status === "pending").length;

  const cards: { label: string; value: string; hint?: string; filter?: string }[] = [
    {
      label: "KOL",
      value: String(kolCount),
      hint: `粉絲 ${KOL_THRESHOLD.toLocaleString()} 以上`,
      filter: "KOL",
    },
    {
      label: "KOC",
      value: String(kocCount),
      hint: `粉絲 ${KOL_THRESHOLD.toLocaleString()} 以下`,
      filter: "KOC",
    },
    { label: "總觸及", value: totalReach.toLocaleString(), hint: "所有平台粉絲數合計" },
    { label: "待審核", value: String(pending), hint: "需人工查驗" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#3F2E1E]">Foodie 管理</h1>
          <p className="mt-1 text-sm text-[#A08E7C]">
            共 {all.length} 位創作者．依總粉絲數排序，可檢視成效與人工查驗
          </p>
        </div>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜尋暱稱、真實姓名、IG 帳號"
          className="w-full border-[#EFE3D6] bg-white sm:w-64"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card
            key={c.label}
            className={`border-[#EFE3D6] transition-colors ${
              c.filter
                ? `cursor-pointer ${
                    tierFilter === c.filter
                      ? "border-[#FF8300] bg-[#FFF4E8]"
                      : "bg-white hover:border-[#FFC894]"
                  }`
                : "bg-white"
            }`}
            onClick={() => c.filter && setTierFilter(tierFilter === c.filter ? "全部" : c.filter)}
          >
            <CardHeader className="pb-1">
              <p className="text-xs text-[#A08E7C]">{c.label}</p>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-[#3F2E1E]">{c.value}</p>
              {c.hint && <p className="mt-1 text-xs text-[#A08E7C]">{c.hint}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-[#EFE3D6] bg-white">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base text-[#3F2E1E]">
            創作者清單（{rows.length}／{all.length}）
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
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="w-32 border-[#EFE3D6]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p === "全部" ? "全部平台" : p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>暱稱</TableHead>
                <TableHead>分級</TableHead>
                <TableHead>宣傳平台</TableHead>
                <TableHead className="text-right">總粉絲數</TableHead>
                <TableHead className="text-right">合作次數（完成／申請）</TableHead>
                <TableHead>地區</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((f) => {
                const platforms = platformsOf(f);
                const stats = collabStats(apps, f.user_id);
                return (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium text-[#3F2E1E]">{f.nickname}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          tierOf(f) === "KOL"
                            ? "bg-[#FF8300] text-white hover:bg-[#FF8300]"
                            : "bg-[#FFF4E8] text-[#B85C00] hover:bg-[#FFF4E8]"
                        }
                      >
                        {tierOf(f)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {platforms.length === 0 ? (
                          <span className="text-sm text-[#A08E7C]">未填寫</span>
                        ) : (
                          platforms.map((p) => (
                            <Badge key={p.name} variant="secondary" className="text-xs">
                              {p.name}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-[#3F2E1E]">
                      {reachOf(f).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {stats.completed}
                      {stats.total > 0 && (
                        <span className="text-xs text-[#A08E7C]"> / {stats.total}</span>
                      )}
                    </TableCell>
                    <TableCell>{[f.region, f.area].filter(Boolean).join(" · ") || "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={f.verification_status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setOpen(f)}>
                        檢視
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-[#A08E7C]">
                    {all.length === 0 ? "尚無創作者資料" : "沒有符合條件的創作者"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <FoodieDialog foodie={open} apps={apps} onClose={() => setOpen(null)} />
    </div>
  );
}
