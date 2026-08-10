import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { REGIONS } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Search = { role: "merchant" | "creator" | undefined; redirect: string | undefined };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    role: search['role'] === "merchant" ? "merchant" : search['role'] === "creator" ? "creator" : undefined,
    redirect: typeof search['redirect'] === "string" ? search['redirect'] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "登入 / 註冊 | 肚肚 Foodie 媒合專區" },
      { name: "description", content: "餐廳與 Foodie 登入或註冊，開始媒合美食業配合作。" },
      { property: "og:title", content: "登入 / 註冊 | 肚肚 Foodie 媒合專區" },
      { property: "og:description", content: "餐廳與 Foodie 登入或註冊，開始媒合美食業配合作。" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { role, redirect } = Route.useSearch();
  const navigate = useNavigate();
  const selectedRole = role ?? "creator";

  const [tab, setTab] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState<string>(REGIONS[0] ?? "台北市");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: redirect ?? "/", replace: true });
    });
  }, [navigate, redirect]);

  const go = () =>
    navigate({ to: redirect ?? (selectedRole === "merchant" ? "/merchant" : "/my-applications") });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("登入成功");
    go();
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          role: "merchant",
          display_name: displayName,
          restaurant_name: restaurantName,
          region,
        },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data.session?.user) {
      await supabase.from("merchant_profiles").insert({
        user_id: data.session.user.id,
        store_name: restaurantName,
        region,
        contact_name: displayName,
        phone: phone || null,
        email,
      });
    }
    if (!data.session) {
      toast.success("註冊成功，請至信箱點擊確認信後登入");
      setTab("login");
      return;
    }
    toast.success("註冊成功");
    go();
  };

  return (
    <div className="min-h-screen bg-muted/40">
      <SiteHeader />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-12">
        <h1 className="text-center text-2xl font-bold">
          {selectedRole === "merchant" ? "商家登入 / 註冊" : "Foodie 登入 / 註冊"}
        </h1>
        <Card>
          <CardHeader>
            <CardTitle>歡迎回來</CardTitle>
            <CardDescription>登入後即可申請案件或管理你的案件</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">登入</TabsTrigger>
                <TabsTrigger value="signup">註冊</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form className="space-y-4 pt-4" onSubmit={handleLogin}>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">電子郵件</Label>
                    <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password">密碼</Label>
                    <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    登入
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                {selectedRole !== "merchant" ? (
                  <div className="space-y-4 pt-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      Foodie 創作者註冊採三步驟表單，需填寫社群數據與內容偏好，以便為你媒合最適合的案件。
                    </p>
                    <Button asChild className="w-full">
                      <Link to="/foodie-signup">前往 Foodie 註冊</Link>
                    </Button>
                  </div>
                ) : (
                <form className="space-y-4 pt-4" onSubmit={handleSignup}>
                  <div className="space-y-1.5">
                    <Label htmlFor="name">聯絡人姓名</Label>
                    <Input id="name" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rest">餐廳名稱</Label>
                    <Input id="rest" required value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">聯絡電話</Label>
                    <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="region">所在地區</Label>
                    <select
                      id="region"
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                    >
                      {REGIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email2">電子郵件</Label>
                    <Input id="email2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password2">密碼</Label>
                    <Input id="password2" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    建立帳號
                  </Button>
                </form>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        <Link to="/" className="text-center text-sm text-muted-foreground hover:text-primary">
          回到首頁
        </Link>
      </main>
    </div>
  );
}