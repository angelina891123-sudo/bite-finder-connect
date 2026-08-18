import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { REGIONS } from "@/lib/auth";
import { areasOf } from "@/lib/regions";
import {
  COLLAB_PREFS,
  FOODIE_CATEGORIES,
  GENDERS,
  saveFoodieProfile,
  type FoodieForm,
} from "@/lib/foodie-profile";
import { Field, SelectBox, TagGroup, Unit } from "@/components/form-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const EMPTY: FoodieForm = {
  nickname: "",
  realName: "",
  email: "",
  phone: "",
  gender: GENDERS[0] ?? "女",
  age: "",
  region: REGIONS[0] ?? "台北市",
  areas: [],
  ig: "",
  igUrl: "",
  igFollowers: "",
  reels: "",
  threads: "",
  threadsFollowers: "",
  youtube: "",
  youtubeSubs: "",
  tiktok: "",
  tiktokFollowers: "",
  otherSocial: "",
  otherSocialFollowers: "",
  portfolio: "",
  cats: [],
  prefs: [],
};

const str = (v: number | null | undefined) => (v ? String(v) : "");

const VERIFICATION: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  approved: { label: "已通過審核", variant: "default" },
  rejected: { label: "審核未通過", variant: "destructive" },
  pending: { label: "審核中", variant: "secondary" },
};

export function FoodieProfileForm({
  userId,
  userEmail,
}: {
  userId: string;
  userEmail: string | null;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState<FoodieForm>(EMPTY);
  const [busy, setBusy] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["foodie-profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("foodie_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!profile) {
      setF((p) => ({ ...p, email: p.email || (userEmail ?? "") }));
      return;
    }
    setF({
      nickname: profile.nickname ?? "",
      realName: profile.real_name ?? "",
      email: profile.email ?? userEmail ?? "",
      phone: profile.phone ?? "",
      gender: profile.gender ?? GENDERS[0] ?? "女",
      age: str(profile.age),
      region: profile.region ?? REGIONS[0] ?? "台北市",
      areas: profile.areas ?? [],
      ig: profile.ig_handle ?? "",
      igUrl: profile.ig_url ?? "",
      igFollowers: str(profile.ig_followers),
      reels: str(profile.reels_avg_views),
      threads: profile.threads_handle ?? "",
      threadsFollowers: str(profile.threads_followers),
      youtube: profile.youtube_channel ?? "",
      youtubeSubs: str(profile.youtube_subscribers),
      tiktok: profile.tiktok_handle ?? "",
      tiktokFollowers: str(profile.tiktok_followers),
      otherSocial: profile.other_social_handle ?? "",
      otherSocialFollowers: str(profile.other_social_followers),
      portfolio: profile.portfolio_url ?? "",
      cats: profile.categories ?? [],
      prefs: profile.collab_preferences ?? [],
    });
  }, [profile, userEmail]);

  const set = (k: keyof FoodieForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  const toggle = (k: "areas" | "cats" | "prefs", v: string) =>
    setF((p) => ({
      ...p,
      [k]: p[k].includes(v) ? p[k].filter((x) => x !== v) : [...p[k], v],
    }));

  const save = async () => {
    if (!f.nickname.trim()) {
      toast.error("請填寫暱稱／創作者名稱");
      return;
    }
    if (f.portfolio.trim() && !/^https?:\/\//i.test(f.portfolio.trim())) {
      toast.error("作品案例連結需以 http(s):// 開頭");
      return;
    }
    setBusy(true);
    const error = await saveFoodieProfile(userId, f);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("個人資料已更新");
    void qc.invalidateQueries({ queryKey: ["foodie-profile", userId] });
    void qc.invalidateQueries({ queryKey: ["my-followers", userId] });
  };

  if (isLoading) return <p className="text-muted-foreground">載入中…</p>;

  const verification = VERIFICATION[profile?.verification_status ?? "pending"]!;

  // 註冊時填寫的身分／聯絡資訊不開放自行修改；
  // 但既有帳號可能因註冊當下未寫入而為空，這種情況允許補填一次。
  const lockedHint = "註冊後不可自行修改，如需更改請聯繫平台";
  const locked = {
    realName: !!profile?.real_name,
    email: !!(profile?.email ?? userEmail),
    phone: !!profile?.phone,
    ig: !!profile?.ig_handle,
  };

  return (
    <div className="space-y-4">
      {!profile && (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          尚未建立 Foodie 資料，填寫以下欄位後儲存即可完成。粉絲數會同步給商家作為案件門檻判斷依據。
        </p>
      )}

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">基本資料</CardTitle>
            {profile && <Badge variant={verification.variant}>{verification.label}</Badge>}
          </div>
          {profile?.review_note && (
            <p className="text-xs text-muted-foreground">審核備註：{profile.review_note}</p>
          )}
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="暱稱／創作者名稱">
            <Input value={f.nickname} onChange={set("nickname")} placeholder="肚肚吃不停" />
          </Field>
          <Field label="真實姓名" hint={locked.realName ? lockedHint : undefined}>
            <Input
              value={f.realName}
              onChange={set("realName")}
              placeholder="王小美"
              disabled={locked.realName}
            />
          </Field>
          <Field label="聯絡 Email" hint={locked.email ? lockedHint : undefined}>
            <Input
              type="email"
              value={f.email}
              onChange={set("email")}
              placeholder="you@example.com"
              disabled={locked.email}
            />
          </Field>
          <Field label="手機號碼" hint={locked.phone ? lockedHint : undefined}>
            <Input
              value={f.phone}
              onChange={set("phone")}
              placeholder="0912-345-678"
              disabled={locked.phone}
            />
          </Field>
          <Field label="性別">
            <SelectBox
              value={f.gender}
              onChange={(e) => setF((p) => ({ ...p, gender: e.target.value }))}
              options={GENDERS}
            />
          </Field>
          <Field label="年齡">
            <Unit unit="歲">
              <Input inputMode="numeric" value={f.age} onChange={set("age")} placeholder="25" />
            </Unit>
          </Field>
          <Field label="常駐地區">
            <SelectBox
              value={f.region}
              onChange={(e) => setF((p) => ({ ...p, region: e.target.value, areas: [] }))}
              options={REGIONS}
            />
          </Field>
          <Field label="主要活動範圍" hint="可複選，依所選縣市顯示" full>
            <TagGroup
              options={areasOf(f.region)}
              selected={f.areas}
              onToggle={(v) => toggle("areas", v)}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">社群數據</CardTitle>
          <p className="text-xs text-muted-foreground">
            粉絲數會同步至商家後台，並用於判斷案件的粉絲門檻。
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Instagram 帳號" hint={locked.ig ? lockedHint : undefined}>
            <Input value={f.ig} onChange={set("ig")} placeholder="@your_ig" disabled={locked.ig} />
          </Field>
          <Field label="IG 粉絲數">
            <Unit unit="人">
              <Input
                inputMode="numeric"
                value={f.igFollowers}
                onChange={set("igFollowers")}
                placeholder="12000"
              />
            </Unit>
          </Field>
          <Field label="平均 Reels 瀏覽數" hint="近 30 天">
            <Unit unit="次">
              <Input
                inputMode="numeric"
                value={f.reels}
                onChange={set("reels")}
                placeholder="8000"
              />
            </Unit>
          </Field>
          <Field label="IG 連結">
            <Input
              value={f.igUrl}
              onChange={set("igUrl")}
              placeholder="https://instagram.com/your_ig"
            />
          </Field>
          <Field label="Threads 帳號" hint="選填">
            <Input value={f.threads} onChange={set("threads")} placeholder="@your_threads" />
          </Field>
          <Field label="Threads 粉絲數" hint="選填">
            <Unit unit="人">
              <Input
                inputMode="numeric"
                value={f.threadsFollowers}
                onChange={set("threadsFollowers")}
              />
            </Unit>
          </Field>
          <Field label="YouTube 頻道" hint="選填">
            <Input value={f.youtube} onChange={set("youtube")} placeholder="youtube.com/@channel" />
          </Field>
          <Field label="YouTube 訂閱數" hint="選填">
            <Unit unit="人">
              <Input inputMode="numeric" value={f.youtubeSubs} onChange={set("youtubeSubs")} />
            </Unit>
          </Field>
          <Field label="TikTok 帳號" hint="選填">
            <Input value={f.tiktok} onChange={set("tiktok")} placeholder="@your_tiktok" />
          </Field>
          <Field label="TikTok 粉絲數" hint="選填">
            <Unit unit="人">
              <Input
                inputMode="numeric"
                value={f.tiktokFollowers}
                onChange={set("tiktokFollowers")}
              />
            </Unit>
          </Field>
          <Field label="其他社群帳號" hint="選填，請一併填寫平台名稱">
            <Input
              value={f.otherSocial}
              onChange={set("otherSocial")}
              placeholder="例如：小紅書 @your_id"
            />
          </Field>
          <Field label="其他社群粉絲數" hint="選填">
            <Unit unit="人">
              <Input
                inputMode="numeric"
                value={f.otherSocialFollowers}
                onChange={set("otherSocialFollowers")}
              />
            </Unit>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">內容偏好</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>
              擅長內容類別 <span className="text-xs font-normal text-muted-foreground">可複選</span>
            </Label>
            <TagGroup
              options={FOODIE_CATEGORIES}
              selected={f.cats}
              onToggle={(v) => toggle("cats", v)}
            />
          </div>
          <div className="space-y-2">
            <Label>
              偏好合作類型 <span className="text-xs font-normal text-muted-foreground">可複選</span>
            </Label>
            <TagGroup
              options={COLLAB_PREFS}
              selected={f.prefs}
              onToggle={(v) => toggle("prefs", v)}
            />
          </div>
          <Field label="作品案例連結" hint="選填，貼上 IG 貼文或 Reels 連結" full>
            <Input
              value={f.portfolio}
              onChange={set("portfolio")}
              placeholder="https://instagram.com/p/..."
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={busy}>
          {busy ? "儲存中…" : "儲存變更"}
        </Button>
      </div>
    </div>
  );
}
