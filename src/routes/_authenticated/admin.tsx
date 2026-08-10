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
      { name: "description", content: "平台管理員管理商家、Foodie、案件與申請。" },
      { property: "og:title", content: "平台管理後台｜肚肚 Foodie 媒合專區" },
      { property: "og:description", content: "管理商家、Foodie、案件與申請。" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const qc = useQueryClient();

  const users = useQuery({
    queryKey: ["admin-users"],
    enabled: isAdmin,
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("user_roles").select("user_id,role"),
      ]);
      const roleMap: Record<string, string[]> = {};
      for (const r of roles ?? []) (roleMap[r.user_id] ??= []).push(r.role);
      return (profiles ?? []).map((p) => ({ ...p, roles: roleMap[p.id] ?? [] }));
    },
  });

  const campaigns = useQuery({
    queryKey: ["admin-campaigns"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const applications = useQuery({
    queryKey: ["admin-applications"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("applications")
        .select("id,status,created_at,creator_id,campaigns(title)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const setCampaignStatus = async (id: string, status: "published" | "closed") => {
    const { error } = await supabase.from("campaigns").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
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

  const merchants = (users.data ?? []).filter((u) => u.roles.includes("merchant"));
  const foodies = (users.data ?? []).filter((u) => u.roles.includes("creator"));

  return (
    <div className="min-h-screen bg-muted/40">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="mb-6 text-2xl font-bold">平台管理後台</h1>
        <div className="mb-6 grid gap-4 sm:grid-cols-4">
          {[
            ["商家數", merchants.length],
            ["Foodie 數", foodies.length],
            ["案件數", campaigns.data?.length ?? 0],
            ["申請數", applications.data?.length ?? 0],
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
            <TabsTrigger value="merchants">商家管理</TabsTrigger>
            <TabsTrigger value="foodies">Foodie 管理</TabsTrigger>
            <TabsTrigger value="campaigns">案件管理</TabsTrigger>
            <TabsTrigger value="applications">申請紀錄</TabsTrigger>
          </TabsList>

          <TabsContent value="merchants">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">商家</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>餐廳</TableHead>
                      <TableHead>聯絡人</TableHead>
                      <TableHead>地區</TableHead>
                      <TableHead>加入時間</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {merchants.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>{m.restaurant_name ?? "—"}</TableCell>
                        <TableCell>{m.display_name ?? "—"}</TableCell>
                        <TableCell>{m.region ?? "—"}</TableCell>
                        <TableCell>{new Date(m.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="foodies">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Foodie</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>暱稱</TableHead>
                      <TableHead>Instagram</TableHead>
                      <TableHead>粉絲數</TableHead>
                      <TableHead>地區</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {foodies.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell>{f.display_name ?? "—"}</TableCell>
                        <TableCell>{f.instagram_handle ?? "—"}</TableCell>
                        <TableCell>{f.follower_count.toLocaleString()}</TableCell>
                        <TableCell>{f.region ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="campaigns">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">案件</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>標題</TableHead>
                      <TableHead>地區</TableHead>
                      <TableHead>狀態</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(campaigns.data ?? []).map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{c.title}</TableCell>
                        <TableCell>{c.region}</TableCell>
                        <TableCell>
                          <Badge variant={c.status === "published" ? "default" : "secondary"}>{c.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {c.status === "published" ? (
                            <Button size="sm" variant="outline" onClick={() => setCampaignStatus(c.id, "closed")}>
                              下架
                            </Button>
                          ) : (
                            <Button size="sm" onClick={() => setCampaignStatus(c.id, "published")}>
                              上架
                            </Button>
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
                <CardTitle className="text-base">申請</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>案件</TableHead>
                      <TableHead>狀態</TableHead>
                      <TableHead>時間</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(applications.data ?? []).map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          {(a as unknown as { campaigns: { title: string } | null }).campaigns?.title ?? "—"}
                        </TableCell>
                        <TableCell>{a.status}</TableCell>
                        <TableCell>{new Date(a.created_at).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
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