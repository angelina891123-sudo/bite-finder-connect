import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  collabStats,
  PLAN_KEYS,
  planOf,
  platformsOf,
  rawSupabase,
  type ApplicationRow,
  type FoodieRow,
  type MerchantRow,
  type VStatus,
} from "./-data";

// 以 "-" 開頭的檔案不會被 TanStack Router 當成路由，供 /console 底下的頁面共用。

export const V_LABEL: Record<VStatus, string> = {
  pending: "待審核",
  approved: "已通過",
  rejected: "已拒絕",
};

export const UNSET = "（未設定）";

/** 主要動作按鈕：肚肚橘 */
export const BTN_ACCENT = "bg-[#FF8300] text-white hover:bg-[#E67600]";

export function StatusBadge({ status }: { status: VStatus }) {
  if (status === "approved") {
    return <Badge className="bg-[#FF8300] text-white hover:bg-[#FF8300]">已通過</Badge>;
  }
  return (
    <Badge variant={status === "rejected" ? "destructive" : "secondary"}>{V_LABEL[status]}</Badge>
  );
}

export function PlanBadge({ plan }: { plan: string | null }) {
  const p = planOf(plan);
  if (!p) return <span className="text-sm text-[#A08E7C]">{UNSET}</span>;
  return (
    <Badge variant="outline" className="border-[#FF8300] text-[#B85C00]">
      {p.key}
    </Badge>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-[#A08E7C]">{label}</p>
      <p className="mt-0.5 truncate text-sm text-[#3F2E1E]">{children}</p>
    </div>
  );
}

/** 審核與方案設定的共用邏輯，三個頁面共用同一份實作。 */
export function useReviewActions() {
  const qc = useQueryClient();

  const review = async (
    table: "merchant_profiles" | "foodie_profiles",
    id: string,
    status: VStatus,
    reviewNote: string,
  ) => {
    const { error } = await supabase
      .from(table)
      .update({
        verification_status: status,
        reviewed_at: new Date().toISOString(),
        review_note: reviewNote.trim() || null,
      })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success(status === "approved" ? "已審核通過" : "已拒絕");
    void qc.invalidateQueries({
      queryKey: [table === "merchant_profiles" ? "console-merchants" : "console-foodies"],
    });
    return true;
  };

  const setPlan = async (id: string, plan: string) => {
    const { error } = await rawSupabase
      .from("merchant_profiles")
      .update({ plan: plan === UNSET ? null : plan })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("方案已更新");
    void qc.invalidateQueries({ queryKey: ["console-merchants"] });
  };

  return { review, setPlan };
}

export function PlanSelect({
  value,
  onChange,
  className,
}: {
  value: string | null;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <Select value={value ?? UNSET} onValueChange={onChange}>
      <SelectTrigger className={className ?? "h-8 w-32"}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNSET}>{UNSET}</SelectItem>
        {PLAN_KEYS.map((p) => (
          <SelectItem key={p} value={p}>
            {p}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function MerchantDialog({
  merchant,
  onClose,
}: {
  merchant: MerchantRow | null;
  onClose: () => void;
}) {
  const { review, setPlan } = useReviewActions();
  const [note, setNote] = useState("");
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // 開啟不同商家時載入該筆的既有備註
  if (merchant && loadedFor !== merchant.id) {
    setLoadedFor(merchant.id);
    setNote(merchant.review_note ?? "");
  }

  const decide = async (status: VStatus) => {
    if (!merchant) return;
    if (await review("merchant_profiles", merchant.id, status, note)) onClose();
  };

  const plan = planOf(merchant?.plan);

  return (
    <Dialog open={merchant !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#3F2E1E]">{merchant?.store_name}</DialogTitle>
        </DialogHeader>
        {merchant && (
          <div className="space-y-4">
            <div className="rounded-lg border border-[#EFE3D6] bg-[#FDF7F0] p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-[#A08E7C]">方案別</p>
                  <p className="mt-0.5 text-sm font-medium text-[#3F2E1E]">
                    {plan ? plan.desc : UNSET}
                  </p>
                </div>
                <PlanSelect
                  value={merchant.plan}
                  onChange={(v) => setPlan(merchant.id, v)}
                  className="h-9 w-36"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="狀態">{V_LABEL[merchant.verification_status]}</Field>
              <Field label="聯絡人">{merchant.contact_name ?? "—"}</Field>
              <Field label="電話">{merchant.phone ?? "—"}</Field>
              <Field label="Email">{merchant.email ?? "—"}</Field>
              <Field label="地區">{merchant.region ?? "—"}</Field>
              <Field label="地址">{merchant.address ?? "—"}</Field>
              <Field label="註冊時間">{new Date(merchant.created_at).toLocaleString()}</Field>
              <Field label="上次審核">
                {merchant.reviewed_at ? new Date(merchant.reviewed_at).toLocaleString() : "—"}
              </Field>
            </div>

            <div className="space-y-2">
              <Label htmlFor="m-note">審核備註</Label>
              <Textarea
                id="m-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="記錄審核理由或待補資料"
                rows={3}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => decide("rejected")}>
            拒絕
          </Button>
          <Button className={BTN_ACCENT} onClick={() => decide("approved")}>
            通過
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FoodieDialog({
  foodie,
  apps,
  onClose,
}: {
  foodie: FoodieRow | null;
  apps: ApplicationRow[];
  onClose: () => void;
}) {
  const { review } = useReviewActions();
  const [note, setNote] = useState("");
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  if (foodie && loadedFor !== foodie.id) {
    setLoadedFor(foodie.id);
    setNote(foodie.review_note ?? "");
  }

  const decide = async (status: VStatus) => {
    if (!foodie) return;
    if (await review("foodie_profiles", foodie.id, status, note)) onClose();
  };

  const stats = foodie ? collabStats(apps, foodie.user_id) : null;

  return (
    <Dialog open={foodie !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#3F2E1E]">{foodie?.nickname}</DialogTitle>
        </DialogHeader>
        {foodie && stats && (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-medium text-[#A08E7C]">宣傳平台與粉絲數</p>
              <div className="space-y-2">
                {platformsOf(foodie).length === 0 ? (
                  <p className="text-sm text-[#A08E7C]">未填寫任何平台</p>
                ) : (
                  platformsOf(foodie).map((p) => (
                    <div
                      key={p.name}
                      className="flex items-center justify-between rounded-md border border-[#EFE3D6] bg-[#FDF7F0] px-3 py-2"
                    >
                      <span className="text-sm font-medium text-[#3F2E1E]">{p.name}</span>
                      <span className="text-sm text-[#A08E7C]">
                        {p.handle ?? "—"}
                        <span className="ml-3 font-medium tabular-nums text-[#3F2E1E]">
                          {p.followers.toLocaleString()}
                        </span>
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="曾經合作次數">
                {`已完成 ${stats.completed}／核准 ${stats.approved}／申請 ${stats.total}`}
              </Field>
              <Field label="互動率">
                {foodie.engagement_rate ? `${foodie.engagement_rate}%` : "—"}
              </Field>
              <Field label="Reels 平均觀看">{foodie.reels_avg_views.toLocaleString()}</Field>
              <Field label="真實姓名">{foodie.real_name ?? "—"}</Field>
              <Field label="地區">
                {[foodie.region, foodie.area].filter(Boolean).join(" · ") || "—"}
              </Field>
              <Field label="活動範圍">{foodie.areas.join("、") || "—"}</Field>
              <Field label="擅長類別">{foodie.categories.join("、") || "—"}</Field>
              <Field label="合作偏好">{foodie.collab_preferences.join("、") || "—"}</Field>
              <Field label="電話">{foodie.phone ?? "—"}</Field>
              <Field label="Email">{foodie.email ?? "—"}</Field>
            </div>

            {(foodie.ig_url || foodie.portfolio_url) && (
              <div className="flex flex-wrap gap-3 text-sm">
                {foodie.ig_url && (
                  <a
                    href={foodie.ig_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#FF8300] underline"
                  >
                    開啟 IG
                  </a>
                )}
                {foodie.portfolio_url && (
                  <a
                    href={foodie.portfolio_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#FF8300] underline"
                  >
                    作品集
                  </a>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="f-note">審核備註</Label>
              <Textarea
                id="f-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="記錄人工查驗結果，例如帳號真實性、內容品質"
                rows={3}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => decide("rejected")}>
            拒絕
          </Button>
          <Button className={BTN_ACCENT} onClick={() => decide("approved")}>
            通過
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
