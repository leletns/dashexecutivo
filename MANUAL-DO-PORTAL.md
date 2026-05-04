# Manual do portal executivo

Este documento explica, em linguagem simples, como usar o painel do zero até a operação do dia a dia. Não é necessário conhecimento técnico de programação.

---

## 1. O que é este portal

É um painel web para a CEO acompanhar a operação da empresa de eventos: números consolidados, produção por edição, financeiro, e módulos de apoio (administrativo, contábil, jurídico, marketing). Os dados **não vêm de uma base fictícia**: o que você vê é o que foi **digitado, importado ou gravado neste navegador** até você conectar um sistema real (ERP, banco de dados, API) no futuro.

---

## 2. Como entrar

1. Abra o endereço do site (por exemplo, o que a equipe de TI configurou).
2. Na tela inicial, informe **somente** um dos e-mails autorizados e a **senha da implantação** (veja a lista abaixo).
3. Após o login, você verá o menu lateral (no computador) ou o menu “hambúrguer” (no celular).
4. Para **sair**, use o menu do seu nome (canto superior) e a opção de encerrar sessão — isso apaga o acesso até você entrar de novo.

### 2.1 E-mails e senha (nesta versão)

O sistema **não aceita** combinações fora da lista: qualquer outro e-mail ou senha errada mostra “E-mail ou senha incorretos” e não abre o painel.

| Perfil / área        | E-mail                      |
| -------------------- | --------------------------- |
| CEO / visão geral    | `ludymilla@portal.com`      |
| Jurídico             | `juridico@portal.com`       |
| Contábil             | `contabil@portal.com`       |
| Marketing            | `marketing@portal.com`      |
| Administrativo       | `administrativo@portal.com` |
| Financeiro           | `financeiro@portal.com`     |
| Produção de eventos  | `eventos@portal.com`        |

**Senha (a mesma para todos os e-mails acima):** `Usuario@2026`

Na tela de login também existe o bloco **“E-mails autorizados (equipe)”** — é a mesma lista, para consulta rápida.

**Esqueceu a senha?** Nesta versão não há “esqueci minha senha” por e-mail automático. Peça à administradora do portal para alterar a senha no sistema (arquivo de configuração / implantação) e informar a nova senha à equipe.

**Observação de segurança:** em ambiente corporativo sério, a senha deveria ficar só em variáveis de ambiente no servidor e ser trocada periodicamente; o que importa para o dia a dia é: **só quem tem um desses e-mails e a senha correta entra.**

---

## 3. Visão geral (`/dashboard`)

É a página principal com os quatro **indicadores grandes** (receita, despesa, lucro, ticket médio) e os gráficos.

### 3.1 Editar um número nos cards

- Clique no **valor** do card (ou no ícone de lápis ao passar o mouse).
- Digite o novo valor e confirme com **Enter** ou clique no **visto**.
- Os gráficos de tendência são recalculados a partir desses totais.

### 3.2 Importar planilha ou PDF

- Use a **zona de upload** na parte superior: arraste um arquivo ou clique para escolher.
- O sistema tenta extrair números (com apoio da API Claude, se estiver configurada).
- Se aparecer uma pré-visualização, confirme se deseja **atualizar o painel** ou cancelar.

### 3.3 Gráfico “Receita vs custo por categoria”

- Se estiver vazio, use **Adicionar categoria** (ou **Categoria**) e informe o nome (ex.: “Patrocínios”).
- Depois, clique nos valores da tabela para editar receita e custo.
- Os dados ficam salvos **no navegador** (chave interna: `portal.category-chart.v1`).

### 3.4 Gráfico “Receita por edição”

- Mostra a soma **ingressos + patrocínios** de cada edição cadastrada em **Produção de eventos**.
- Se não houver edições, aparece uma mensagem orientando a cadastrar.

### 3.5 Onde ficam salvos os números da visão geral

- Indicadores e série mensal: **navegador** (`portal.dashboard.v1`).
- Trocar de computador ou limpar dados do site zera esses valores, até você exportar ou integrar com backend.

---

## 4. Produção de eventos (`/eventos`)

É onde você cadastra cada **edição** do evento (1ª edição, 2ª edição, etc.) e acompanha lotes, ocupação e margem.

### 4.1 Nova edição

1. Clique em **Nova edição**.
2. Preencha nome, cidade, datas, capacidade, patrocínios contratados e custo de produção.
3. Salve. A edição aparece no seletor no topo e no menu lateral, em **Produção de eventos**.

### 4.2 Editar uma edição existente

- Escolha a edição no **seletor** ou abra pelo menu lateral (cada edição tem um link).
- Use **Editar** no cartão do evento para alterar dados gerais.
- Nos **lotes**, altere preço, vendidos e estoque (clique nos números).
- **Duplicar** cria uma cópia com novo código interno.
- **Excluir** remove a edição (lançamentos financeiros vinculados ficam **sem edição**).

### 4.3 O que é “margem do evento”

É uma visão simplificada: **receita total** (ingressos + patrocínios) **menos custo de produção** informado no cadastro. Ajuste o custo de produção para refletir a realidade da operação.

### 4.4 Dados salvos

- Edições e financeiro compartilhado: **navegador** (`portal.appstate.v2`).  
- Versão **v2** foi criada para não misturar com dados de demonstração antigos.

---

## 5. Financeiro (`/financeiro`)

Concentra fluxo de caixa, contas a pagar/receber e margem por evento.

### 5.1 Abas

| Aba | Função |
|-----|--------|
| **Visão geral** | Resumo, gráficos e próximos vencimentos em aberto. |
| **Fluxo de caixa** | Entradas e saídas **já pagas/recebidas** (data de pagamento preenchida), mês a mês. |
| **Contas a receber** | Recebimentos com vencimento; pode estar em aberto ou liquidado. |
| **Contas a pagar** | Pagamentos com vencimento; idem. |
| **Margem por evento** | Cruza receitas/despesas **vinculadas à edição** com custo de produção da edição. |

### 5.2 Novo lançamento

1. Na aba **Contas a receber** ou **Contas a pagar**, clique em **Novo recebimento** / **Novo pagamento**.
2. Preencha descrição, valor, categoria, vencimento e, se quiser, **data de pagamento** (se deixar em branco, fica em aberto).
3. Opcional: vincule a uma **edição** para alimentar a aba de margem.

### 5.3 Liquidar ou reabrir

- Use o ícone de **visto** na linha para marcar como pago/recebido (usa a data de hoje se ainda não houver data de pagamento).
- Use de novo para **reabrir** se marcou por engano.

### 5.4 Auto-conciliação bancária

- Abre um painel para cruzar **extrato do banco** com **lançamentos do sistema**.
- **Sem integração ativa**, as listas ficam vazias e o botão **Iniciar** permanece desabilitado — isso é esperado até o backend enviar os lançamentos.

---

## 6. Suporte executivo (botão flutuante de chat)

- Ícone de mensagem no canto inferior direito.
- Ele enxerga: módulo atual, resumo da página, indicadores da visão geral, **edições** e **financeiro** salvos.
- Pode responder perguntas gerais (inclusive “que dia é hoje?”) e sugerir ações.
- Se o assistente devolver um bloco de **ações** e você confirmar o fluxo, o painel pode ser atualizado automaticamente (conforme a implementação vigente).

### 6.1 Anexo de arquivo no chat

- Mesmo fluxo da visão geral: envia para interpretação e pode sugerir atualização dos cards.

---

## 7. Outros módulos (administrativo, contábil, jurídico, marketing)

Hoje funcionam como **telas de estrutura**: KPIs editáveis, tabelas e gráficos **começam vazios ou em zero**, prontos para você alimentar manualmente ou por integração futura.

- **Administrativo:** headcount, pizza de despesas e lista de atividades — vazios até dados reais.
- **Contábil:** certidões e gráfico de impostos vs folha — vazios até conexão com contabilidade.
- **Jurídico:** tabelas de contrato vazias; o formulário de “advogado” é apenas **simulação de tela** até existir login corporativo (SSO/MFA).
- **Marketing:** kanban de tarefas vazio; KPIs zerados até você preencher.

---

## 8. Perfil, tema e saída

- **Foto e nome:** clique no avatar no topo; dá para trocar foto, tema de cor (lilás / grafite) e **sair**.
- **Calculadora** e **tema claro/escuro** ficam na barra superior.

---

## 9. Integração com dados reais da empresa (visão de produto)

Ordem típica recomendada para a TI:

1. **Autenticação:** substituir login da landing por provedor real (OAuth, SAML, etc.).
2. **Backend:** API que leia/escreva as mesmas entidades (edições, lançamentos, indicadores).
3. **Substituir `localStorage`:** trocar `AppStateProvider` e `DashboardProvider` para buscar da API (mantendo a UI).
4. **Auto-conciliação:** endpoint que devolve extrato e lançamentos do ERP para o pareamento.
5. **Módulos administrativo/contábil/jurídico/marketing:** endpoints ou sincronização com ferramentas já usadas pela empresa.

Variáveis de ambiente relevantes hoje:

- `ANTHROPIC_API_KEY` — habilita interpretação inteligente de arquivos e respostas mais ricas no chat. **Sem a chave**, o import e o chat usam comportamento mínimo (sem inventar números no fallback de importação).

---

## 10. Limpar tudo e começar de novo (avançado)

No navegador, abra as ferramentas de desenvolvedor → **Aplicativo** / **Armazenamento** → **Armazenamento local** e remova as chaves:

- `portal.appstate.v2` — edições e financeiro.
- `portal.dashboard.v1` — visão geral.
- `portal.category-chart.v1` — categorias do gráfico.
- `portal.profile.v1` — nome, foto e tema do perfil (se quiser resetar também).

Depois, atualize a página (F5).

---

## 11. Glossário rápido

| Termo | Significado |
|-------|-------------|
| **Lote** | Tipo de ingresso (pista, VIP, etc.) com preço e quantidades. |
| **Liquidado / pago** | Lançamento com data de pagamento preenchida; entra no fluxo de caixa realizado. |
| **Em aberto** | Venceu ou vai vencer, mas ainda não há confirmação de pagamento/recebimento. |
| **Slug** | Código curto da edição na URL (ex.: `edicao-1`); gerado automaticamente ao criar edição. |

---

## 12. Quem pedir ajuda

- **Dúvidas de negócio e números:** use o **Suporte executivo** (chat).
- **Acesso, senha, ambiente de produção:** equipe de TI ou quem hospeda o site.

---

*Última atualização do manual: alinhada à versão do portal sem dados de demonstração — tudo parte de estado vazio ou zero até você ou a integração preencher.*
