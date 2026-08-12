import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordStrength } from "@/components/PasswordStrength";
import { passwordScore } from "@/lib/regions";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "重設密碼｜肚肚 Foodie 媒合專區" },
      { name: "description", content: "透過信箱連結重新設定你的肚肚帳號密碼。" },
      { property: "og:title", content: "重設密碼｜肚肚 Foodie 媒合專區" },
      { property: "og:description", content: "重新設定你的肚肚帳號密碼。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const { strong } = passwordScore(password);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!strong) {
      toast.error("密碼強度不足");
      return;
    }
    if (password !== confirm) {
      toast.error("兩次輸入的密碼不一致");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("密碼已更新，請重新登入");
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { role: undefined, redirect: undefined } });
  };

  return (
    <div className="min-h-screen bg-muted/40">
      <SiteHeader />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>設定新密碼</CardTitle>
            <CardDescription>請從信件連結進入本頁後設定新密碼</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submit}>
              <div className="space-y-1.5">
                <Label htmlFor="np">新密碼</Label>
                <Input id="np" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                <PasswordStrength password={password} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp">確認新密碼</Label>
                <Input id="cp" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                更新密碼
              </Button>
            </form>
          </CardContent>
        </Card>
        <Link to="/" className="text-center text-sm text-muted-foreground hover:text-primary">
          回到首頁
        </Link>
      </main>
    </div>
  );
}
