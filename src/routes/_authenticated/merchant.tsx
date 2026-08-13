import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  BarChart3,
  ShoppingCart,
  UtensilsCrossed,
  Users2,
  Megaphone,
  Settings,
  Plus,
  LogOut,
  TrendingUp,
  Pencil,
  X,
  ImagePlus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, REGIONS, COLLAB_TYPES } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/merchant")({
  head: () => ({
    meta: [
      { title: "商家後台｜肚肚 Foodie 媒合專區" },
      { name: "description", content: "餐廳商家後台：銷售管理與 Foodie 案件媒合，一站上架與審核申請。" },
      { property: "og:title", content: "商家後台｜肚肚 Foodie 媒合專區" },
      { property: "og:description", content: "上架 Foodie 媒合案件、查看申請並核准或拒絕。" },
    ],
  }),
  component: MerchantBackoffice,
});

const MENU = [
  { key: "overview", label: "營運總覽", icon: BarChart3 },
  { key: "orders", label: "訂單管理", icon: ShoppingCart },
  { key: "menu", label: "商品／菜單", icon: UtensilsCrossed },
  { key: "members", label: "會員管理", icon: Users2 },
  { key: "foodie", label: "Foodie 案件媒合", icon: Megaphone },
  { key: "performance", label: "合作成效", icon: TrendingUp },
  { key: "settings", label: "店家設定", icon: Settings },
] as const;

type MenuKey = (typeof MENU)[number]["key"];

type Campaign = {
  id: string;
  title: string;
  restaurant_name: string | null;
  description: string | null;
  region: string;
  collab_type: string;
  reward: string;
  slots: number;
  min_followers: number;
  deadline: string | null;
  photos: string[];
  status: "draft" | "published" | "closed";
  created_at: string;
};

type Application = {
  id: string;
  campaign_id: string;
  creator_id: string;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  submission_url: string | null;
  completed: boolean;
  created_at: string;
};

function MerchantBackoffice() {
  const { user, isMerchant, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [section, setSection] = useState<MenuKey>("foodie");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);

  const { data: campaigns = [] } = useQuery({
    queryKey: ["merchant-campaigns", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("merchant_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Campaign[];
    },
  });

  const { data: applications = [] } = useQuery({
    queryKey: ["merchant-applications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Application[];
    },
  });

  const { data: creators = {} } = useQuery({
    queryKey: ["applicant-profiles", applications.map((a) => a.creator_id).join(",")],
    enabled: applications.length > 0,
    queryFn: async () => {
      const ids = [...new Set(applications.map((a) => a.creator_id))];
      const { data } = await supabase
        .from("profiles")
        .select("id,display_name,instagram_handle,follower_count,region")
        .in("id", ids);
      const map: Record<string, { display_name: string | null; instagram_handle: string | null; follower_count: number }> = {};
      for (const p of data ?? []) map[p.id] = p;
      return map;
    },
  });

  const decide = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("applications").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(status === "approved" ? "已核准申請" : "已拒絕申請");
    void qc.invalidateQueries({ queryKey: ["merchant-applications", user?.id] });
  };

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { role: "merchant", redirect: undefined }, replace: true });
  };

  if (loading) return <div className="p-10 text-muted-foreground">載入中…</div>;

  if (!isMerchant) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <h1 className="text-xl font-bold">此帳號沒有商家權限</h1>
        <p className="mt-2 text-sm text-muted-foreground">請以餐廳商家帳號登入，或註冊新的商家帳號。</p>
        <Button className="mt-4" onClick={signOut}>
          切換帳號
        </Button>
      </div>
    );
  }

  const active = campaigns.filter((c) => c.status === "published").length;
  const pending = applications.filter((a) => a.status === "pending").length;

  return (
    <div className="flex min-h-screen bg-muted/40">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-background p-4 md:flex">
        <div className="mb-6 px-2 text-lg font-extrabold">
          肚肚 <span className="text-primary">店家後台</span>
        </div>
        <nav className="space-y-1">
          {MENU.map((m) => (
            <button
              key={m.key}
              onClick={() => setSection(m.key)}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                section === m.key ? "bg-primary text-primary-foreground" : "text-foreground/80 hover:bg-accent"
              }`}
            >
              <m.icon className="h-4 w-4" />
              {m.label}
            </button>
          ))}
        </nav>
        <Button variant="ghost" className="mt-auto justify-start" onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" /> 登出
        </Button>
      </aside>

      <main className="flex-1 p-6">
        <div className="mb-6 flex flex-wrap gap-2 md:hidden">
          {MENU.map((m) => (
            <button
              key={m.key}
              onClick={() => setSection(m.key)}
              className={`rounded-full border px-3 py-1 text-xs ${
                section === m.key ? "border-primary bg-primary text-primary-foreground" : "border-border"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {section === "foodie" ? (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold">Foodie 案件媒合</h1>
                <p className="text-sm text-muted-foreground">
                  上架中案件 {active} 件・待審申請 {pending} 件
                </p>
              </div>
              <Button
                onClick={() => {
                  setEditing(null);
                  setOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" /> 上架媒合案件
              </Button>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {campaigns.length === 0 && (
                <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                  尚未上架任何案件，點擊「上架媒合案件」開始。
                </p>
              )}
              {campaigns.map((c) => {
                const apps = applications.filter((a) => a.campaign_id === c.id);
                return (
                  <Card key={c.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">{c.title}</CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge variant={c.status === "published" ? "default" : "secondary"}>
                            {c.status === "published" ? "上架中" : c.status === "draft" ? "草稿" : "已結束"}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditing(c);
                              setOpen(true);
                            }}
                          >
                            <Pencil className="mr-1 h-3.5 w-3.5" /> 編輯
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {c.region}・{c.collab_type}・粉絲門檻 {c.min_followers.toLocaleString()}・名額 {c.slots}
                        {c.deadline ? `・截止 ${c.deadline}` : ""}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {c.photos?.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto">
                          {c.photos.map((p) => (
                            <img
                              key={p}
                              src={p}
                              alt={`${c.title} 案件照片`}
                              loading="lazy"
                              className="h-20 w-28 shrink-0 rounded-md object-cover"
                            />
                          ))}
                        </div>
                      )}
                      <p className="text-sm">獎勵：{c.reward}</p>
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground">收到的申請（{apps.length}）</p>
                        {apps.length === 0 && <p className="text-xs text-muted-foreground">尚無申請</p>}
                        {apps.map((a) => {
                          const p = creators[a.creator_id];
                          return (
                            <div key={a.id} className="rounded-md border border-border p-3 text-sm">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium">
                                  {p?.display_name ?? "Foodie"}{" "}
                                  <span className="text-xs text-muted-foreground">
                                    {p?.instagram_handle ?? ""} ・粉絲 {(p?.follower_count ?? 0).toLocaleString()}
                                  </span>
                                </span>
                                <Badge
                                  variant={
                                    a.status === "approved"
                                      ? "default"
                                      : a.status === "rejected"
                                        ? "destructive"
                                        : "secondary"
                                  }
                                >
                                  {a.status === "approved" ? "已核准" : a.status === "rejected" ? "已拒絕" : "待審核"}
                                </Badge>
                              </div>
                              {a.message && <p className="mt-1 text-xs text-muted-foreground">{a.message}</p>}
                              {a.status === "pending" && (
                                <div className="mt-2 flex gap-2">
                                  <Button size="sm" onClick={() => decide(a.id, "approved")}>
                                    核准
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => decide(a.id, "rejected")}>
                                    拒絕
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        ) : section === "performance" ? (
          <PerformanceSection campaigns={campaigns} applications={applications} creators={creators} />
        ) : (
          <PlaceholderSection section={section} />
        )}
      </main>

      <CampaignDialog
        key={editing?.id ?? "new"}
        open={open}
        campaign={editing}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEditing(null);
        }}
        onSaved={() => void qc.invalidateQueries({ queryKey: ["merchant-campaigns", user?.id] })}
        userId={user?.id ?? ""}
      />
    </div>
  );
}

function PlaceholderSection({ section }: { section: MenuKey }) {
  const item = MENU.find((m) => m.key === section)!;
  const stats: Record<string, [string, string][]> = {
    overview: [
      ["今日營業額", "NT$ 38,420"],
      ["今日訂單", "126 筆"],
      ["客單價", "NT$ 305"],
      ["回頭客比例", "42%"],
    ],
    orders: [
      ["待出餐", "8 筆"],
      ["外送中", "3 筆"],
      ["今日完成", "115 筆"],
      ["取消", "2 筆"],
    ],
    menu: [
      ["上架品項", "68 項"],
      ["缺貨品項", "4 項"],
      ["本月新品", "6 項"],
      ["熱銷第一", "招牌牛肉麵"],
    ],
    members: [
      ["會員總數", "3,204"],
      ["本月新增", "148"],
      ["點數兌換", "312 次"],
      ["活躍會員", "1,027"],
    ],
    settings: [
      ["營業時間", "11:00 - 21:00"],
      ["分店數", "3 間"],
      ["付款方式", "5 種"],
      ["發票設定", "已啟用"],
    ],
  };
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">{item.label}</h1>
      <p className="mb-6 text-sm text-muted-foreground">此為肚肚原有後台功能示意畫面。</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(stats[section] ?? []).map(([k, v]) => (
          <Card key={k}>
            <CardHeader className="pb-2">
              <p className="text-xs text-muted-foreground">{k}</p>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{v}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PerformanceSection({
  campaigns,
  applications,
  creators,
}: {
  campaigns: Campaign[];
  applications: Application[];
  creators: Record<string, { display_name: string | null; instagram_handle: string | null; follower_count: number }>;
}) {
  const mine = applications.filter((a) => campaigns.some((c) => c.id === a.campaign_id));
  const approved = mine.filter((a) => a.status === "approved");
  const completed = mine.filter((a) => a.completed);
  const submitted = mine.filter((a) => a.submission_url);
  const reach = approved.reduce((s, a) => s + (creators[a.creator_id]?.follower_count ?? 0), 0);
  const totals: [string, string][] = [
    ["合作 Foodie 人數", `${new Set(approved.map((a) => a.creator_id)).size} 位`],
    ["預估總觸及粉絲", reach.toLocaleString()],
    ["已交付成果", `${submitted.length} 篇`],
    ["已完成合作", `${completed.length} 件`],
  ];

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">合作成效</h1>
      <p className="mb-6 text-sm text-muted-foreground">追蹤每個案件的申請、核准與 Foodie 交付成果。</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {totals.map(([k, v]) => (
          <Card key={k}>
            <CardHeader className="pb-2">
              <p className="text-xs text-muted-foreground">{k}</p>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{v}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 space-y-4">
        {campaigns.length === 0 && (
          <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">尚無案件成效資料。</p>
        )}
        {campaigns.map((c) => {
          const apps = mine.filter((a) => a.campaign_id === c.id);
          const ok = apps.filter((a) => a.status === "approved");
          const done = apps.filter((a) => a.completed);
          const cReach = ok.reduce((s, a) => s + (creators[a.creator_id]?.follower_count ?? 0), 0);
          return (
            <Card key={c.id}>
              <CardHeader>
                <CardTitle className="text-base">{c.title}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  申請 {apps.length}・核准 {ok.length}／名額 {c.slots}・完成 {done.length}・預估觸及{" "}
                  {cReach.toLocaleString()}
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {ok.length === 0 && <p className="text-xs text-muted-foreground">尚無核准的合作。</p>}
                {ok.map((a) => {
                  const p = creators[a.creator_id];
                  return (
                    <div
                      key={a.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm"
                    >
                      <span>
                        {p?.display_name ?? "Foodie"}{" "}
                        <span className="text-xs text-muted-foreground">
                          {p?.instagram_handle ?? ""}・粉絲 {(p?.follower_count ?? 0).toLocaleString()}
                        </span>
                      </span>
                      <div className="flex items-center gap-2">
                        {a.submission_url ? (
                          <a
                            href={a.submission_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-medium text-primary underline"
                          >
                            查看成果
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">尚未交付</span>
                        )}
                        <Badge variant={a.completed ? "default" : "secondary"}>{a.completed ? "已完成" : "進行中"}</Badge>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function CampaignDialog({
  open,
  onOpenChange,
  onSaved,
  userId,
  campaign,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  userId: string;
  campaign: Campaign | null;
}) {
  const [form, setForm] = useState({
    title: campaign?.title ?? "",
    restaurant_name: campaign?.restaurant_name ?? "",
    description: campaign?.description ?? "",
    region: campaign?.region ?? REGIONS[0]!,
    min_followers: campaign?.min_followers ?? 1000,
    collab_type: campaign?.collab_type ?? COLLAB_TYPES[0]!,
    reward: campaign?.reward ?? "",
    slots: campaign?.slots ?? 3,
    deadline: campaign?.deadline ?? "",
  });
  const [photos, setPhotos] = useState<string[]>(campaign?.photos ?? []);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  const uploadPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("campaign-photos").upload(path, file);
      if (error) {
        toast.error(`照片上傳失敗：${error.message}`);
        continue;
      }
      const { data } = await supabase.storage.from("campaign-photos").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      if (data?.signedUrl) urls.push(data.signedUrl);
    }
    setPhotos((prev) => [...prev, ...urls]);
    setUploading(false);
  };

  const save = async (status: "published" | "draft" | "closed") => {
    if (!form.title.trim()) {
      toast.error("請填寫案件標題");
      return;
    }
    if (!form.description.trim()) {
      toast.error("合作內容為必填，請說明合作需求");
      return;
    }
    setBusy(true);
    const payload = {
      title: form.title,
      restaurant_name: form.restaurant_name || null,
      description: form.description,
      region: form.region,
      min_followers: Number(form.min_followers),
      collab_type: form.collab_type,
      reward: form.reward,
      slots: Number(form.slots),
      deadline: form.deadline || null,
      photos,
      status,
    };
    const { error } = campaign
      ? await supabase.from("campaigns").update(payload).eq("id", campaign.id)
      : await supabase.from("campaigns").insert({ ...payload, merchant_id: userId });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(campaign ? "案件已更新" : status === "draft" ? "草稿已儲存" : "案件已上架");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{campaign ? "編輯媒合案件" : "上架 Foodie 媒合案件"}</DialogTitle>
          <DialogDescription>
            {campaign ? "上架後仍可隨時修改案件內容與照片。" : "填寫案件資訊，上架後 Foodie 即可在首頁看到並申請。"}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div className="space-y-1.5">
            <Label>案件標題</Label>
            <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>餐廳名稱</Label>
            <Input
              value={form.restaurant_name}
              onChange={(e) => setForm({ ...form, restaurant_name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>地區</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
              >
                {REGIONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>合作類型</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.collab_type}
                onChange={(e) => setForm({ ...form, collab_type: e.target.value })}
              >
                {COLLAB_TYPES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>粉絲門檻</Label>
              <Input
                type="number"
                min={0}
                value={form.min_followers}
                onChange={(e) => setForm({ ...form, min_followers: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>名額</Label>
              <Input
                type="number"
                min={1}
                value={form.slots}
                onChange={(e) => setForm({ ...form, slots: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>獎勵／回饋</Label>
            <Input
              required
              placeholder="例如：免費雙人套餐 + NT$1,000 稿費"
              value={form.reward}
              onChange={(e) => setForm({ ...form, reward: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>申請截止日</Label>
            <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>
              合作內容 <span className="text-destructive">*</span>
            </Label>
            <Textarea
              required
              rows={4}
              placeholder="說明合作內容、拍攝需求、到店時段等"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>案件照片</Label>
            <div className="flex flex-wrap gap-2">
              {photos.map((p) => (
                <div key={p} className="relative">
                  <img src={p} alt="案件照片" className="h-20 w-24 rounded-md object-cover" />
                  <button
                    type="button"
                    aria-label="移除照片"
                    onClick={() => setPhotos((prev) => prev.filter((x) => x !== p))}
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <label className="flex h-20 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-input text-xs text-muted-foreground hover:bg-accent">
                <ImagePlus className="h-4 w-4" />
                {uploading ? "上傳中…" : "新增照片"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    void uploadPhotos(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">可上傳多張餐點或店內照片，Foodie 會在案件卡片看到。</p>
          </div>

          <DialogFooter>
            {campaign ? (
              <>
                <Button type="button" variant="outline" disabled={busy || uploading} onClick={() => void save("closed")}>
                  下架案件
                </Button>
                <Button type="button" disabled={busy || uploading} onClick={() => void save(campaign.status === "closed" ? "published" : campaign.status)}>
                  儲存變更
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" disabled={busy || uploading} onClick={() => void save("draft")}>
                  儲存草稿
                </Button>
                <Button type="button" disabled={busy || uploading} onClick={() => void save("published")}>
                  上架案件
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
