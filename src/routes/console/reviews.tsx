import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  collabStats,
  platformsOf,
  useApplications,
  useFoodies,
  useMerchants,
  type FoodieRow,
  type MerchantRow,
} from "./-data";
import { FoodieDialog, MerchantDialog, PlanBadge, StatusBadge } from "./-ui";

export const Route = createFileRoute("/console/reviews")({
  component: Reviews,
});

function Reviews() {
  const { isAdmin } = useAuth();
  const merchants = useMerchants(isAdmin);
  const foodies = useFoodies(isAdmin);
  const applications = useApplications(isAdmin);

  const [onlyPending, setOnlyPending] = useState(true);
  const [openMerchant, setOpenMerchant] = useState<MerchantRow | null>(null);
  const [openFoodie, setOpenFoodie] = useState<FoodieRow | null>(null);

  const mAll = merchants.data ?? [];
  const fAll = foodies.data ?? [];
  const apps = applications.data ?? [];

  const mList = mAll.filter((m) => !onlyPending || m.verification_status === "pending");
  const fList = fAll.filter((f) => !onlyPending || f.verification_status === "pending");
  const mPending = mAll.filter((m) => m.verification_status === "pending").length;
  const fPending = fAll.filter((f) => f.verification_status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#3F2E1E]">資格審核</h1>
          <p className="mt-1 text-sm text-[#A08E7C]">
            待審核佇列．完整名單與方案設定請到「商家管理」與「KOC / KOL 管理」
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-[#EFE3D6] bg-white"
          onClick={() => setOnlyPending((v) => !v)}
        >
          {onlyPending ? "顯示全部" : "只看待審核"}
        </Button>
      </div>

      <Tabs defaultValue="merchants">
        <TabsList>
          <TabsTrigger value="merchants">商家{mPending > 0 && ` (${mPending})`}</TabsTrigger>
          <TabsTrigger value="foodies">KOC / KOL{fPending > 0 && ` (${fPending})`}</TabsTrigger>
        </TabsList>

        <TabsContent value="merchants">
          <Card className="border-[#EFE3D6] bg-white">
            <CardHeader>
              <CardTitle className="text-base text-[#3F2E1E]">商家註冊資料</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>店名</TableHead>
                    <TableHead>方案別</TableHead>
                    <TableHead>聯絡人</TableHead>
                    <TableHead>聯絡方式</TableHead>
                    <TableHead>地區</TableHead>
                    <TableHead>申請時間</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mList.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium text-[#3F2E1E]">{m.store_name}</TableCell>
                      <TableCell>
                        <PlanBadge plan={m.foodie_plan} />
                      </TableCell>
                      <TableCell>{m.contact_name ?? "—"}</TableCell>
                      <TableCell className="text-sm text-[#A08E7C]">
                        {[m.phone, m.email].filter(Boolean).join(" / ") || "—"}
                      </TableCell>
                      <TableCell>{m.region ?? "—"}</TableCell>
                      <TableCell className="text-sm text-[#A08E7C]">
                        {new Date(m.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={m.verification_status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setOpenMerchant(m)}>
                          檢視 / 審核
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {mList.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-[#A08E7C]">
                        {onlyPending ? "沒有待審核的商家" : "尚無商家資料"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="foodies">
          <Card className="border-[#EFE3D6] bg-white">
            <CardHeader>
              <CardTitle className="text-base text-[#3F2E1E]">
                KOC / KOL 註冊資料（人工查驗）
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>暱稱</TableHead>
                    <TableHead>宣傳平台</TableHead>
                    <TableHead className="text-right">總粉絲數</TableHead>
                    <TableHead className="text-right">互動率</TableHead>
                    <TableHead className="text-right">合作次數</TableHead>
                    <TableHead>地區</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fList.map((f) => {
                    const platforms = platformsOf(f);
                    const reach = platforms.reduce((n, p) => n + p.followers, 0);
                    const stats = collabStats(apps, f.user_id);
                    return (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium text-[#3F2E1E]">{f.nickname}</TableCell>
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
                        <TableCell className="text-right tabular-nums">
                          {reach.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {f.engagement_rate ? `${f.engagement_rate}%` : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {stats.completed}
                          {stats.total > 0 && (
                            <span className="text-xs text-[#A08E7C]"> / {stats.total}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {[f.region, f.area].filter(Boolean).join(" · ") || "—"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={f.verification_status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => setOpenFoodie(f)}>
                            檢視 / 審核
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {fList.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-[#A08E7C]">
                        {onlyPending ? "沒有待審核的創作者" : "尚無創作者資料"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <MerchantDialog merchant={openMerchant} onClose={() => setOpenMerchant(null)} />
      <FoodieDialog foodie={openFoodie} apps={apps} onClose={() => setOpenFoodie(null)} />
    </div>
  );
}
