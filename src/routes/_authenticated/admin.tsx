import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "平台管理後台｜肚肚 Foodie 媒合專區" },
      { name: "description", content: "平台管理員審核商家與 Foodie 註冊資料，總覽案件與申請，並標記合作完成。" },
      { property: "og:title", content: "平台管理後台｜肚肚 Foodie 媒合專區" },
      { property: "og:description", content: "審核商家與 Foodie、總覽案件與申請、標記合作完成。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

type VStatus = "pending" | "approved" | "rejected";

const V_LABEL: Record<VStatus, string> = { pending: "待審核", approved: "已通過", rejected: "已拒絕" };
const A_LABEL: Record<string, string> = { pending: "審核中", approved: "已核准", rejected: "已拒絕" };

function StatusBadge({ status }: { status: VStatus }) {
  return (
    <Badge variant={status === "approved" ? "default" : status === "rejected" ? "destructive" : "secondary"}>
      {V_LABEL[status]}
    </Badge>
  );
}

function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const qc = useQueryClient();

  const merchants = useQuery({
    queryKey: ["admin-merchants"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const foodies = useQuery({
    queryKey: ["admin-foodies"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("foodie_profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const campaigns = useQuery({
    queryKey: ["admin-campaigns"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const applications = useQuery({
    queryKey: ["admin-applications"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("id,status,completed,completed_at,created_at,creator_id,campaigns(title,restaurant_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const review = async (table: "merchant_profiles" | "foodie_profiles", id: string, status: VStatus) => {
    const { error } = await supabase
      .from(table)
      .update({ verification_status: status, reviewed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(status === "approved" ? "已審核通過" : "已拒絕");
    void qc.invalidateQueries({ queryKey: [table === "merchant_profiles" ? "admin-merchants" : "admin-foodies"] });
  };

  const decideApplication = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("applications").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(status === "approved" ? "已核准申請" : "已拒絕申請");
    void qc.invalidateQueries({ queryKey: ["admin-applications"] });
  };

  const toggleCompleted = async (id: string, completed: boolean) => {
    const { error } = await supabase
      .from("applications")
      .update({ completed, completed_at: completed ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(completed ? "已標記合作完成" : "已取消完成標記");
    void qc.invalidateQueries({ queryKey: ["admin-applications"] });
  };

  const setCampaignStatus = async (id: string, status: "published" | "closed") => {
    const { error } = await supabase.from("campaigns").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("案件狀態已更新");
    void qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
  };

  if (loading) return <div className="p-10 text-muted-foreground">載入中…</div>;
  if (!isAdmin)
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <h1 className="text-xl font-bold">沒有管理員權限</h1>
        <p className="mt-2 text-sm text-muted-foreground">此頁面僅開放平台管理員使用。</p>
      </div>
    );

  const mList = merchants.data ?? [];
  const fList = foodies.data ?? [];
  const aList = applications.data ?? [];
  const pending = mList.filter((m) => m.verification_status === "pending").length + fList.filter((f) => f.verification_status === "pending").length;

  return (
    <div className="min-h-screen bg-muted/40">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="mb-6 text-2xl font-bold">平台管理後台</h1>
        <div className="mb-6 grid gap-4 sm:grid-cols-5">
          {[
            ["商家數", mList.length],
            ["Foodie 數", fList.length],
            ["待審核", pending],
            ["案件數", campaigns.data?.length ?? 0],
            ["已完成合作", aList.filter((a) => a.completed).length],
          ].map(([k, v]) => (
            <Card key={String(k)}>
              <CardHeader className="pb-2">
                <p className="text-xs text-muted-foreground">{k}</p>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{v}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="merchants">
          <TabsList>
            <TabsTrigger value="merchants">商家審核</TabsTrigger>
            <TabsTrigger value="foodies">Foodie 審核</TabsTrigger>
            <TabsTrigger value="campaigns">案件總覽</TabsTrigger>
            <TabsTrigger value="applications">申請總覽</TabsTrigger>
          </TabsList>

          <TabsContent value="merchants">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">商家註冊資料</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>店名</TableHead>
                      <TableHead>聯絡人</TableHead>
                      <TableHead>聯絡方式</TableHead>
                      <TableHead>地區</TableHead>
                      <TableHead>狀態</TableHead>
                      <TableHead className="text-right">審核</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mList.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.store_name}</TableCell>
                        <TableCell>{m.contact_name ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {[m.phone, m.email].filter(Boolean).join(" / ") || "—"}
                        </TableCell>
                        <TableCell>{m.region ?? "—"}</TableCell>
                        <TableCell><StatusBadge status={m.verification_status} /></TableCell>
                        <TableCell className="space-x-2 text-right">
                          <Button size="sm" disabled={m.verification_status === "approved"} onClick={() => review("merchant_profiles", m.id, "approved")}>
                            通過
                          </Button>
                          <Button size="sm" variant="outline" disabled={m.verification_status === "rejected"} onClick={() => review("merchant_profiles", m.id, "rejected")}>
                            拒絕
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {mList.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">尚無商家資料</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="foodies">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Foodie 註冊資料</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>暱稱</TableHead>
                      <TableHead>地區</TableHead>
                      <TableHead>IG</TableHead>
                      <TableHead>粉絲數</TableHead>
                      <TableHead>擅長類別</TableHead>
                      <TableHead>狀態</TableHead>
                      <TableHead className="text-right">審核</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fList.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">{f.nickname}</TableCell>
                        <TableCell>{[f.region, f.area].filter(Boolean).join(" · ") || "—"}</TableCell>
                        <TableCell>{f.ig_handle ?? "—"}</TableCell>
                        <TableCell>{f.ig_followers.toLocaleString()}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{f.categories.join("、") || "—"}</TableCell>
                        <TableCell><StatusBadge status={f.verification_status} /></TableCell>
                        <TableCell className="space-x-2 text-right">
                          <Button size="sm" disabled={f.verification_status === "approved"} onClick={() => review("foodie_profiles", f.id, "approved")}>
                            通過
                          </Button>
                          <Button size="sm" variant="outline" disabled={f.verification_status === "rejected"} onClick={() => review("foodie_profiles", f.id, "rejected")}>
                            拒絕
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {fList.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">尚無 Foodie 資料</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="campaigns">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">所有案件</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>標題</TableHead>
                      <TableHead>餐廳</TableHead>
                      <TableHead>地區</TableHead>
                      <TableHead>名額</TableHead>
                      <TableHead>狀態</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(campaigns.data ?? []).map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.title}</TableCell>
                        <TableCell>{c.restaurant_name ?? "—"}</TableCell>
                        <TableCell>{c.region}</TableCell>
                        <TableCell>{c.slots}</TableCell>
                        <TableCell>
                          <Badge variant={c.status === "published" ? "default" : "secondary"}>{c.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {c.status === "published" ? (
                            <Button size="sm" variant="outline" onClick={() => setCampaignStatus(c.id, "closed")}>下架</Button>
                          ) : (
                            <Button size="sm" onClick={() => setCampaignStatus(c.id, "published")}>上架</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="applications">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">所有申請</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>案件</TableHead>
                      <TableHead>Foodie</TableHead>
                      <TableHead>審核狀態</TableHead>
                      <TableHead>合作完成</TableHead>
                      <TableHead>申請時間</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aList.map((a) => {
                      const c = (a as unknown as { campaigns: { title: string; restaurant_name: string | null } | null }).campaigns;
                      const foodie = fList.find((f) => f.user_id === a.creator_id);
                      return (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">{c?.title ?? "—"}</TableCell>
                          <TableCell>{foodie?.nickname ?? "—"}</TableCell>
                          <TableCell>{A_LABEL[a.status] ?? a.status}</TableCell>
                          <TableCell>
                            {a.completed ? <Badge>已完成</Badge> : <Badge variant="secondary">未完成</Badge>}
                          </TableCell>
                          <TableCell>{new Date(a.created_at).toLocaleString()}</TableCell>
                          <TableCell className="space-x-2 text-right">
                            {a.status === "pending" && (
                              <>
                                <Button size="sm" onClick={() => decideApplication(a.id, "approved")}>
                                  核准
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => decideApplication(a.id, "rejected")}>
                                  拒絕
                                </Button>
                              </>
                            )}
                            {a.status === "approved" && (
                              <Button size="sm" variant={a.completed ? "outline" : "default"} onClick={() => toggleCompleted(a.id, !a.completed)}>
                                {a.completed ? "取消完成" : "標記完成"}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {aList.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">尚無申請紀錄</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
