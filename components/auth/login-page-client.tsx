"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  ArrowLeftRight,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/brand/logo";
import { useProfile } from "@/lib/profile";
import { PORTAL_LOGIN_EMAILS } from "@/lib/portal-accounts";

const ease = [0.22, 1, 0.36, 1] as const;

const fade = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay: i * 0.08, ease },
  }),
};

export function LoginPageClient() {
  const router = useRouter();
  const { profile, update, hydrated } = useProfile();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (hydrated && profile.name) setEmail((e) => e || guessEmail(profile.name));
  }, [hydrated, profile.name]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Informe e-mail e senha para continuar.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "E-mail ou senha incorretos.");
        setLoading(false);
        return;
      }
      const inferred = inferName(email.trim());
      if (inferred) update({ name: inferred });
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Não foi possível conectar. Tente novamente.");
      setLoading(false);
    }
  };

  const year = new Date().getFullYear();

  return (
    <main className="min-h-svh app-bg flex flex-col">
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="px-6 pt-6 flex items-center justify-between"
      >
        <div className="flex items-center gap-2.5">
          <Logo size={30} withGlow />
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">
              Portal executivo
            </div>
            <div className="text-[10px] text-muted-foreground -mt-0.5">
              Visão consolidada da operação
            </div>
          </div>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-muted-foreground rounded-full glass px-2.5 py-1">
          <ShieldCheck className="h-3 w-3" />
          Apenas e-mails cadastrados
        </span>
      </motion.header>

      <section className="flex-1 flex items-center justify-center px-4 py-10">
        <motion.div
          initial="hidden"
          animate="show"
          variants={fade}
          custom={0}
          className="w-full max-w-md"
        >
          <Card className="p-8 lg:p-10 relative overflow-hidden">
            <BackdropDeco />

            <motion.div
              variants={fade}
              custom={1}
              className="flex items-center justify-center mb-6"
            >
              <Logo size={56} withGlow />
            </motion.div>

            <motion.div variants={fade} custom={2} className="text-center space-y-1.5">
              <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
              <p className="text-xs text-muted-foreground">
                Acesso restrito ao time executivo
              </p>
            </motion.div>

            <motion.form
              variants={fade}
              custom={3}
              onSubmit={submit}
              className="mt-7 space-y-4"
            >
              <div className="space-y-1.5">
                <label className="text-[11px] text-muted-foreground">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ludymilla@portal.com"
                    className="pl-8 h-10"
                    autoComplete="email"
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] text-muted-foreground">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-8 h-10"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-[11px] text-rose-500"
                >
                  {error}
                </motion.div>
              )}

              <Button
                type="submit"
                className="w-full gap-2 mt-1 h-10"
                disabled={loading}
                size="lg"
              >
                {loading ? "Verificando…" : "Entrar"}
                <ArrowRight className="h-4 w-4" />
              </Button>

              <div className="space-y-2 pt-1 text-[11px] text-muted-foreground">
                <p>
                  Esqueceu a senha?{" "}
                  <span className="text-foreground">
                    Solicite à administradora do portal — não há recuperação automática por e-mail nesta versão.
                  </span>
                </p>
                <details className="text-left rounded-lg bg-foreground/[0.03] dark:bg-white/[0.03] px-3 py-2">
                  <summary className="cursor-pointer select-none text-foreground font-medium">
                    E-mails autorizados (equipe)
                  </summary>
                  <ul className="mt-2 space-y-0.5 list-disc pl-4">
                    {PORTAL_LOGIN_EMAILS.map((em) => (
                      <li key={em} className="tabular-nums">
                        {em}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 leading-relaxed">
                    A senha é a mesma para todos os logins acima (definida na implantação). Qualquer outro e-mail ou
                    senha é recusado.
                  </p>
                </details>
              </div>
            </motion.form>
          </Card>
        </motion.div>
      </section>

      <section className="px-6 pb-12">
        <div className="max-w-3xl mx-auto text-center space-y-5">
          <motion.h2
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.4 }}
            variants={fade}
            custom={0}
            className="text-2xl sm:text-3xl font-semibold tracking-tight leading-tight"
          >
            Decisões claras,{" "}
            <span className="bg-gradient-to-r from-[hsl(var(--brand-2))] to-[hsl(var(--brand-3))] bg-clip-text text-transparent">
              números na ponta dos dedos.
            </span>
          </motion.h2>

          <motion.p
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.4 }}
            variants={fade}
            custom={1}
            className="text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed"
          >
            Sua operação financeira, jurídica, contábil e de marketing reunida em uma
            única superfície minimalista. Importe relatórios, edite indicadores em
            tempo real e tenha um conselheiro de negócios sempre por perto.
          </motion.p>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.4 }}
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
            }}
            className="flex flex-wrap items-center justify-center gap-2 pt-1"
          >
            <Pill icon={<ArrowLeftRight className="h-3 w-3" />} label="Auto-conciliação bancária" />
            <Pill icon={<ShieldCheck className="h-3 w-3" />} label="Acesso por perfil" />
            <Pill icon={<MessageCircle className="h-3 w-3" />} label="Suporte executivo" />
            <Pill icon={<Sparkles className="h-3 w-3" />} label="Ingestão multimodal" />
          </motion.div>
        </div>
      </section>

      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.6, ease }}
        className="border-t border-border/50 mt-auto"
      >
        <div className="max-w-5xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <Logo size={16} />
            <span>
              © {year} Portal executivo. Todos os direitos reservados.
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-foreground transition-colors">
              Termos de uso
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              Política de privacidade
            </a>
            <span className="hidden sm:inline">v1.0 · RC</span>
          </div>
        </div>
      </motion.footer>
    </main>
  );
}

function BackdropDeco() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-20 h-56 w-56 rounded-full blur-3xl opacity-50"
        style={{
          background:
            "radial-gradient(closest-side, hsl(var(--brand-1) / 0.55), transparent)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full blur-3xl opacity-40"
        style={{
          background:
            "radial-gradient(closest-side, hsl(var(--brand-3) / 0.55), transparent)",
        }}
      />
    </>
  );
}

function Pill({ icon, label }: { icon?: React.ReactNode; label: string }) {
  return (
    <motion.span
      variants={{
        hidden: { opacity: 0, y: 8 },
        show: { opacity: 1, y: 0, transition: { duration: 0.4, ease } },
      }}
      className="inline-flex items-center gap-1.5 rounded-full glass px-2.5 py-1 text-[11px] text-muted-foreground"
    >
      {icon}
      {label}
    </motion.span>
  );
}

function guessEmail(name: string) {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
  return slug ? `${slug}@portal.com` : "";
}

function inferName(email: string): string | null {
  const local = email.split("@")[0];
  if (!local) return null;
  const cleaned = local.replace(/\d+/g, "").replace(/[._-]+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}
