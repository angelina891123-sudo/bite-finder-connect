import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// 檔名的 "console_" 後綴讓這頁跳出 /console 的版面與登入檢查，
// 但網址仍然是 /console/login，避免登入頁被自己的守衛擋住而形成無限轉址。
export const Route = createFileRoute("/console_/login")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search["redirect"] === "string" ? search["redirect"] : undefined,
  }),
  head: () => ({
    meta: [{ title: "登入｜營運後台" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: ConsoleLogin,
});

function ConsoleLogin() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError || !data.user) {
      setError(signInError?.message ?? "登入失敗");
      setBusy(false);
      return;
    }

    // 登入成功不代表有權限：必須具備 admin 角色，否則立刻登出。
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");

    if (!isAdmin) {
      await supabase.auth.signOut();
      setError("此帳號沒有營運後台權限。");
      setBusy(false);
      return;
    }

    void navigate({ to: redirect ?? "/console", replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FDF7F0] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-[#FF8300]">營運後台</h1>
          <p className="mt-1 text-sm text-[#A08E7C]">Foodie 媒合平台 · 第三方管理系統</p>
        </div>

        <form
          onSubmit={submit}
          className="space-y-4 rounded-xl border border-[#EFE3D6] bg-white p-6 shadow-sm"
        >
          <div className="space-y-2">
            <Label htmlFor="console-email" className="text-[#5C4630]">
              帳號
            </Label>
            <Input
              id="console-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-[#EFE3D6] bg-white text-[#3F2E1E] placeholder:text-[#C4B5A6]"
              placeholder="admin@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="console-password" className="text-[#5C4630]">
              密碼
            </Label>
            <Input
              id="console-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-[#EFE3D6] bg-white text-[#3F2E1E]"
            />
          </div>

          {error && (
            <p
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              role="alert"
            >
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full bg-[#FF8300] text-white hover:bg-[#E67600]"
            disabled={busy}
          >
            {busy ? "登入中…" : "登入"}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-[#A08E7C]">僅限平台管理員使用</p>
      </div>
    </div>
  );
}
