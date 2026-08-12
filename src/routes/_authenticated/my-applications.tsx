import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/my-applications")({
  head: () => ({
    meta: [
      { title: "我的案件管理後台｜肚肚 Foodie 媒合專區" },
      { name: "description", content: "管理你申請的美食業配案件：查看審核狀態、截止日，並上傳貼文或 Reels 成果連結。" },
      { property: "og:title", content: "我的案件管理後台｜肚肚 Foodie 媒合專區" },
      { property: "og:description", content: "查看審核狀態與截止日，並上傳合作成果連結。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyApplications,
});

type Row = {
  id: string;
  status: "pending" | "approved" | "rejected";
  completed: boolean;
  message: string | null;
  created_at: string;
  submission_url: string | null;
  campaigns: {
    title: string;
    region: string;
    reward: string;
    collab_type: string;
    deadline: string | null;
  } | null;
};

function statusOf(r: Row) {
  if (r.completed) return { label: "已完成", variant: "default" as const };
  if (r.status === "approved") return { label: "已核准", variant: "default" as const };
  if (r.status === "rejected") return { label: "未通過", variant: "destructive" as const };
  return { label: "審核中", variant: "secondary" as const };
}

function MyApplications() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [uploadTarget, setUploadTarget] = useState<Row | null>(null);
  const [url, setUrl] = useState("");
  const [cancelTarget, setCancelTarget] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["my-applications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select(
          "id,status,completed,message,created_at,submission_url,campaigns(title,region,reward,collab_type,deadline)",
        )
        .eq("creator_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["my-applications", user?.id] });

  const saveUrl = async () => {
    if (!uploadTarget) return;
    const value = url.trim();
    if (value && !/^https?:\/\//i.test(value)) {
      toast.error("請輸入有效的連結（需以 http(s):// 開頭）");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("applications")
      .update({ submission_url: value || null, submitted_at: value ? new Date().toISOString() : null })
      .eq("id", uploadTarget.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("成果連結已更新");
    setUploadTarget(null);
    void refresh();
  };

  const cancelApplication = async () => {
    if (!cancelTarget) return;
    setBusy(true);
    const { error } = await supabase.from("applications").delete().eq("id", cancelTarget.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("已取消申請");
    setCancelTarget(null);
    void refresh();
  };

  const counts = {
    total: rows.length,
    pending: rows.filter((r) => !r.completed && r.status === "pending").length,
    approved: rows.filter((r) => !r.completed && r.status === "approved").length,
    completed: rows.filter((r) => r.completed).length,
  };

  return (
    <div className="min-h-screen bg-muted/40">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="mb-1 text-2xl font-bold">我的案件管理後台</h1>
        <p className="mb-6 text-sm text-muted-foreground">查看審核狀態、案件截止日，並上傳貼文／Reels 成果連結。</p>

        <div className="mb-6 grid gap-3 sm:grid-cols-4">
          {[
            { label: "全部申請", value: counts.total },
            { label: "審核中", value: counts.pending },
            { label: "已核准", value: counts.approved },
            { label: "已完成", value: counts.completed },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">載入中…</p>
        ) : rows.length === 0 ? (
          <p className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
            還沒有申請紀錄，回首頁探索案件吧！
          </p>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => {
              const s = statusOf(r);
              return (
                <Card key={r.id}>
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="text-base">{r.campaigns?.title ?? "案件"}</CardTitle>
                      <Badge variant={s.variant}>{s.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {r.campaigns?.region}・{r.campaigns?.collab_type}・{r.campaigns?.reward}
                      {r.campaigns?.deadline ? `・截止日 ${r.campaigns.deadline}` : "・無截止日"}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {r.message && <p className="text-muted-foreground">{r.message}</p>}
                    <p className="text-muted-foreground">
                      成果連結：
                      {r.submission_url ? (
                        <a
                          href={r.submission_url}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-1 text-primary underline"
                        >
                          {r.submission_url}
                        </a>
                      ) : (
                        <span className="ml-1">尚未上傳</span>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={r.status !== "approved"}
                        onClick={() => {
                          setUrl(r.submission_url ?? "");
                          setUploadTarget(r);
                        }}
                      >
                        {r.submission_url ? "更新成果連結" : "上傳貼文／Reels 連結"}
                      </Button>
                      {!r.completed && (
                        <Button size="sm" variant="ghost" onClick={() => setCancelTarget(r)}>
                          取消申請
                        </Button>
                      )}
                    </div>
                    {r.status === "pending" && (
                      <p className="text-xs text-muted-foreground">案件核准後即可上傳成果連結。</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <Dialog open={uploadTarget !== null} onOpenChange={(o) => !o && setUploadTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>上傳成果連結</DialogTitle>
            <DialogDescription>貼上你為「{uploadTarget?.campaigns?.title}」發佈的貼文或 Reels 連結。</DialogDescription>
          </DialogHeader>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://instagram.com/p/..." />
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadTarget(null)}>
              取消
            </Button>
            <Button onClick={saveUrl} disabled={busy}>
              儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelTarget !== null} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>取消申請</DialogTitle>
            <DialogDescription>
              確定要取消「{cancelTarget?.campaigns?.title}」的申請嗎？取消後紀錄將被刪除，如需再次合作請重新申請。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>
              保留申請
            </Button>
            <Button variant="destructive" onClick={cancelApplication} disabled={busy}>
              確定取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
