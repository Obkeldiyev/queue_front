import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useAuthStore, getUserFromStorage } from "@/lib/auth-store";
import { useLang, LANGS } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";
import { Shield, Users, Cpu } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign In — Qubit QMS" }] }),
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("qms_access_token");
    const user = getUserFromStorage();
    if (token && user) {
      if (user.type === "platform_user") throw redirect({ to: "/app/companies" as any });
      const isOp = user.roleTypes?.includes("OPERATOR") || user.roles?.includes("Operator");
      throw redirect({ to: (isOp ? "/operator" : "/app") as any });
    }
  },
  component: LoginPage,
});

type LoginTab = "company" | "superadmin";

function LoginPage() {
  const navigate = useNavigate();
  const { t, lang, setLang } = useLang();
  const { isLoading, platformLogin, companyLogin } = useAuthStore();

  const [tab, setTab] = useState<LoginTab>("company");
  const [form, setForm] = useState({ email: "", password: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (tab === "superadmin") {
        await platformLogin(form.email, form.password);
        void navigate({ to: "/app/companies" as any });
      } else {
        await companyLogin(form.email, form.password);
        const nextUser = useAuthStore.getState().user;
        const isOperator =
          nextUser?.type === "company_user" &&
          (nextUser.roleTypes?.includes("OPERATOR") || nextUser.roles?.includes("Operator"));
        void navigate({ to: (isOperator ? "/operator" : "/app") as any });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("invalidCreds"));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4">

      {/* Language switcher */}
      <div className="absolute right-4 top-4 flex gap-1">
        {LANGS.map((l) => (
          <button
            key={l.code}
            onClick={() => setLang(l.code)}
            suppressHydrationWarning
            className={`rounded-md px-2.5 py-1 text-sm font-medium transition ${
              lang === l.code
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {l.flag} {l.code.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-2xl font-black text-primary-foreground shadow-lg">
            Q
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Qubit QMS</h1>
          <p className="mt-1 text-sm text-muted-foreground">Queue Management Platform</p>
        </div>

        {/* Tab selector — 2 tabs */}
        <div className="mb-5 grid grid-cols-2 gap-2">
          <button
            onClick={() => setTab("company")}
            className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-4 text-sm font-medium transition ${
              tab === "company"
                ? "border-primary bg-primary/5 text-primary"
                : "border-border text-muted-foreground hover:border-primary/30"
            }`}
          >
            <Users className="h-5 w-5" />
            <span suppressHydrationWarning>
              {lang === "uz" ? "Xodim / Admin" : lang === "ru" ? "Сотрудник / Админ" : "Employee / Admin"}
            </span>
            <span className="text-xs font-normal opacity-60 text-center" suppressHydrationWarning>
              {lang === "uz" ? "Operator ham shu yerdan" : lang === "ru" ? "Операторы тоже здесь" : "Operators too"}
            </span>
          </button>

          <button
            onClick={() => setTab("superadmin")}
            className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-4 text-sm font-medium transition ${
              tab === "superadmin"
                ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                : "border-border text-muted-foreground hover:border-amber-300"
            }`}
          >
            <Shield className="h-5 w-5" />
            <span suppressHydrationWarning>
              {lang === "uz" ? "Super Admin" : lang === "ru" ? "Супер Админ" : "Super Admin"}
            </span>
            <span className="text-xs font-normal opacity-60" suppressHydrationWarning>
              {lang === "uz" ? "Platforma" : lang === "ru" ? "Платформа" : "Platform"}
            </span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
          {/* Context badge */}
          <div
            suppressHydrationWarning
            className={`rounded-lg px-3 py-2 text-xs font-medium ${
              tab === "superadmin"
                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                : "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
            }`}
          >
            {tab === "superadmin"
              ? (lang === "uz" ? "⭐ Platforma boshqaruvi" : lang === "ru" ? "⭐ Управление платформой" : "⭐ Platform management")
              : (lang === "uz" ? "🏢 Xodim / Admin kirishi" : lang === "ru" ? "🏢 Вход сотрудника / Админа" : "🏢 Employee / Admin login")}
          </div>

          <div className="space-y-1.5">
            <Label suppressHydrationWarning>{t("email")}</Label>
            <Input
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <Label suppressHydrationWarning>{t("password")}</Label>
            <Input
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>

          <Button
            type="submit"
            suppressHydrationWarning
            className={`w-full ${
              tab === "superadmin" ? "bg-amber-600 hover:bg-amber-700 text-white" : ""
            }`}
            disabled={isLoading}
          >
            {isLoading ? t("signing") : t("signIn")}
          </Button>

          {tab === "company" && (
            <p className="text-center text-xs text-muted-foreground">
              {lang === "uz"
                ? "Operatorlar ham shu yerdan kiradi"
                : lang === "ru"
                ? "Операторы тоже входят здесь"
                : "Operators also log in here"}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
