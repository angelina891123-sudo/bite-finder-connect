import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ImagePlus, Link2, Trash2, Video } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  diffLines,
  MISSING_TABLE,
  rawSupabase,
  SUB_LABEL,
  useApplications,
  useFoodies,
  useMerchants,
  useSubmissionPhotos,
  useSubmissions,
  type ApplicationRow,
  type SubStatus,
  type Submission,
  type SubmissionPhoto,
} from "./-data";

export const Route = createFileRoute("/console/submissions")({
  component: Submissions,
});

const BUCKET = "submission-photos";

function StageBadge({ status }: { status: SubStatus }) {
  const style: Record<SubStatus, string> = {
    approved: "bg-[#FF8300] text-white hover:bg-[#FF8300]",
    submitted: "bg-[#FFF4E8] text-[#B85C00] hover:bg-[#FFF4E8]",
    revising: "bg-red-50 text-red-700 hover:bg-red-50",
    draft: "bg-[#F5EBE0] text-[#7A6555] hover:bg-[#F5EBE0]",
  };
  return <Badge className={style[status]}>【{SUB_LABEL[status]}】</Badge>;
}

function Submissions() {
  const { isAdmin, user } = useAuth();
  const qc = useQueryClient();
  const applications = useApplications(isAdmin);
  const foodies = useFoodies(isAdmin);
  const merchants = useMerchants(isAdmin);
  const submissions = useSubmissions(isAdmin);
  const photos = useSubmissionPhotos(isAdmin);

  const [openId, setOpenId] = useState<string | null>(null);
  const [editingCopy, setEditingCopy] = useState(false);
  const [copyDraft, setCopyDraft] = useState("");
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoDraft, setVideoDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const tableMissing =
    (submissions.error as { code?: string } | null)?.code === MISSING_TABLE ||
    (photos.error as { code?: string } | null)?.code === MISSING_TABLE;

  const apps = applications.data ?? [];
  const subs = submissions.data ?? [];
  const pics = photos.data ?? [];

  // 只有已核准的媒合才需要交付文案與照片
  const reviewable = apps.filter((a) => a.status === "approved");
  const subOf = (appId: string) => subs.find((s) => s.application_id === appId) ?? null;
  const picsOf = (subId: string | undefined) =>
    subId ? pics.filter((p) => p.submission_id === subId) : [];

  const foodieName = (id: string) => foodies.data?.find((f) => f.user_id === id)?.nickname ?? "—";
  const merchantName = (id: string | undefined) =>
    merchants.data?.find((m) => m.user_id === id)?.store_name ?? "—";

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["console-submissions"] });
    void qc.invalidateQueries({ queryKey: ["console-submission-photos"] });
  };

  /** 開啟審核畫面；若這筆媒合還沒有交付紀錄就先建立一筆空的。 */
  const openReview = async (a: ApplicationRow) => {
    let sub = subOf(a.id);
    if (!sub) {
      setBusy(true);
      const { data, error } = await rawSupabase
        .from("submissions")
        .insert({ application_id: a.id })
        .select()
        .single();
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      sub = data as Submission;
      refresh();
    }
    setOpenId(a.id);
    setEditingCopy(false);
    setCopyDraft(sub.copy_text ?? "");
  };

  const patchSub = async (id: string, patch: Record<string, unknown>, msg: string) => {
    const { error } = await rawSupabase.from("submissions").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(msg);
    refresh();
  };

  const saveCopy = async (sub: Submission) => {
    await patchSub(
      sub.id,
      {
        copy_text_prev: sub.copy_text,
        copy_text: copyDraft,
        copy_status: "submitted",
        copy_submitted_at: new Date().toISOString(),
      },
      "文案已更新",
    );
    setEditingCopy(false);
  };

  const togglePhoto = async (p: SubmissionPhoto) => {
    const { error } = await rawSupabase
      .from("submission_photos")
      .update({ selected: !p.selected })
      .eq("id", p.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    refresh();
  };

  const removePhoto = async (p: SubmissionPhoto) => {
    const { error } = await rawSupabase.from("submission_photos").delete().eq("id", p.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("照片已移除");
    refresh();
  };

  const uploadPhotos = async (sub: Submission, files: FileList) => {
    if (!user) return;
    setBusy(true);
    const existing = picsOf(sub.id).length;
    let ok = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${user.id}/${sub.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file);
      if (upErr) {
        toast.error(`${file.name}：${upErr.message}`);
        continue;
      }
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const seq = existing + ok + 1;
      const { error: insErr } = await rawSupabase.from("submission_photos").insert({
        submission_id: sub.id,
        url: pub.publicUrl,
        code: `B${String(seq).padStart(3, "0")}`,
        sort_order: seq,
      });
      if (insErr) {
        toast.error(insErr.message);
        continue;
      }
      ok++;
    }
    setBusy(false);
    if (ok > 0) {
      toast.success(`已上傳 ${ok} 張照片`);
      refresh();
    }
  };

  if (tableMissing) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-[#3F2E1E]">Foodie 案件審核</h1>
          <p className="mt-1 text-sm text-[#A08E7C]">審核 Foodie 交付的文案與照片</p>
        </div>
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-base text-amber-900">尚未建立交付資料表</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-amber-800">
            <p>
              此功能需要新的 <code className="rounded bg-amber-100 px-1">submissions</code> 與{" "}
              <code className="rounded bg-amber-100 px-1">submission_photos</code>{" "}
              資料表，以及照片儲存空間。migration 檔案已經寫好，但還沒套用到 Supabase。
            </p>
            <p className="font-mono text-xs">supabase/migrations/20260814160000_submissions.sql</p>
            <p>套用之後重新整理此頁即可使用，其他頁面不受影響。</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---------- 清單 ----------
  if (!openId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-[#3F2E1E]">Foodie 案件審核</h1>
          <p className="mt-1 text-sm text-[#A08E7C]">
            審核已核准媒合的交付內容，共 {reviewable.length} 筆
          </p>
        </div>

        <Card className="border-[#EFE3D6] bg-white">
          <CardHeader>
            <CardTitle className="text-base text-[#3F2E1E]">待交付與待確稿清單</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>案件</TableHead>
                  <TableHead>商家</TableHead>
                  <TableHead>Foodie</TableHead>
                  <TableHead>文案</TableHead>
                  <TableHead>照片</TableHead>
                  <TableHead className="text-right">張數</TableHead>
                  <TableHead>最後更新</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviewable.map((a) => {
                  const sub = subOf(a.id);
                  const n = picsOf(sub?.id).length;
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium text-[#3F2E1E]">
                        {a.campaigns?.title ?? "—"}
                      </TableCell>
                      <TableCell>
                        {a.campaigns?.restaurant_name ?? merchantName(a.campaigns?.merchant_id)}
                      </TableCell>
                      <TableCell>{foodieName(a.creator_id)}</TableCell>
                      <TableCell>
                        <StageBadge status={sub?.copy_status ?? "draft"} />
                      </TableCell>
                      <TableCell>
                        <StageBadge status={sub?.photo_status ?? "draft"} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{n}</TableCell>
                      <TableCell className="text-sm text-[#A08E7C]">
                        {sub ? new Date(sub.updated_at).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          className="bg-[#FF8300] text-white hover:bg-[#E67600]"
                          disabled={busy}
                          onClick={() => void openReview(a)}
                        >
                          審核
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {reviewable.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-[#A08E7C]">
                      目前沒有已核准的媒合。請先到「案件與申請」核准 Foodie 的申請。
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---------- 審核詳細 ----------
  const app = reviewable.find((a) => a.id === openId);
  const sub = app ? subOf(app.id) : null;
  if (!app || !sub) {
    return (
      <div className="space-y-4">
        <Button
          variant="outline"
          className="border-[#EFE3D6] bg-white"
          onClick={() => setOpenId(null)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回清單
        </Button>
        <p className="text-sm text-[#A08E7C]">找不到這筆交付紀錄。</p>
      </div>
    );
  }

  const myPics = picsOf(sub.id);
  const selectedCount = myPics.filter((p) => p.selected).length;
  const diff = diffLines(sub.copy_text_prev ?? "", sub.copy_text ?? "");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mb-1 text-[#7A6555]"
            onClick={() => setOpenId(null)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回清單
          </Button>
          <h1 className="truncate text-xl font-bold text-[#3F2E1E]">
            {app.campaigns?.title ?? "案件"}
          </h1>
          <p className="mt-1 text-sm text-[#A08E7C]">
            {app.campaigns?.restaurant_name ?? merchantName(app.campaigns?.merchant_id)} ·{" "}
            {foodieName(app.creator_id)}
          </p>
        </div>
      </div>

      {/* 文案 */}
      <Card className="border-[#EFE3D6] bg-white">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-[#EFE3D6] bg-[#FDF7F0]">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base text-[#3F2E1E]">文案</CardTitle>
            <StageBadge status={sub.copy_status} />
          </div>
          <div className="flex flex-wrap gap-2">
            {editingCopy ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-[#EFE3D6] bg-white"
                  onClick={() => {
                    setEditingCopy(false);
                    setCopyDraft(sub.copy_text ?? "");
                  }}
                >
                  取消
                </Button>
                <Button
                  size="sm"
                  className="bg-[#FF8300] text-white hover:bg-[#E67600]"
                  onClick={() => void saveCopy(sub)}
                >
                  儲存文案
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-[#EFE3D6] bg-white"
                  onClick={() => setEditingCopy(true)}
                >
                  編輯文案
                </Button>
                {sub.copy_status === "approved" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-[#EFE3D6] bg-white"
                    onClick={() =>
                      void patchSub(
                        sub.id,
                        { copy_status: "revising", copy_reviewed_at: null },
                        "已退回修改",
                      )
                    }
                  >
                    取消確稿
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-[#EFE3D6] bg-white"
                      onClick={() =>
                        void patchSub(sub.id, { copy_status: "revising" }, "已退回修改")
                      }
                    >
                      退回修改
                    </Button>
                    <Button
                      size="sm"
                      className="bg-[#FF8300] text-white hover:bg-[#E67600]"
                      disabled={!sub.copy_text}
                      onClick={() =>
                        void patchSub(
                          sub.id,
                          {
                            copy_status: "approved",
                            copy_reviewed_at: new Date().toISOString(),
                          },
                          "文案已確稿",
                        )
                      }
                    >
                      文案確稿
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {editingCopy ? (
            <Textarea
              value={copyDraft}
              onChange={(e) => setCopyDraft(e.target.value)}
              rows={18}
              className="border-[#EFE3D6] font-mono text-sm leading-relaxed"
              placeholder="貼上或輸入 Foodie 的文案內容"
            />
          ) : (
            <Tabs defaultValue="current">
              <TabsList>
                <TabsTrigger value="current">目前文案</TabsTrigger>
                <TabsTrigger value="diff">比較差異</TabsTrigger>
              </TabsList>

              <TabsContent value="current">
                {sub.copy_text ? (
                  <pre className="max-h-[28rem] overflow-y-auto whitespace-pre-wrap rounded-lg border border-[#EFE3D6] bg-white p-4 font-sans text-sm leading-relaxed text-[#3F2E1E]">
                    {sub.copy_text}
                  </pre>
                ) : (
                  <p className="rounded-lg border border-dashed border-[#EFE3D6] p-8 text-center text-sm text-[#A08E7C]">
                    尚未提交文案
                  </p>
                )}
              </TabsContent>

              <TabsContent value="diff">
                {sub.copy_text_prev ? (
                  <div className="max-h-[28rem] overflow-y-auto rounded-lg border border-[#EFE3D6]">
                    {diff.map((d, i) => (
                      <div
                        key={i}
                        className={`flex gap-2 px-3 py-0.5 font-sans text-sm leading-relaxed ${
                          d.type === "add"
                            ? "bg-green-50 text-green-800"
                            : d.type === "del"
                              ? "bg-red-50 text-red-700 line-through"
                              : "text-[#5C4630]"
                        }`}
                      >
                        <span className="w-3 shrink-0 select-none text-[#C4B5A6]">
                          {d.type === "add" ? "+" : d.type === "del" ? "-" : ""}
                        </span>
                        <span className="whitespace-pre-wrap">{d.text || " "}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-[#EFE3D6] p-8 text-center text-sm text-[#A08E7C]">
                    只有一個版本，沒有可比較的差異
                  </p>
                )}
              </TabsContent>
            </Tabs>
          )}

          <p className="mt-3 text-xs text-[#A08E7C]">
            {sub.copy_submitted_at
              ? `提交於 ${new Date(sub.copy_submitted_at).toLocaleString()}`
              : "尚未提交"}
            {sub.copy_reviewed_at && ` · 確稿於 ${new Date(sub.copy_reviewed_at).toLocaleString()}`}
          </p>
        </CardContent>
      </Card>

      {/* 照片 */}
      <Card className="border-[#EFE3D6] bg-white">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-[#EFE3D6] bg-[#FDF7F0]">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base text-[#3F2E1E]">照片（{myPics.length}）</CardTitle>
            <StageBadge status={sub.photo_status} />
            {selectedCount > 0 && (
              <span className="text-xs text-[#B85C00]">已選用 {selectedCount} 張</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) void uploadPhotos(sub, e.target.files);
                e.target.value = "";
              }}
            />
            <Button
              size="sm"
              variant="outline"
              className="border-[#EFE3D6] bg-white"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus className="mr-2 h-4 w-4" />
              {busy ? "上傳中…" : "上傳新照片"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-[#EFE3D6] bg-white"
              onClick={() => {
                setVideoDraft(sub.video_url ?? "");
                setVideoOpen(true);
              }}
            >
              <Link2 className="mr-2 h-4 w-4" />
              提供影片連結
            </Button>
            {sub.photo_status === "approved" ? (
              <Button
                size="sm"
                variant="outline"
                className="border-[#EFE3D6] bg-white"
                onClick={() =>
                  void patchSub(
                    sub.id,
                    { photo_status: "revising", photo_reviewed_at: null },
                    "已退回修改",
                  )
                }
              >
                取消確稿
              </Button>
            ) : (
              <Button
                size="sm"
                className="bg-[#FF8300] text-white hover:bg-[#E67600]"
                disabled={myPics.length === 0}
                onClick={() =>
                  void patchSub(
                    sub.id,
                    { photo_status: "approved", photo_reviewed_at: new Date().toISOString() },
                    "照片已確稿",
                  )
                }
              >
                照片確稿
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {sub.video_url && (
            <a
              href={sub.video_url}
              target="_blank"
              rel="noreferrer"
              className="mb-4 inline-flex items-center gap-2 rounded-lg border border-[#EFE3D6] bg-[#FDF7F0] px-3 py-2 text-sm text-[#B85C00] underline"
            >
              <Video className="h-4 w-4" />
              影片連結
            </a>
          )}

          {myPics.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[#EFE3D6] p-10 text-center text-sm text-[#A08E7C]">
              尚未上傳照片
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {myPics.map((p, i) => (
                <div
                  key={p.id}
                  className={`overflow-hidden rounded-xl border bg-white transition-colors ${
                    p.selected ? "border-[#FF8300] ring-1 ring-[#FF8300]" : "border-[#EFE3D6]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="text-sm font-bold text-[#3F2E1E]">
                      {p.code ?? "照片"}（{i + 1}）
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-[#C4B5A6] hover:text-red-600"
                      aria-label="移除照片"
                      onClick={() => void removePhoto(p)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <button
                    onClick={() => void togglePhoto(p)}
                    className={`block w-full py-1.5 text-center text-sm font-medium transition-colors ${
                      p.selected
                        ? "bg-[#FF8300] text-white"
                        : "bg-[#FFF4E8] text-[#B85C00] hover:bg-[#FFE8CE]"
                    }`}
                  >
                    {p.selected ? "已選用" : "選用"}
                  </button>
                  <a href={p.url} target="_blank" rel="noreferrer">
                    <img
                      src={p.url}
                      alt={`${p.code ?? "照片"} 交付照片`}
                      loading="lazy"
                      className="h-44 w-full bg-[#FDF7F0] object-cover"
                    />
                  </a>
                  <p className="px-3 py-2 text-center text-xs text-[#A08E7C]">
                    最後更新：{new Date(p.updated_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={videoOpen} onOpenChange={setVideoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>提供影片連結</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="video-url">影片網址</Label>
            <Input
              id="video-url"
              value={videoDraft}
              onChange={(e) => setVideoDraft(e.target.value)}
              placeholder="https://"
              className="border-[#EFE3D6]"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-[#EFE3D6] bg-white"
              onClick={() => setVideoOpen(false)}
            >
              取消
            </Button>
            <Button
              className="bg-[#FF8300] text-white hover:bg-[#E67600]"
              onClick={async () => {
                await patchSub(sub.id, { video_url: videoDraft.trim() || null }, "影片連結已更新");
                setVideoOpen(false);
              }}
            >
              儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
