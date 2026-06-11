import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "تسجيل الدخول — Oplus Pharma" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/customers" });
    });
  }, [navigate]);

  const signIn = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("تم تسجيل الدخول");
    navigate({ to: "/customers" });
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 bg-gradient-soft overflow-hidden">
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-[-10%] start-[-10%] h-[40rem] w-[40rem] rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute bottom-[-15%] end-[-10%] h-[36rem] w-[36rem] rounded-full bg-accent/25 blur-3xl" />
      </div>
      <Card className="w-full max-w-md border-border/60 shadow-elegant backdrop-blur-xl bg-background/80">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 h-14 w-14 rounded-2xl bg-gradient-brand shadow-elegant flex items-center justify-center">
            <span className="font-display text-xl font-bold text-primary-foreground">O+</span>
          </div>
          <CardTitle className="font-display text-2xl">Oplus Pharma</CardTitle>
          <CardDescription>سجّل الدخول للمتابعة</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" autoComplete="username" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" autoComplete="current-password" onKeyDown={(e) => { if (e.key === "Enter") signIn(); }} />
            </div>
            <Button className="w-full" disabled={loading} onClick={signIn}>
              {loading ? "..." : "دخول"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}