import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type MaterialRow = {
  id: string;
  material_caption: string | null;
  material_media: string[] | null;
  material_submitted_at: string | null;
  campaigns: { title: string; restaurant_name: string | null } | null;
};

/** 素材審核清單，管理員與商家共用同一種呈現。 */
export function MaterialReviewList({
  rows,
  onReview,
  emptyText,
}: {
  rows: MaterialRow[];
  onReview: (id: string, pass: boolean, note: string) => Promise<void>;
  emptyText: string;
}) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

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
            <div>
              <p className="mb-1 text-xs font-semibold">文案</p>
              <p className="whitespace-pre-wrap rounded-md border border-border p-3 text-muted-foreground">
                {r.material_caption?.trim() || "（未提供）"}
              </p>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold">素材（{r.material_media?.length ?? 0}）</p>
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
            </div>
            <Input
              placeholder="退件原因（退件時必填）"
              value={notes[r.id] ?? ""}
              onChange={(e) => setNotes((p) => ({ ...p, [r.id]: e.target.value }))}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={busy === r.id}
                onClick={async () => {
                  setBusy(r.id);
                  await onReview(r.id, true, "");
                  setBusy(null);
                }}
              >
                通過
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={busy === r.id}
                onClick={async () => {
                  setBusy(r.id);
                  await onReview(r.id, false, notes[r.id] ?? "");
                  setBusy(null);
                }}
              >
                退件
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
