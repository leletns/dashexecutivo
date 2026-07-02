import type { Metadata } from "next";
import { NotificationsFeed } from "@/components/notificacoes/notifications-feed";

export const metadata: Metadata = {
  title: "Notificações",
  description: "Histórico de alterações feitas por cada usuário no painel.",
};

export default function NotificacoesPage() {
  return (
    <div className="space-y-6 pb-16">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground/60">
          Atividade
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Notificações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tudo o que cada pessoa criou, editou ou excluiu no painel — em ordem, fácil de acompanhar.
        </p>
      </header>
      <NotificationsFeed />
    </div>
  );
}
