import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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
  rawSupabase,
  SUB_LABEL,
  useApplications,
  useFoodies,
  useMerchants,
  type ApplicationRow,
  type SubStatus,
} from "./-data";

export const Route = createFileRoute("/console/submissions")({
  component: MaterialReview,
});

/** 管理員從後台補上傳照片時使用；Foodie 自己上傳的照片仍在他們原本的位置。 */
const BUCKET = "submission-photos";

function StageBadge({ status }: { status: SubStatus | null }) {
  const s = status ?? "draft";
  const style: Record<SubStatus, string> = {
    approved: "bg-[#FF8300] text-white hover:bg-[#FF8300]",
    submitted: "bg-[#FFF4E8] text-[#B85C00] hover:bg-[#FFF4E8]",
    revising: "bg-red-50 text-red-700 hover:bg-red-50",
    draft: "bg-[#F5EBE0] text-[#7A6555] hover:bg-[#F5EBE0]",
  };
  return <Badge className={style[s]}>【{SUB_LABEL[s]}】</Badge>;
}

function MaterialReview() {
  const { isAdmin, user } = useAuth();
  const qc = useQueryClient();
  const applications = useApplications(isAdmin);
  const foodies = useFoodies(isAdmin);
  const merchants = useMerchants(isAdmin);

  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const apps = applications.data ?? [];
  // 只有已核准的媒合才需要交付文案與照片
  const reviewable = apps.filter((a) => a.status === "approved");

  // migration 套用前，審核狀態欄位會是 undefined
  const columnsMissing = reviewable.length > 0 && reviewable[0]!.caption_status === undefined;

  const foodieName = (id: string) => foodies.data?.find((f) => f.user_id === id)?.nickname ?? "—";
  const merchantName = (id: string | undefined) =>
    merchants.data?.find((m) => m.user_id === id)?.store_name ?? "—";

  const refresh = () => void qc.invalidateQueries({ queryKey: ["console-applications"] });

  const patch = async (id: string, values: Record<string, unknown>, msg: string) => {
    const { error } = await rawSupabase.from("applications").update(values).eq("id", id);
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success(msg);
    refresh();
    return true;
  };

  const saveCaption = async (a: ApplicationRow) => {
    // material_caption_prev 由資料庫觸發器自動保存，這裡只寫新內容
    if (await patch(a.id, { material_caption: draft }, "文案已更新")) setEditing(false);
  };

  const toggleSelected = async (a: ApplicationRow, url: string) => {
    const current = a.selected_media ?? [];
    const on = current.includes(url);
    await patch(
      a.id,
      { selected_media: on ? current.filter((u) => u !== url) : [...current, url] },
      on ? "已取消選用" : "已選用",
    );
  };

  const removeMedia = async (a: ApplicationRow, url: string) => {
    // 觸發器會自動把 selected_media 裡已不存在的項目剔除
    await patch(
      a.id,
      { material_media: (a.material_media ?? []).filter((u) => u !== url) },
      "照片已移除",
    );
  };

  const uploadMedia = async (a: ApplicationRow, files: FileList) => {
    if (!user) return;
    setBusy(true);
    const urls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${user.id}/${a.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file);
      if (error) {
        toast.error(`${file.name}：${error.message}`);
        continue;
      }
      urls.push(supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
    }
    setBusy(false);
    if (urls.length === 0) return;
    await patch(
      a.id,
      { material_media: [...(a.material_media ?? []), ...urls] },
      `已上傳 ${urls.length} 張照片`,
    );
  };

  // ---------- 清單 ----------
  if (!openId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-[#3F2E1E]">Foodie 內容審核</h1>
          <p className="mt-1 text-sm text-[#A08E7C]">
            審核 Foodie 交付的文案與照片，共 {reviewable.length} 筆已核准媒合
          </p>
        </div>

        {columnsMissing && (
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader>
              <CardTitle className="text-base text-amber-900">尚未建立審核狀態欄位</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-amber-800">
              <p>
                文案與照片可以正常顯示，但確稿、比較差異、選用照片需要 applications
                上的新欄位。migration 已寫好，還沒套用到 Supabase。
              </p>
              <p className="font-mono text-xs">
                supabase/migrations/20260817140000_material_review.sql
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="border-[#EFE3D6] bg-white">
          <CardHeader>
            <CardTitle className="text-base text-[#3F2E1E]">交付內容清單</CardTitle>
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
                  <TableHead className="text-right">已選用</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviewable.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium text-[#3F2E1E]">
                      {a.campaigns?.title ?? "—"}
                    </TableCell>
                    <TableCell>
                      {a.campaigns?.restaurant_name ?? merchantName(a.campaigns?.merchant_id)}
                    </TableCell>
                    <TableCell>{foodieName(a.creator_id)}</TableCell>
                    <TableCell>
                      {a.material_caption ? (
                        <StageBadge status={a.caption_status} />
                      ) : (
                        <span className="text-sm text-[#A08E7C]">未提交</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {(a.material_media ?? []).length > 0 ? (
                        <StageBadge status={a.media_status} />
                      ) : (
                        <span className="text-sm text-[#A08E7C]">未提交</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {(a.material_media ?? []).length}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {(a.selected_media ?? []).length}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        className="bg-[#FF8300] text-white hover:bg-[#E67600]"
                        onClick={() => {
                          setOpenId(a.id);
                          setEditing(false);
                          setDraft(a.material_caption ?? "");
                        }}
                      >
                        審核
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {reviewable.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-[#A08E7C]">
                      目前沒有已核准的媒合。請先到「案件與媒合管理」核准 Foodie 的申請。
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
  if (!app) {
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

  const media = app.material_media ?? [];
  const selected = app.selected_media ?? [];
  const diff = diffLines(app.material_caption_prev ?? "", app.material_caption ?? "");

  return (
    <div className="space-y-5">
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

      {/* 文案 */}
      <Card className="border-[#EFE3D6] bg-white">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-[#EFE3D6] bg-[#FDF7F0]">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base text-[#3F2E1E]">文案</CardTitle>
            <StageBadge status={app.caption_status} />
          </div>
          <div className="flex flex-wrap gap-2">
            {editing ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-[#EFE3D6] bg-white"
                  onClick={() => {
                    setEditing(false);
                    setDraft(app.material_caption ?? "");
                  }}
                >
                  取消
                </Button>
                <Button
                  size="sm"
                  className="bg-[#FF8300] text-white hover:bg-[#E67600]"
                  onClick={() => void saveCaption(app)}
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
                  onClick={() => setEditing(true)}
                >
                  編輯文案
                </Button>
                {app.caption_status === "approved" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-[#EFE3D6] bg-white"
                    onClick={() =>
                      void patch(
                        app.id,
                        { caption_status: "revising", caption_reviewed_at: null },
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
                        void patch(app.id, { caption_status: "revising" }, "已退回修改")
                      }
                    >
                      退回修改
                    </Button>
                    <Button
                      size="sm"
                      className="bg-[#FF8300] text-white hover:bg-[#E67600]"
                      disabled={!app.material_caption}
                      onClick={() =>
                        void patch(
                          app.id,
                          {
                            caption_status: "approved",
                            caption_reviewed_at: new Date().toISOString(),
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
          {editing ? (
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={18}
              className="border-[#EFE3D6] text-sm leading-relaxed"
              placeholder="Foodie 的文案內容"
            />
          ) : (
            <Tabs defaultValue="current">
              <TabsList>
                <TabsTrigger value="current">目前文案</TabsTrigger>
                <TabsTrigger value="diff">比較差異</TabsTrigger>
              </TabsList>

              <TabsContent value="current">
                {app.material_caption ? (
                  <pre className="max-h-[28rem] overflow-y-auto whitespace-pre-wrap rounded-lg border border-[#EFE3D6] bg-white p-4 font-sans text-sm leading-relaxed text-[#3F2E1E]">
                    {app.material_caption}
                  </pre>
                ) : (
                  <p className="rounded-lg border border-dashed border-[#EFE3D6] p-8 text-center text-sm text-[#A08E7C]">
                    Foodie 尚未提交文案
                  </p>
                )}
              </TabsContent>

              <TabsContent value="diff">
                {app.material_caption_prev ? (
                  <div className="max-h-[28rem] overflow-y-auto rounded-lg border border-[#EFE3D6]">
                    {diff.map((d, i) => (
                      <div
                        key={i}
                        className={`flex gap-2 px-3 py-0.5 text-sm leading-relaxed ${
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
            {app.submitted_at
              ? `提交於 ${new Date(app.submitted_at).toLocaleString()}`
              : "尚未提交"}
            {app.caption_reviewed_at &&
              ` · 確稿於 ${new Date(app.caption_reviewed_at).toLocaleString()}`}
          </p>
        </CardContent>
      </Card>

      {/* 照片 */}
      <Card className="border-[#EFE3D6] bg-white">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-[#EFE3D6] bg-[#FDF7F0]">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base text-[#3F2E1E]">照片（{media.length}）</CardTitle>
            <StageBadge status={app.media_status} />
            {selected.length > 0 && (
              <span className="text-xs text-[#B85C00]">已選用 {selected.length} 張</span>
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
                if (e.target.files?.length) void uploadMedia(app, e.target.files);
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
              {busy ? "上傳中…" : "補上傳照片"}
            </Button>
            {app.media_status === "approved" ? (
              <Button
                size="sm"
                variant="outline"
                className="border-[#EFE3D6] bg-white"
                onClick={() =>
                  void patch(
                    app.id,
                    { media_status: "revising", media_reviewed_at: null },
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
                disabled={media.length === 0}
                onClick={() =>
                  void patch(
                    app.id,
                    { media_status: "approved", media_reviewed_at: new Date().toISOString() },
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
          {media.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[#EFE3D6] p-10 text-center text-sm text-[#A08E7C]">
              Foodie 尚未上傳照片
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {media.map((url, i) => {
                const isSelected = selected.includes(url);
                return (
                  <div
                    key={url}
                    className={`overflow-hidden rounded-xl border bg-white transition-colors ${
                      isSelected ? "border-[#FF8300] ring-1 ring-[#FF8300]" : "border-[#EFE3D6]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="text-sm font-bold text-[#3F2E1E]">
                        B{String(i + 1).padStart(3, "0")}（{i + 1}）
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-[#C4B5A6] hover:text-red-600"
                        aria-label="移除照片"
                        onClick={() => void removeMedia(app, url)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <button
                      onClick={() => void toggleSelected(app, url)}
                      className={`block w-full py-1.5 text-center text-sm font-medium transition-colors ${
                        isSelected
                          ? "bg-[#FF8300] text-white"
                          : "bg-[#FFF4E8] text-[#B85C00] hover:bg-[#FFE8CE]"
                      }`}
                    >
                      {isSelected ? "已選用" : "選用"}
                    </button>
                    <a href={url} target="_blank" rel="noreferrer">
                      <img
                        src={url}
                        alt={`交付照片 ${i + 1}`}
                        loading="lazy"
                        className="h-44 w-full bg-[#FDF7F0] object-cover"
                      />
                    </a>
                  </div>
                );
              })}
            </div>
          )}

          {app.media_reviewed_at && (
            <p className="mt-3 text-xs text-[#A08E7C]">
              確稿於 {new Date(app.media_reviewed_at).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
