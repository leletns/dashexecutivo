import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

const MESSAGES: Record<string, string> = {
  AccessDenied: "Este e-mail não está autorizado a usar o portal.",
  Configuration: "Não foi possível abrir a sessão. Volte à página inicial e tente entrar de novo.",
  Verification: "O link de acesso expirou. Entre novamente com e-mail e senha.",
  Default: "Não foi possível concluir o acesso. Tente outra vez.",
};

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const code = searchParams.error ?? "Default";
  const message = MESSAGES[code] ?? MESSAGES.Default;

  return (
    <main className="min-h-svh app-bg flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="flex justify-center">
          <Logo size={48} withGlow />
        </div>
        <div className="space-y-2">
          <h1 className="text-lg font-semibold tracking-tight">Tente novamente</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
        </div>
        <Button asChild className="w-full">
          <Link href="/">Voltar ao início</Link>
        </Button>
      </div>
    </main>
  );
}
