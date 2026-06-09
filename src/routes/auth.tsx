import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { ensureDemoUser } from "@/lib/auth/demo.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "تسجيل الدخول — Oplus Pharma" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const ensureDemo = useServerFn(ensureDemoUser);

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

  const signUp = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("تم إنشاء الحساب — راجع بريدك لتأكيد البريد الإلكتروني.");
  };

  const quickDemoLogin = async () => {
    setLoading(true);
    try {
      const creds = await ensureDemo();
      const { error } = await supabase.auth.signInWithPassword({
        email: creds.email,
        password: creds.password,
      });
      if (error) throw error;
      toast.success("مرحباً بك في الحساب التجريبي");
      navigate({ to: "/customers" });
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر الدخول التجريبي");
    } finally {
      setLoading(false);
    }
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
          <CardDescription>سجّل الدخول أو أنشئ حسابًا للمتابعة</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="secondary"
            className="w-full mb-4"
            disabled={loading}
            onClick={quickDemoLogin}
          >
            🚀 {loading ? "جارٍ التحضير..." : "دخول سريع بحساب تجريبي"}
          </Button>
          <Tabs defaultValue="signin">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin">تسجيل الدخول</TabsTrigger>
              <TabsTrigger value="signup">حساب جديد</TabsTrigger>
            </TabsList>
            <div className="space-y-3 mt-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">كلمة المرور</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
              </div>
            </div>
            <TabsContent value="signin" className="mt-4">
              <Button className="w-full" disabled={loading} onClick={signIn}>
                {loading ? "..." : "دخول"}
              </Button>
            </TabsContent>
            <TabsContent value="signup" className="mt-4">
              <Button className="w-full" disabled={loading} onClick={signUp}>
                {loading ? "..." : "إنشاء حساب"}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}