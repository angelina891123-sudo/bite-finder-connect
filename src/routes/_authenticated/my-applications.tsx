import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  canEditDelivery,
  deliveryStageLabel,
  isExpired,
  SUBMISSION_LABEL,
  todayISO,
  type SubmissionStatus,
} from "@/lib/campaign";
import { SiteHeader } from "@/components/SiteHeader";
import { FoodieProfileForm } from "@/components/FoodieProfileForm";
import { CampaignDetailDialog, type CampaignDetail } from "@/components/CampaignDetailDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  // 到店核銷欄位，於 20260813180000_visit_verification_code.sql 新增；
  // migration 套用前為 undefined，UI 會自動隱藏該區塊。
  visit_code?: string | null;
  visited?: boolean | null;
  // 成效截圖，於 20260814140000 migration 新增。
  result_images?: string[] | null;
  // 素材審核，於 20260817140000_material_review.sql 新增；文案／素材／商家確稿
  // 三段各自獨立審核，見 caption_status / media_status / merchant_review_status。
  material_caption?: string | null;
  material_media?: string[] | null;
  caption_status?: SubmissionStatus | null;
  media_status?: SubmissionStatus | null;
  caption_review_note?: string | null;
  media_review_note?: string | null;
  merchant_review_status?: SubmissionStatus | null;
  merchant_review_note?: string | null;
  published_at?: string | null;
  campaigns: CampaignDetail | null;
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
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [shotTarget, setShotTarget] = useState<Row | null>(null);
  const [matTarget, setMatTarget] = useState<Row | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const today = todayISO();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["my-applications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select(
          "*,campaigns(id,title,description,video_direction,video_must_include,video_must_avoid,copy_must_include,copy_must_avoid,hashtags,reference_link,notes,restaurant_name,region,address,reward,collab_types,food_types,primary_food_type,min_followers,slots,deadline,photos)",
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
    const now = new Date().toISOString();
    // 交付成果連結即視為完成合作、也視為發文；清空連結則退回進行中。
    const { error } = await supabase
      .from("applications")
      .update({
        submission_url: value || null,
        submitted_at: value ? now : null,
        completed: !!value,
        completed_at: value ? now : null,
        published_at: value ? now : null,
      })
      .eq("id", uploadTarget.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(value ? "成果連結已上傳，案件標記為已完成" : "成果連結已清除");
    setUploadTarget(null);
    void refresh();
  };

  // 成效截圖：私有 bucket，路徑第一層為使用者 id，讀取用長效簽名網址。
  const uploadShots = async (row: Row, files: FileList | null) => {
    if (!files || files.length === 0 || !user) return;
    setUploading(true);
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("performance-shots").upload(path, file);
      if (error) {
        toast.error(`截圖上傳失敗：${error.message}`);
        continue;
      }
      const { data } = await supabase.storage
        .from("performance-shots")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      if (data?.signedUrl) urls.push(data.signedUrl);
    }
    if (urls.length > 0) {
      const next = [...(row.result_images ?? []), ...urls];
      const { error } = await supabase
        .from("applications")
        .update({ result_images: next })
        .eq("id", row.id);
      if (error) toast.error(error.message);
      else {
        toast.success(`已上傳 ${urls.length} 張成效截圖`);
        setShotTarget((t) => (t ? { ...t, result_images: next } : t));
        void refresh();
      }
    }
    setUploading(false);
  };

  const uploadMaterials = async (row: Row, files: FileList | null) => {
    if (!files || files.length === 0 || !user) return;
    setUploading(true);
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("campaign-materials").upload(path, file);
      if (error) {
        toast.error(`${file.name} 上傳失敗：${error.message}`);
        continue;
      }
      const { data } = await supabase.storage
        .from("campaign-materials")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      if (data?.signedUrl) urls.push(data.signedUrl);
    }
    if (urls.length > 0) {
      const next = [...(row.material_media ?? []), ...urls];
      const { error } = await supabase
        .from("applications")
        .update({ material_media: next })
        .eq("id", row.id);
      if (error) toast.error(error.message);
      else {
        setMatTarget((t) => (t ? { ...t, material_media: next } : t));
        void refresh();
      }
    }
    setUploading(false);
  };

  const submitMaterials = async () => {
    if (!matTarget) return;
    if (!caption.trim()) {
      toast.error("請填寫文案");
      return;
    }
    if ((matTarget.material_media ?? []).length === 0) {
      toast.error("請至少上傳一個圖片或影片素材");
      return;
    }
    setBusy(true);
    // 文案/素材有變動時，DB trigger 會自動把 caption_status/media_status 轉回
    // submitted，不需要在這裡手動指定審核狀態。
    const { error } = await supabase
      .from("applications")
      .update({ material_caption: caption.trim() })
      .eq("id", matTarget.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("素材已送出審核，將由平台先行審核");
    setMatTarget(null);
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
        <p className="mb-6 text-sm text-muted-foreground">
          查看審核狀態、案件截止日，上傳貼文／Reels 成果連結，並維護你的個人資料。
        </p>

        <Tabs defaultValue="applications">
          <TabsList className="mb-6">
            <TabsTrigger value="applications">我的申請</TabsTrigger>
            <TabsTrigger value="profile">個人資料管理</TabsTrigger>
          </TabsList>

          <TabsContent value="applications">
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
              const deliveryStatus = deliveryStageLabel(r);
              const deliveryApproved =
                (r.merchant_review_status ?? "draft") === "approved";
              const deliveryEditable = canEditDelivery(r);
              return (
                <Card key={r.id}>
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="text-base">{r.campaigns?.title ?? "案件"}</CardTitle>
                      <Badge variant={s.variant}>{s.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {r.campaigns?.region}・{r.campaigns?.collab_types?.join("、")}・{r.campaigns?.reward}
                      {r.campaigns?.deadline ? `・預計上線 ${r.campaigns.deadline}` : "・未提供上線日期"}
                      {isExpired(r.campaigns?.deadline, today) && "（已截止）"}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {r.message && <p className="text-muted-foreground">{r.message}</p>}
                    {r.status === "approved" && r.visit_code && (
                      <div className="rounded-lg border border-primary/30 bg-accent/60 p-3">
                        {r.visited ? (
                          <p className="font-medium text-primary">✓ 已完成到店，店家已核銷此代碼</p>
                        ) : (
                          <>
                            <p className="text-xs text-muted-foreground">到店代碼</p>
                            <p className="font-mono text-2xl font-bold tracking-[0.3em] text-primary">
                              {r.visit_code}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              到店時請出示這組代碼給店家人員輸入，完成到店確認。
                            </p>
                          </>
                        )}
                      </div>
                    )}
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
                    {r.status === "approved" && (
                      <div className="rounded-lg border border-border bg-background p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold">
                            素材審核
                            <span className="ml-1 font-normal text-muted-foreground">
                              文案與圖片／影片，需通過平台與商家審核才能發文
                            </span>
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge variant={deliveryStatus.variant}>{deliveryStatus.label}</Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setCaption(r.material_caption ?? "");
                                setMatTarget(r);
                              }}
                            >
                              {deliveryEditable ? "上傳／送審素材" : "查看素材"}
                            </Button>
                          </div>
                        </div>
                        {((r.caption_status ?? "draft") === "revising" ||
                          (r.media_status ?? "draft") === "revising" ||
                          (r.merchant_review_status ?? "draft") === "revising") && (
                          <div className="mt-2 space-y-1 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                            {(r.caption_status ?? "draft") === "revising" && r.caption_review_note && (
                              <p>文案退件原因：{r.caption_review_note}</p>
                            )}
                            {(r.media_status ?? "draft") === "revising" && r.media_review_note && (
                              <p>素材退件原因：{r.media_review_note}</p>
                            )}
                            {(r.merchant_review_status ?? "draft") === "revising" &&
                              r.merchant_review_note && <p>商家退件原因：{r.merchant_review_note}</p>}
                          </div>
                        )}
                      </div>
                    )}
                    {/* 成效截圖與成果連結同樣鎖在商家確稿之後。 */}
                    {r.completed && deliveryApproved && (
                      <div className="rounded-lg border border-border bg-background p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold">
                            成效截圖
                            <span className="ml-1 font-normal text-muted-foreground">
                              上傳貼文洞察報告（觸及、互動等）截圖給商家
                            </span>
                          </p>
                          <Button size="sm" variant="outline" onClick={() => setShotTarget(r)}>
                            {r.result_images?.length ? "管理截圖" : "上傳成效截圖"}
                          </Button>
                        </div>
                        {r.result_images?.length ? (
                          <div className="mt-2 flex gap-2 overflow-x-auto">
                            {r.result_images.map((src) => (
                              <a key={src} href={src} target="_blank" rel="noreferrer">
                                <img
                                  src={src}
                                  alt="成效截圖"
                                  loading="lazy"
                                  className="h-20 w-20 shrink-0 rounded-md border border-border object-cover"
                                />
                              </a>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-1 text-xs text-muted-foreground">尚未上傳</p>
                        )}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!r.campaigns}
                        onClick={() => setDetail(r.campaigns)}
                      >
                        查看案件詳情
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={r.status !== "approved" || !deliveryApproved}
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
                    {r.status === "approved" && !deliveryApproved && (
                      <p className="text-xs text-muted-foreground">
                        素材通過平台與商家審核後，才能上傳成果連結與成效截圖。
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
          </TabsContent>

          <TabsContent value="profile">
            {user && <FoodieProfileForm userId={user.id} userEmail={user.email ?? null} />}
          </TabsContent>
        </Tabs>
      </main>

      <CampaignDetailDialog
        campaign={detail}
        onOpenChange={(o) => !o && setDetail(null)}
        expired={isExpired(detail?.deadline, today)}
      >
        <Button variant="outline" onClick={() => setDetail(null)}>
          關閉
        </Button>
      </CampaignDetailDialog>

      <Dialog open={matTarget !== null} onOpenChange={(o) => !o && setMatTarget(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>素材審核</DialogTitle>
            <DialogDescription>
              「{matTarget?.campaigns?.title}」的文案與圖片／影片素材。送出後會先由平台審核，
              通過後再交由商家審核。
            </DialogDescription>
          </DialogHeader>

          {(() => {
            const editable = matTarget ? canEditDelivery(matTarget) : false;
            const captionStatus = (matTarget?.caption_status ?? "draft") as SubmissionStatus;
            const mediaStatus = (matTarget?.media_status ?? "draft") as SubmissionStatus;
            return (
              <>
                {captionStatus === "revising" && matTarget?.caption_review_note && (
                  <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    文案退件原因：{matTarget.caption_review_note}
                  </p>
                )}
                {mediaStatus === "revising" && matTarget?.media_review_note && (
                  <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    素材退件原因：{matTarget.media_review_note}
                  </p>
                )}

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Label>文案</Label>
                    <Badge variant={SUBMISSION_LABEL[captionStatus].variant}>
                      {SUBMISSION_LABEL[captionStatus].label}
                    </Badge>
                  </div>
                  <Textarea
                    rows={5}
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="貼文預計搭配的文字內容…"
                    disabled={!editable}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Label>圖片／影片素材</Label>
                    <Badge variant={SUBMISSION_LABEL[mediaStatus].variant}>
                      {SUBMISSION_LABEL[mediaStatus].label}
                    </Badge>
                  </div>
                  {matTarget?.material_media?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {matTarget.material_media.map((src) => (
                        <a
                          key={src}
                          href={src}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md border border-border px-3 py-2 text-xs text-primary underline"
                        >
                          檢視素材
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">尚未上傳。</p>
                  )}
                  {editable && (
                    <label className="flex cursor-pointer items-center justify-center rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground hover:bg-accent">
                      {uploading ? "上傳中…" : "點此選擇圖片或影片"}
                      <input
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        className="hidden"
                        disabled={uploading}
                        onChange={(e) => {
                          if (matTarget) void uploadMaterials(matTarget, e.target.files);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setMatTarget(null)}>
                    關閉
                  </Button>
                  {editable && (
                    <Button onClick={submitMaterials} disabled={busy || uploading}>
                      送出審核
                    </Button>
                  )}
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={shotTarget !== null} onOpenChange={(o) => !o && setShotTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>上傳成效截圖</DialogTitle>
            <DialogDescription>
              上傳「{shotTarget?.campaigns?.title}」的貼文洞察報告截圖，商家可在後台查看。可一次選多張。
            </DialogDescription>
          </DialogHeader>

          {shotTarget?.result_images?.length ? (
            <div className="flex flex-wrap gap-2">
              {shotTarget.result_images.map((src) => (
                <a key={src} href={src} target="_blank" rel="noreferrer">
                  <img
                    src={src}
                    alt="成效截圖"
                    loading="lazy"
                    className="h-24 w-24 rounded-md border border-border object-cover"
                  />
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">尚未上傳任何截圖。</p>
          )}

          <label className="mt-2 flex cursor-pointer items-center justify-center rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground hover:bg-accent">
            {uploading ? "上傳中…" : "點此選擇圖片檔案"}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                if (shotTarget) void uploadShots(shotTarget, e.target.files);
                e.target.value = "";
              }}
            />
          </label>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShotTarget(null)}>
              完成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
