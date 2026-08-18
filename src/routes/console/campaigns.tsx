import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { platformsOf, useApplications, useCampaigns, useFoodies, useMerchants } from "./-data";

export const Route = createFileRoute("/console/campaigns")({
  component: CampaignsAndApplications,
});

const A_LABEL: Record<string, string> = {
  pending: "審核中",
  approved: "已核准",
  rejected: "已拒絕",
};
const C_LABEL: Record<string, string> = { draft: "草稿", published: "已上架", closed: "已下架" };

function CampaignsAndApplications() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const campaigns = useCampaigns(isAdmin);
  const applications = useApplications(isAdmin);
  const foodies = useFoodies(isAdmin);
  const merchants = useMerchants(isAdmin);
  const [q, setQ] = useState("");
  const [onlyPendingApps, setOnlyPendingApps] = useState(false);

  const setCampaignStatus = async (id: string, status: "published" | "closed") => {
    const { error } = await supabase.from("campaigns").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(status === "published" ? "案件已上架" : "案件已下架");
    void qc.invalidateQueries({ queryKey: ["console-campaigns"] });
  };

  const toggleCompleted = async (id: string, completed: boolean) => {
    const { error } = await supabase
      .from("applications")
      .update({ completed, completed_at: completed ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(completed ? "已標記合作完成" : "已取消完成標記");
    void qc.invalidateQueries({ queryKey: ["console-applications"] });
  };

  // 媒合審核已收回平台管理員，商家後台不再提供核准／拒絕。
  const decide = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("applications").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(status === "approved" ? "已核准媒合" : "已拒絕媒合");
    void qc.invalidateQueries({ queryKey: ["console-applications"] });
  };

  const kw = q.trim().toLowerCase();
  const cList = (campaigns.data ?? []).filter(
    (c) =>
      !kw ||
      c.title.toLowerCase().includes(kw) ||
      (c.restaurant_name ?? "").toLowerCase().includes(kw) ||
      c.region.toLowerCase().includes(kw),
  );

  const fList = foodies.data ?? [];
  const mList = merchants.data ?? [];
  const aList = (applications.data ?? [])
    .filter((a) => {
      if (!kw) return true;
      const nickname = fList.find((f) => f.user_id === a.creator_id)?.nickname ?? "";
      return (
        (a.campaigns?.title ?? "").toLowerCase().includes(kw) || nickname.toLowerCase().includes(kw)
      );
    })
    .filter((a) => !onlyPendingApps || a.status === "pending");

  const appPending = (applications.data ?? []).filter((a) => a.status === "pending").length;

  const merchantName = (merchantId: string | undefined) =>
    mList.find((m) => m.user_id === merchantId)?.store_name ?? "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#3F2E1E]">案件與媒合管理</h1>
          <p className="mt-1 text-sm text-[#A08E7C]">
            核准或拒絕 Foodie 申請，並檢視跨商家的所有案件
          </p>
        </div>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜尋案件、餐廳或 Foodie"
          className="w-full border-[#EFE3D6] bg-white sm:w-64"
        />
      </div>

      <Tabs defaultValue="applications">
        <TabsList>
          <TabsTrigger value="applications">
            媒合審核{appPending > 0 && ` (${appPending})`}
          </TabsTrigger>
          <TabsTrigger value="campaigns">案件 ({cList.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns">
          <Card className="border-[#EFE3D6] bg-white">
            <CardHeader>
              <CardTitle className="text-base">所有案件</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>標題</TableHead>
                    <TableHead>商家</TableHead>
                    <TableHead>地區</TableHead>
                    <TableHead>合作類型</TableHead>
                    <TableHead>名額</TableHead>
                    <TableHead>申請數</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cList.map((c) => {
                    const count = (applications.data ?? []).filter(
                      (a) => a.campaign_id === c.id,
                    ).length;
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.title}</TableCell>
                        <TableCell>{c.restaurant_name ?? merchantName(c.merchant_id)}</TableCell>
                        <TableCell>{c.region}</TableCell>
                        <TableCell className="text-sm text-[#A08E7C]">{c.collab_type}</TableCell>
                        <TableCell className="tabular-nums">{c.slots}</TableCell>
                        <TableCell className="tabular-nums">{count}</TableCell>
                        <TableCell>
                          <Badge variant={c.status === "published" ? "default" : "secondary"}>
                            {C_LABEL[c.status] ?? c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {c.status === "published" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setCampaignStatus(c.id, "closed")}
                            >
                              下架
                            </Button>
                          ) : (
                            <Button size="sm" onClick={() => setCampaignStatus(c.id, "published")}>
                              上架
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {cList.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-[#A08E7C]">
                        沒有符合的案件
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="applications">
          <Card className="border-[#EFE3D6] bg-white">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">媒合審核</CardTitle>
                <p className="mt-1 text-xs text-[#A08E7C]">
                  核准與拒絕僅限平台管理員，商家端只能檢視
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setOnlyPendingApps((v) => !v)}>
                {onlyPendingApps ? "顯示全部" : "只看待審核"}
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>案件</TableHead>
                    <TableHead>商家</TableHead>
                    <TableHead>Foodie</TableHead>
                    <TableHead className="text-right">粉絲數</TableHead>
                    <TableHead>審核狀態</TableHead>
                    <TableHead>合作完成</TableHead>
                    <TableHead>申請時間</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aList.map((a) => {
                    const foodie = fList.find((f) => f.user_id === a.creator_id);
                    const reach = foodie
                      ? platformsOf(foodie).reduce((n, p) => n + p.followers, 0)
                      : 0;
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.campaigns?.title ?? "—"}</TableCell>
                        <TableCell>
                          {a.campaigns?.restaurant_name ?? merchantName(a.campaigns?.merchant_id)}
                        </TableCell>
                        <TableCell>{foodie?.nickname ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {foodie ? reach.toLocaleString() : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              a.status === "approved"
                                ? "default"
                                : a.status === "rejected"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {A_LABEL[a.status] ?? a.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {a.completed ? (
                            <Badge>已完成</Badge>
                          ) : (
                            <Badge variant="secondary">未完成</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-[#A08E7C]">
                          {new Date(a.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="space-x-2 whitespace-nowrap text-right">
                          {a.status === "pending" ? (
                            <>
                              <Button
                                size="sm"
                                className="bg-[#FF8300] text-white hover:bg-[#E67600]"
                                onClick={() => decide(a.id, "approved")}
                              >
                                核准
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => decide(a.id, "rejected")}
                              >
                                拒絕
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  decide(a.id, a.status === "approved" ? "rejected" : "approved")
                                }
                              >
                                改為{a.status === "approved" ? "拒絕" : "核准"}
                              </Button>
                              {a.status === "approved" && (
                                <Button
                                  size="sm"
                                  variant={a.completed ? "outline" : "default"}
                                  onClick={() => toggleCompleted(a.id, !a.completed)}
                                >
                                  {a.completed ? "取消完成" : "標記完成"}
                                </Button>
                              )}
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {aList.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-[#A08E7C]">
                        {onlyPendingApps ? "沒有待審核的申請" : "沒有符合的申請"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
