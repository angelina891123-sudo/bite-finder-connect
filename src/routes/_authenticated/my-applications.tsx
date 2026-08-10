import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/my-applications")({
  head: () => ({
    meta: [
      { title: "我的申請｜肚肚 Foodie 媒合專區" },
      { name: "description", content: "查看你申請的美食業配案件與商家審核進度。" },
      { property: "og:title", content: "我的申請｜肚肚 Foodie 媒合專區" },
      { property: "og:description", content: "查看你申請的美食業配案件與審核狀態。" },
    ],
  }),
  component: MyApplications,
});

type Row = {
  id: string;
  status: "pending" | "approved" | "rejected";
  message: string | null;
  created_at: string;
  campaigns: { title: string; region: string; reward: string; collab_type: string } | null;
};

function MyApplications() {
  const { user } = useAuth();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["my-applications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("id,status,message,created_at,campaigns(title,region,reward,collab_type)")
        .eq("creator_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  return (
    <div className="min-h-screen bg-muted/40">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="mb-6 text-2xl font-bold">我的申請</h1>
        {isLoading ? (
          <p className="text-muted-foreground">載入中…</p>
        ) : rows.length === 0 ? (
          <p className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
            還沒有申請紀錄，回首頁探索案件吧！
          </p>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <Card key={r.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{r.campaigns?.title ?? "案件"}</CardTitle>
                    <Badge
                      variant={
                        r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"
                      }
                    >
                      {r.status === "approved" ? "已核准" : r.status === "rejected" ? "已拒絕" : "待審核"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {r.campaigns?.region}・{r.campaigns?.collab_type}・{r.campaigns?.reward}
                  </p>
                </CardHeader>
                {r.message && (
                  <CardContent className="text-sm text-muted-foreground">{r.message}</CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}