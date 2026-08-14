import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { REGIONS } from "@/lib/auth";
import { areasOf, passwordScore } from "@/lib/regions";
import {
  COLLAB_PREFS,
  FOODIE_CATEGORIES,
  PENDING_KEY,
  saveFoodieProfile,
  type FoodieForm,
} from "@/lib/foodie-profile";
import { PasswordStrength } from "@/components/PasswordStrength";
import { SiteHeader } from "@/components/SiteHeader";
import { Field, SelectBox, TagGroup, Unit } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/foodie-signup")({
  head: () => ({
    meta: [
      { title: "Foodie 創作者註冊｜肚肚 Foodie 媒合專區" },
      { name: "description", content: "填寫基本資料、社群數據與內容偏好，加入肚肚 Foodie，媒合最適合你的餐廳業配案件。" },
      { property: "og:title", content: "Foodie 創作者註冊｜肚肚" },
      { property: "og:description", content: "三步驟完成 Foodie 註冊，開始接洽餐廳業配合作。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FoodieSignup,
});

const STEPS = [
  { n: 1, title: "基本資料", desc: "姓名、聯絡方式、居住地區" },
  { n: 2, title: "社群數據", desc: "粉絲數、觸及與互動表現" },
  { n: 3, title: "內容偏好", desc: "擅長類型與合作意願" },
];

function FoodieSignup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const [f, setF] = useState({
    nickname: "",
    realName: "",
    email: "",
    password: "",
    phone: "",
    region: REGIONS[0] ?? "台北市",
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
  });
  const [cats, setCats] = useState<string[]>([]);
  const [prefs, setPrefs] = useState<string[]>([]);
  const [areas, setAreas] = useState<string[]>([]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  const toggle = (list: string[], setList: (v: string[]) => void, v: string) =>
    setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const next = () => {
    if (step === 1) {
      if (!f.nickname.trim() || !f.email.trim()) {
        toast.error("請填寫暱稱與 Email");
        return;
      }
      if (!passwordScore(f.password).strong) {
        toast.error("密碼強度不足，請至少 8 碼並包含英文字母與數字");
        return;
      }
    }
    setStep((s) => Math.min(3, s + 1));
  };

  const submit = async () => {
    setBusy(true);

    const form: FoodieForm = {
      nickname: f.nickname,
      realName: f.realName,
      email: f.email,
      phone: f.phone,
      region: f.region,
      areas,
      ig: f.ig,
      igUrl: f.igUrl,
      igFollowers: f.igFollowers,
      reels: f.reels,
      threads: f.threads,
      threadsFollowers: f.threadsFollowers,
      youtube: f.youtube,
      youtubeSubs: f.youtubeSubs,
      tiktok: f.tiktok,
      tiktokFollowers: f.tiktokFollowers,
      otherSocial: f.otherSocial,
      otherSocialFollowers: f.otherSocialFollowers,
      portfolio: f.portfolio,
      cats,
      prefs,
    };

    const { data, error } = await supabase.auth.signUp({
      email: f.email.trim(),
      password: f.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          role: "creator",
          display_name: f.nickname.trim(),
          instagram_handle: f.ig.trim() || null,
          region: f.region,
          // 需要 Email 驗證時 signUp 不會回傳 session，先暫存整份表單，
          // 待驗證完成登入後由 syncPendingFoodieProfile 補寫入。
          [PENDING_KEY]: form,
        },
      },
    });

    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }

    if (data.session?.user) {
      const saveError = await saveFoodieProfile(data.session.user.id, form);
      if (saveError) toast.error(saveError.message);
    }

    setBusy(false);
    setDone(true);
    if (data.session) setTimeout(() => navigate({ to: "/my-applications" }), 3000);
  };

  return (
    <div className="min-h-screen bg-muted/40">
      <SiteHeader />
      <main className="mx-auto flex max-w-5xl items-center justify-center px-4 py-10">
        <div className="grid w-full overflow-hidden rounded-3xl border border-border bg-card shadow-xl md:grid-cols-[300px_1fr]">
          {/* side panel */}
          <aside className="hidden flex-col bg-primary p-9 text-primary-foreground md:flex">
            <div className="mb-6 flex h-9 w-9 items-center justify-center rounded-xl bg-primary-foreground/15 text-lg font-bold">
              肚
            </div>
            <h2 className="text-xl font-semibold leading-snug">
              加入肚肚
              <br />
              Foodie 創作者
            </h2>
            <p className="mt-3 text-xs leading-relaxed text-primary-foreground/75">
              填寫你的基本資料與社群數據，讓我們幫你媒合最適合的餐廳業配案件。
            </p>

            <div className="my-auto flex flex-col gap-5 pt-10">
              {STEPS.map((s) => {
                const state = done || step > s.n ? "done" : step === s.n ? "active" : "idle";
                return (
                  <div key={s.n} className={`flex gap-3 ${state === "idle" ? "opacity-45" : ""}`}>
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                        state === "active"
                          ? "border-transparent bg-primary-foreground text-primary"
                          : state === "done"
                            ? "border-transparent bg-primary-foreground/90 text-primary"
                            : "border-primary-foreground/60"
                      }`}
                    >
                      {state === "done" ? <Check className="h-3.5 w-3.5" /> : s.n}
                    </span>
                    <span>
                      <b className="block text-[13px] font-semibold">{s.title}</b>
                      <span className="text-[11px] text-primary-foreground/65">{s.desc}</span>
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="mt-5 text-[11px] text-primary-foreground/55">
              註冊即表示同意肚肚服務條款與隱私權政策
            </p>
          </aside>

          {/* form panel */}
          <section className="flex flex-col p-6 md:p-10">
            {done ? (
              <div className="m-auto max-w-sm py-16 text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-accent text-primary">
                  <Check className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-semibold">請前往信箱完成驗證</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  我們已寄出驗證信到 <b className="text-foreground">{f.email}</b>，請點擊信中的連結完成 Email 驗證後再登入。
                  <br />
                  驗證完成後，我們會依照你的粉絲數與內容偏好為你媒合合適的餐廳業配案件。
                </p>
                <p className="mt-3 text-xs text-muted-foreground">沒收到信？請檢查垃圾郵件匣或稍後再試。</p>
                <Button asChild className="mt-6">
                  <Link to="/">回到探索案件</Link>
                </Button>
              </div>
            ) : (
              <>
                <header className="mb-6">
                  <p className="text-[11.5px] font-bold uppercase tracking-widest text-primary">
                    Step {step} / 3
                  </p>
                  <h1 className="text-xl font-semibold">{STEPS[step - 1]!.title}</h1>
                </header>

                {step === 1 && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="暱稱／創作者名稱">
                      <Input value={f.nickname} onChange={set("nickname")} placeholder="肚肚吃不停" />
                    </Field>
                    <Field label="真實姓名">
                      <Input value={f.realName} onChange={set("realName")} placeholder="王小美" />
                    </Field>
                    <Field label="Email">
                      <Input type="email" value={f.email} onChange={set("email")} placeholder="you@example.com" />
                    </Field>
                    <Field label="密碼" hint="至少 8 碼，含英文字母與數字">
                      <Input type="password" value={f.password} onChange={set("password")} />
                      <PasswordStrength password={f.password} />
                    </Field>
                    <Field label="手機號碼">
                      <Input value={f.phone} onChange={set("phone")} placeholder="0912-345-678" />
                    </Field>
                    <Field label="常駐地區">
                      <SelectBox
                        value={f.region}
                        onChange={(e) => {
                          setF((p) => ({ ...p, region: e.target.value }));
                          setAreas([]);
                        }}
                        options={REGIONS}
                      />
                    </Field>
                    <Field label="主要活動範圍" hint="可複選，依所選縣市顯示" full>
                      <TagGroup
                        options={areasOf(f.region)}
                        selected={areas}
                        onToggle={(v) => toggle(areas, setAreas, v)}
                      />
                    </Field>
                  </div>
                )}

                {step === 2 && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Instagram 帳號">
                      <Input value={f.ig} onChange={set("ig")} placeholder="@your_ig" />
                    </Field>
                    <Field label="IG 粉絲數">
                      <Unit unit="人">
                        <Input inputMode="numeric" value={f.igFollowers} onChange={set("igFollowers")} placeholder="12000" />
                      </Unit>
                    </Field>
                    <Field label="平均 Reels 瀏覽數" hint="近 30 天">
                      <Unit unit="次">
                        <Input inputMode="numeric" value={f.reels} onChange={set("reels")} placeholder="8000" />
                      </Unit>
                    </Field>
                    <Field label="IG 連結">
                      <Input value={f.igUrl} onChange={set("igUrl")} placeholder="https://instagram.com/your_ig" />
                    </Field>
                    <Field label="Threads 帳號" hint="選填">
                      <Input value={f.threads} onChange={set("threads")} placeholder="@your_threads" />
                    </Field>
                    <Field label="Threads 粉絲數" hint="選填">
                      <Unit unit="人">
                        <Input inputMode="numeric" value={f.threadsFollowers} onChange={set("threadsFollowers")} />
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
                        <Input inputMode="numeric" value={f.tiktokFollowers} onChange={set("tiktokFollowers")} />
                      </Unit>
                    </Field>
                    <Field label="其他社群帳號" hint="選填，請一併填寫平台名稱">
                      <Input value={f.otherSocial} onChange={set("otherSocial")} placeholder="例如：小紅書 @your_id" />
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
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label>
                        擅長內容類別 <span className="text-xs font-normal text-muted-foreground">可複選</span>
                      </Label>
                      <TagGroup options={FOODIE_CATEGORIES} selected={cats} onToggle={(v) => toggle(cats, setCats, v)} />
                    </div>
                    <div className="space-y-2">
                      <Label>
                        偏好合作類型 <span className="text-xs font-normal text-muted-foreground">可複選</span>
                      </Label>
                      <TagGroup options={COLLAB_PREFS} selected={prefs} onToggle={(v) => toggle(prefs, setPrefs, v)} />
                    </div>
                    <Field label="作品案例連結" hint="選填，貼上 IG 貼文或 Reels 連結" full>
                      <Input value={f.portfolio} onChange={set("portfolio")} placeholder="https://instagram.com/p/..." />
                    </Field>
                  </div>
                )}

                <div className="mt-8 flex items-center justify-between pt-4">
                  {step > 1 ? (
                    <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
                      上一步
                    </Button>
                  ) : (
                    <Link to="/auth" search={{ role: "creator", redirect: undefined }} className="text-sm text-muted-foreground hover:text-primary">
                      已有帳號？前往登入
                    </Link>
                  )}
                  {step < 3 ? (
                    <Button onClick={next}>下一步</Button>
                  ) : (
                    <Button onClick={submit} disabled={busy}>
                      完成註冊
                    </Button>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

