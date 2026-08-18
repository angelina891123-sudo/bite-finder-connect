import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SUBMISSION_LABEL, type SubmissionStatus } from "@/lib/campaign";

type MaterialRow = {
  id: string;
  material_caption: string | null;
  material_media: string[] | null;
  material_submitted_at: string | null;
  caption_status: SubmissionStatus | null;
  media_status: SubmissionStatus | null;
  caption_review_note: string | null;
  media_review_note: string | null;
  campaigns: { title: string; restaurant_name: string | null } | null;
};

/** 文案或素材其中一項的審核區塊：狀態為 submitted 時才顯示通過／退件操作。 */
function ReviewField({
  title,
  status,
  note,
  children,
  onReview,
}: {
  title: string;
  status: SubmissionStatus;
  note: string | null;
  children?: ReactNode;
  onReview: (pass: boolean, note: string) => Promise<void>;
}) {
  const [draftNote, setDraftNote] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold">{title}</p>
        <Badge variant={SUBMISSION_LABEL[status].variant}>{SUBMISSION_LABEL[status].label}</Badge>
      </div>
      {children}
      {status === "revising" && note && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          退件原因：{note}
        </p>
      )}
      {status === "submitted" && (
        <>
          <Input
            placeholder="退件原因（退件時必填）"
            value={draftNote}
            onChange={(e) => setDraftNote(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await onReview(true, "");
                setBusy(false);
              }}
            >
              通過
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await onReview(false, draftNote);
                setBusy(false);
              }}
            >
              退件
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/** 素材審核清單：文案與圖片／影片分開審核，管理員可各自通過或退件。 */
export function MaterialReviewList({
  rows,
  onReviewCaption,
  onReviewMedia,
  emptyText,
}: {
  rows: MaterialRow[];
  onReviewCaption: (id: string, pass: boolean, note: string) => Promise<void>;
  onReviewMedia: (id: string, pass: boolean, note: string) => Promise<void>;
  emptyText: string;
}) {
  if (rows.length === 0)
    return (
      <p className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
        {emptyText}
      </p>
    );

  return (
    <div className="space-y-4">
      {rows.map((r) => (
        <Card key={r.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{r.campaigns?.title ?? "案件"}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {r.campaigns?.restaurant_name ?? "餐廳"}
              {r.material_submitted_at
                ? `・送審於 ${new Date(r.material_submitted_at).toLocaleString()}`
                : ""}
            </p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ReviewField
              title={`文案：${r.material_caption?.trim() || "（未提供）"}`}
              status={r.caption_status ?? "draft"}
              note={r.caption_review_note}
              onReview={(pass, note) => onReviewCaption(r.id, pass, note)}
            />
            <ReviewField
              title={`素材（${r.material_media?.length ?? 0}）`}
              status={r.media_status ?? "draft"}
              note={r.media_review_note}
              onReview={(pass, note) => onReviewMedia(r.id, pass, note)}
            >
              <div className="flex flex-wrap gap-2">
                {(r.material_media ?? []).map((src) => (
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
                {(r.material_media?.length ?? 0) === 0 && (
                  <span className="text-xs text-muted-foreground">未上傳</span>
                )}
              </div>
            </ReviewField>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
