"use client";
import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  LayoutDashboard,
  ClipboardList,
  FileCheck2,
  Building2,
  Users,
  Layers,
  FolderArchive,
  History,
  Settings,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Search,
  Menu,
  X,
  LogOut,
  ChevronRight,
  LockKeyhole,
  AlertTriangle,
  Check,
  Clock3,
  HardHat,
  Activity,
  Info,
} from "lucide-react";
type Tab =
  | "overview"
  | "apr"
  | "pt"
  | "units"
  | "members"
  | "models"
  | "documents"
  | "audit"
  | "account"
  | "companies";
type Member = {
  tenantId: string;
  name: string;
  role: string;
  permissions: string[];
};
type Me = {
  userId: string;
  name: string;
  mfa: boolean;
  csrf: string;
  platformOperator: boolean;
  memberships: Member[];
};
type Unit = { id: string; name: string; version: number };
type User = {
  id: string;
  displayName: string;
  role: string;
  active: boolean;
  version: number;
  allUnits: boolean;
};
type Audit = {
  id: string;
  action: string;
  resource: string;
  createdAt: string;
  actor: string;
};
type Company = { id: string; name: string; legalName: string; cnpj: string };
const roleNames: Record<string, string> = {
  COMPANY_ADMIN: "Administrador da empresa",
  SST: "Profissional de SST",
  SUPERVISOR: "Supervisor",
  EXECUTOR: "Executante",
  AUDITOR: "Auditor",
};
const items: { id: Tab; label: string; icon: typeof ShieldCheck }[] = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard },
  { id: "apr", label: "Análises de risco", icon: ClipboardList },
  { id: "pt", label: "Permissões de trabalho", icon: FileCheck2 },
  { id: "units", label: "Unidades", icon: Building2 },
  { id: "members", label: "Pessoas e acessos", icon: Users },
  { id: "models", label: "Modelos por atividade", icon: Layers },
  { id: "documents", label: "Documentos", icon: FolderArchive },
  { id: "audit", label: "Trilha de auditoria", icon: History },
  { id: "account", label: "Minha conta", icon: Settings },
];
const activities = [
  "Trabalho em altura",
  "Espaço confinado",
  "Serviços elétricos",
  "Trabalho a quente",
  "Manutenção de máquinas",
  "Serviços em telhados",
  "Produtos químicos",
  "Içamento de cargas",
  "Obras e manutenção industrial",
];
const demoRows = [
  {
    id: "PT-DEMO-0042",
    name: "Manutenção de cobertura",
    activity: "Trabalho em altura",
    unit: "Unidade Norte",
    status: "Em análise",
    team: "Equipe fictícia A",
  },
  {
    id: "PT-DEMO-0041",
    name: "Inspeção de painel elétrico",
    activity: "Serviços elétricos",
    unit: "Unidade Norte",
    status: "Aguardando correção",
    team: "Equipe fictícia B",
  },
  {
    id: "PET-DEMO-0008",
    name: "Inspeção interna de tanque",
    activity: "Espaço confinado",
    unit: "Unidade Sul",
    status: "Rascunho",
    team: "Equipe fictícia C",
  },
];
async function request<T>(
  path: string,
  csrf?: string,
  body?: unknown,
  method = "GET",
): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      ...(body !== undefined
        ? { "Content-Type": "application/json", "X-CSRF-Token": csrf ?? "" }
        : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      data.message ?? `Falha de comunicação (${response.status})`,
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export function Workspace({
  demo = false,
  commercial = false,
}: {
  demo?: boolean;
  commercial?: boolean;
}) {
  const [tab, setTab] = useState<Tab>(commercial ? "companies" : "overview"),
    [mobile, setMobile] = useState(false),
    [me, setMe] = useState<Me | null>(null),
    [tenant, setTenant] = useState(""),
    [units, setUnits] = useState<Unit[]>([]),
    [users, setUsers] = useState<User[]>([]),
    [audit, setAudit] = useState<Audit[]>([]),
    [companies, setCompanies] = useState<Company[]>([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(!demo),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState(""),
    [modal, setModal] = useState<"unit" | "member" | "company" | null>(null),
    [selected, setSelected] = useState<(typeof demoRows)[number] | null>(null);
  const current = me?.memberships.find((m) => m.tenantId === tenant);
  const allowed = (permission: string) =>
    !demo && !!current?.permissions.includes(permission);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusables = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input,select,textarea,a[href]",
        ) ?? [],
      );
    focusables()
      .find((el) => el.tagName === "INPUT")
      ?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModal(null);
        return;
      }
      if (e.key !== "Tab") return;
      const elements = focusables();
      const first = elements[0],
        last = elements.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.removeEventListener("keydown", handle);
      previous?.focus();
    };
  }, [modal]);
  useEffect(() => {
    if (demo) return;
    request<Me>("/v1/me")
      .then((data) => {
        setMe(data);
        setTenant(data.memberships[0]?.tenantId ?? "");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [demo]);
  async function refresh() {
    if (demo || !me) return;
    if (commercial) {
      setCompanies(await request("/v1/platform/tenants"));
      return;
    }
    if (!tenant) return;
    const next = await request<Unit[]>(`/v1/tenants/${tenant}/units`);
    setUnits(next);
    if (tab === "members")
      setUsers(await request(`/v1/tenants/${tenant}/members`));
    if (tab === "audit") setAudit(await request(`/v1/tenants/${tenant}/audit`));
  }
  useEffect(() => {
    let active = true;
    if (demo || !me) return;
    setError("");
    setUnits([]);
    setUsers([]);
    setAudit([]);
    setCompanies([]);
    setLoading(true);
    const tasks: Promise<unknown>[] = [];
    if (commercial)
      tasks.push(
        request<Company[]>("/v1/platform/tenants").then((x) => {
          if (active) setCompanies(x);
        }),
      );
    else if (tenant) {
      tasks.push(
        request<Unit[]>(`/v1/tenants/${tenant}/units`).then((x) => {
          if (active) setUnits(x);
        }),
      );
      if (tab === "members")
        tasks.push(
          request<User[]>(`/v1/tenants/${tenant}/members`).then((x) => {
            if (active) setUsers(x);
          }),
        );
      if (tab === "audit")
        tasks.push(
          request<Audit[]>(`/v1/tenants/${tenant}/audit`).then((x) => {
            if (active) setAudit(x);
          }),
        );
    }
    Promise.all(tasks)
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tenant, tab, me, demo, commercial]);
  function navigate(next: Tab) {
    setTab(next);
    setQuery("");
    setNotice("");
    setSelected(null);
    setMobile(false);
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!me) return;
    const values = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      if (modal === "unit")
        await request(
          `/v1/tenants/${tenant}/units`,
          me.csrf,
          { name: values.get("name") },
          "POST",
        );
      if (modal === "member") {
        const role = String(values.get("role")),
          allUnits = values.get("scope") === "all";
        await request(
          `/v1/tenants/${tenant}/members`,
          me.csrf,
          {
            userId: values.get("userId"),
            displayName: values.get("displayName"),
            role,
            allUnits,
            unitIds: allUnits ? [] : [values.get("unitId")],
          },
          "POST",
        );
      }
      if (modal === "company")
        await request(
          "/v1/platform/tenants",
          me.csrf,
          Object.fromEntries(values),
          "POST",
        );
      setModal(null);
      setNotice("Cadastro salvo.");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function toggle(u: User) {
    if (!me) return;
    setBusy(true);
    setError("");
    try {
      await request(
        `/v1/tenants/${tenant}/members/${u.id}`,
        me.csrf,
        { active: !u.active, version: u.version },
        "PATCH",
      );
      await refresh();
      setNotice("Vínculo atualizado.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function rename(e: FormEvent<HTMLFormElement>, u: Unit) {
    e.preventDefault();
    if (!me) return;
    const name = new FormData(e.currentTarget).get("name");
    setBusy(true);
    setError("");
    try {
      await request(
        `/v1/tenants/${tenant}/units/${u.id}`,
        me.csrf,
        { name, version: u.version },
        "PATCH",
      );
      await refresh();
      setNotice("Unidade atualizada.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const title = commercial
    ? "Empresas clientes"
    : items.find((i) => i.id === tab)?.label;
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <Link className="brand" href="/">
          <ShieldCheck size={30} />
          <strong>
            vigia<span>segurança operacional</span>
          </strong>
        </Link>
        <button
          className="mobile-close icon-button"
          aria-label="Fechar menu"
          onClick={() => setMobile(false)}
        >
          <X />
        </button>
        <div className="workspace-label">
          {commercial ? "ADMINISTRAÇÃO COMERCIAL" : "AMBIENTE DA EMPRESA"}
        </div>
        <nav aria-label="Navegação principal">
          {(commercial
            ? [
                {
                  id: "companies" as Tab,
                  label: "Empresas clientes",
                  icon: Building2,
                },
                { id: "account" as Tab, label: "Minha conta", icon: Settings },
              ]
            : items
          ).map((i) => (
            <button
              key={i.id}
              aria-current={tab === i.id ? "page" : undefined}
              className={tab === i.id ? "nav-item active" : "nav-item"}
              onClick={() => navigate(i.id)}
            >
              <i.icon size={19} />
              {i.label}
              {tab === i.id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="safety-note">
            <ShieldCheck size={21} />
            <strong>A segurança vem primeiro.</strong>
            <p>Cada decisão importa. Cada pessoa também.</p>
          </div>
          <Link className="sidebar-link" href={demo ? "/" : "/demonstracao"}>
            {demo ? "Voltar ao início" : "Explorar demonstração"}
            <ArrowUpRight size={16} />
          </Link>
          <div className="phase-label">FUNDAÇÃO · VERSÃO 0.1</div>
        </div>
      </aside>
      {mobile && (
        <button
          className="backdrop"
          aria-label="Fechar navegação"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <button
            className="mobile-toggle icon-button"
            aria-label="Abrir menu"
            onClick={() => setMobile(true)}
          >
            <Menu />
          </button>
          <div className="tenant-select">
            <Building2 size={19} />
            {demo ? (
              <span>
                Alfa Industrial <small>Empresa fictícia</small>
              </span>
            ) : commercial ? (
              <span>
                Gestão da plataforma<small>Acesso comercial</small>
              </span>
            ) : (
              <label>
                <span className="sr-only">Empresa ativa</span>
                <select
                  value={tenant}
                  onChange={(e) => {
                    setTenant(e.target.value);
                    setModal(null);
                  }}
                  disabled={!me?.memberships.length}
                >
                  <option value="" disabled>
                    Selecione uma empresa
                  </option>
                  {me?.memberships.map((m) => (
                    <option key={m.tenantId} value={m.tenantId}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <small>
                  {current ? roleNames[current.role] : "Acesso autenticado"}
                </small>
              </label>
            )}
          </div>
          <div className="topbar-right">
            <span className={`mode-badge ${demo ? "demo" : ""}`}>
              <span />
              {demo ? "Demonstração" : "Fase 1"}
            </span>
            <button
              className="avatar"
              onClick={() => navigate("account")}
              aria-label="Minha conta"
            >
              {demo ? "AF" : (me?.name.slice(0, 2).toUpperCase() ?? "—")}
            </button>
          </div>
        </header>
        <main id="conteudo" className="content">
          <div className="breadcrumb">
            {commercial ? "Plataforma" : "Área de trabalho"}
            <ChevronRight size={14} />
            <span>{title}</span>
          </div>
          {demo && (
            <div className="demo-banner">
              <Info size={18} />
              <span>
                <strong>Demonstração navegável.</strong> Dados fictícios.
                Nenhuma atividade está autorizada por estas telas.
              </span>
              <a href="/auth/login">
                Entrar <ArrowRight size={15} />
              </a>
            </div>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {commercial
                  ? "GESTÃO COMERCIAL"
                  : tab === "overview"
                    ? "SEGURANÇA OPERACIONAL"
                    : "ORGANIZAÇÃO & CONTROLE"}
              </div>
              <h1>{title}</h1>
              <p>
                {tab === "overview"
                  ? "Uma visão clara para cuidar de cada etapa da operação."
                  : tab === "units"
                    ? "Organize os locais de trabalho da sua empresa."
                    : tab === "members"
                      ? "As pessoas certas, com o acesso necessário."
                      : commercial
                        ? "Gerencie cadastros sem acessar documentos confidenciais."
                        : "Informação organizada para decisões responsáveis."}
              </p>
            </div>
            {tab === "overview" && (
              <button
                className="button primary"
                onClick={() => navigate("apr")}
              >
                <Plus size={18} />
                Conhecer o fluxo de APR
              </button>
            )}
            {tab === "units" && allowed("unit:write") && (
              <button
                className="button primary"
                onClick={() => setModal("unit")}
              >
                <Plus size={18} />
                Nova unidade
              </button>
            )}
            {tab === "members" && allowed("member:write") && (
              <button
                className="button primary"
                onClick={() => setModal("member")}
              >
                <Plus size={18} />
                Vincular usuário
              </button>
            )}
            {commercial && tab === "companies" && me?.platformOperator && (
              <button
                className="button primary"
                onClick={() => setModal("company")}
              >
                <Plus size={18} />
                Cadastrar empresa
              </button>
            )}
          </div>
          {error && (
            <div role="alert" className="error">
              <AlertTriangle size={20} />
              <span>{error}</span>
              <button
                onClick={() => {
                  setError("");
                  refresh().catch((e) => setError(e.message));
                }}
              >
                Tentar novamente
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="success">
              <Check size={18} />
              {notice}
            </div>
          )}
          {loading ? (
            <div role="status" className="empty">
              Carregando informações…
            </div>
          ) : !demo && !me ? (
            <div className="empty card">
              <LockKeyhole />
              <h2>Entre para acessar sua empresa</h2>
              <p>
                Sua sessão pode ter expirado ou o serviço estar indisponível.
              </p>
              <a className="button primary" href="/auth/login">
                Entrar com segurança
              </a>
            </div>
          ) : !demo && !commercial && !tenant ? (
            <div className="empty card">
              <Users />
              <h2>Sua conta ainda não tem vínculo com uma empresa</h2>
              <p>
                Envie seu identificador ao administrador para receber acesso.
              </p>
              <code className="identity">{me?.userId}</code>
              {me?.platformOperator && (
                <Link href="/comercial" className="button primary">
                  Abrir painel comercial
                </Link>
              )}
            </div>
          ) : (
            <>
              {tab === "overview" && (
                <>
                  <div className="stats">
                    <Stat
                      icon={FileCheck2}
                      label="Permissões abertas"
                      value={demo ? "03" : "—"}
                      detail={
                        demo ? "Exemplos em preparação" : "Disponível na Fase 3"
                      }
                    />
                    <Stat
                      icon={Clock3}
                      label="Aguardando análise"
                      value={demo ? "01" : "—"}
                      detail={
                        demo
                          ? "Revisão humana necessária"
                          : "Disponível na Fase 3"
                      }
                      tone="amber"
                    />
                    <Stat
                      icon={AlertTriangle}
                      label="Pendências de segurança"
                      value={demo ? "01" : "—"}
                      detail={
                        demo
                          ? "Exemplo de correção solicitada"
                          : "Disponível na Fase 3"
                      }
                      tone="red"
                    />
                    <Stat
                      icon={Building2}
                      label="Unidades no seu escopo"
                      value={
                        demo ? "02" : String(units.length).padStart(2, "0")
                      }
                      detail="Locais de trabalho"
                      tone="blue"
                    />
                  </div>
                  <div className="dashboard-grid">
                    <section className="card">
                      <div className="section-heading">
                        <div>
                          <h2>Atividades em acompanhamento</h2>
                          <p>
                            {demo
                              ? "Exemplos de etapas anteriores à liberação."
                              : "As permissões da empresa serão acompanhadas aqui."}
                          </p>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => navigate("pt")}
                        >
                          Ver permissões <ArrowRight size={16} />
                        </button>
                      </div>
                      {demo ? (
                        <ActivityTable
                          rows={demoRows}
                          onSelect={(row) => {
                            navigate("pt");
                            setSelected(row);
                          }}
                        />
                      ) : (
                        <div className="empty">
                          <ClipboardList size={32} />
                          <h3>Preparando uma operação mais segura</h3>
                          <p>
                            Comece cadastrando as unidades e vinculando os
                            usuários. A emissão de permissões será entregue na
                            Fase 3.
                          </p>
                          <button
                            className="button secondary"
                            onClick={() => navigate("units")}
                          >
                            Gerenciar unidades
                          </button>
                        </div>
                      )}
                    </section>
                    <aside className="card readiness">
                      <div className="icon-tile">
                        <ShieldCheck />
                      </div>
                      <span className="eyebrow">ANTES DE COMEÇAR</span>
                      <h2>
                        Uma base segura
                        <br />
                        para cada atividade.
                      </h2>
                      <p>
                        A liberação depende de análise, condições verificadas e
                        responsáveis autorizados.
                      </p>
                      <ol>
                        <li>
                          <span>1</span>Organize unidades e acessos
                        </li>
                        <li>
                          <span>2</span>Revise os riscos da atividade
                        </li>
                        <li>
                          <span>3</span>Verifique as condições em campo
                        </li>
                        <li>
                          <span>4</span>Obtenha a autorização responsável
                        </li>
                      </ol>
                      <div className="readiness-foot">
                        <LockKeyhole size={16} /> Sem liberação automática
                      </div>
                    </aside>
                  </div>
                  <section className="card">
                    <div className="section-heading">
                      <div>
                        <h2>Atividades que merecem atenção</h2>
                        <p>
                          Modelos específicos para riscos e contextos
                          diferentes.
                        </p>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => navigate("models")}
                      >
                        Explorar modelos <ArrowRight size={16} />
                      </button>
                    </div>
                    <div className="activity-cards">
                      {activities.slice(0, 4).map((a, i) => (
                        <button key={a} onClick={() => navigate("models")}>
                          <span className="activity-number">0{i + 1}</span>
                          <strong>{a}</strong>
                          <span>
                            Modelo em planejamento <ArrowUpRight size={15} />
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                </>
              )}
              {tab === "units" && (
                <section className="card">
                  <div className="section-heading">
                    <h2>Unidades operacionais</h2>
                    <span className="subtle">
                      {demo ? 2 : units.length} no seu escopo
                    </span>
                  </div>
                  <SearchBox value={query} onChange={setQuery} />
                  <div className="unit-list">
                    {(demo
                      ? [
                          {
                            id: "demo-norte",
                            name: "Unidade Norte",
                            version: 1,
                          },
                          { id: "demo-sul", name: "Unidade Sul", version: 1 },
                        ]
                      : units
                    )
                      .filter((u) =>
                        u.name.toLowerCase().includes(query.toLowerCase()),
                      )
                      .map((u) => (
                        <article className="unit-row" key={u.id}>
                          <div className="icon-tile">
                            <Building2 />
                          </div>
                          <div>
                            <h3>{u.name}</h3>
                            <small>
                              {demo
                                ? "Cadastro fictício"
                                : `Versão ${u.version}`}
                            </small>
                          </div>
                          {allowed("unit:write") && (
                            <details>
                              <summary>Renomear</summary>
                              <form
                                className="stack-form inline-form"
                                onSubmit={(e) => rename(e, u)}
                              >
                                <label>
                                  Novo nome
                                  <input
                                    name="name"
                                    defaultValue={u.name}
                                    minLength={2}
                                    maxLength={120}
                                    required
                                  />
                                </label>
                                <button
                                  className="button secondary"
                                  disabled={busy}
                                >
                                  Salvar alteração
                                </button>
                              </form>
                            </details>
                          )}
                        </article>
                      ))}
                  </div>
                  {!demo && units.length === 0 && (
                    <div className="empty">
                      Nenhuma unidade disponível no seu escopo.
                    </div>
                  )}
                </section>
              )}
              {tab === "members" && (
                <section className="card">
                  <div className="section-heading">
                    <h2>Usuários vinculados</h2>
                    <span className="pill neutral">Permissões por escopo</span>
                  </div>
                  {demo ? (
                    <div className="empty">
                      <Users />
                      <h3>Perfis com responsabilidades claras</h3>
                      <p>
                        Administrador, SST, supervisor, executante e auditor. O
                        perfil não substitui competência, treinamento ou
                        designação formal.
                      </p>
                    </div>
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Usuário</th>
                            <th>Perfil</th>
                            <th>Situação</th>
                            <th>Ação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((u) => (
                            <tr key={u.id}>
                              <td>
                                <strong>{u.displayName}</strong>
                                <small>
                                  {u.allUnits
                                    ? "Todas as unidades"
                                    : "Unidades específicas"}
                                </small>
                              </td>
                              <td>{roleNames[u.role]}</td>
                              <td>
                                <span
                                  className={`pill ${u.active ? "green" : "neutral"}`}
                                >
                                  {u.active ? "Ativo" : "Inativo"}
                                </span>
                              </td>
                              <td>
                                {allowed("member:write") && (
                                  <button
                                    className="text-button"
                                    disabled={busy}
                                    onClick={() => toggle(u)}
                                  >
                                    {u.active ? "Desativar" : "Ativar"}
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {users.length === 0 && (
                        <div className="empty">
                          Nenhum usuário disponível para consulta.
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}
              {tab === "audit" && (
                <section className="card">
                  <div className="section-heading">
                    <h2>Histórico administrativo</h2>
                    <span className="subtle">
                      Até 100 eventos mais recentes
                    </span>
                  </div>
                  {demo ? (
                    <div className="empty">
                      <History />
                      <p>
                        As alterações de cadastros ficam associadas ao autor e
                        ao horário do servidor.
                      </p>
                    </div>
                  ) : audit.length ? (
                    <ul className="timeline">
                      {audit.map((a) => (
                        <li key={a.id}>
                          <span className="timeline-dot" />
                          <div>
                            <strong>
                              {a.action === "INSERT"
                                ? "Cadastro criado"
                                : "Cadastro atualizado"}
                            </strong>
                            <p>
                              {a.resource} ·{" "}
                              {new Date(a.createdAt).toLocaleString("pt-BR")}
                            </p>
                            <small>Ator: {a.actor.slice(0, 16)}…</small>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="empty">Nenhum evento disponível.</div>
                  )}
                </section>
              )}
              {tab === "models" && (
                <>
                  <div className="notice">
                    <Info size={18} />
                    Os modelos abaixo estão em planejamento. A publicação
                    operacional depende de revisão de SST e jurídica.
                  </div>
                  <div className="model-grid">
                    {activities.map((a, i) => (
                      <article className="card model" key={a}>
                        <div className="model-top">
                          <HardHat size={24} />
                          <span className="pill neutral">Não aprovado</span>
                        </div>
                        <span className="subtle">
                          ATIVIDADE {String(i + 1).padStart(2, "0")}
                        </span>
                        <h2>{a}</h2>
                        <p>
                          Riscos, controles e responsáveis definidos para o
                          contexto da atividade.
                        </p>
                        <button
                          className="text-button"
                          onClick={() => {
                            navigate("apr");
                          }}
                        >
                          Conhecer estrutura de análise <ArrowRight size={16} />
                        </button>
                      </article>
                    ))}
                  </div>
                </>
              )}
              {tab === "apr" && (
                <section className="card form-card">
                  <div className="section-heading">
                    <div>
                      <h2>Estrutura de análise preliminar</h2>
                      <p>
                        Prévia da Fase 2 · sem salvamento ou emissão
                        operacional.
                      </p>
                    </div>
                    <span className="pill amber">Modelo não aprovado</span>
                  </div>
                  <div className="form-body">
                    <ol className="step-list">
                      <li className="current">1. Contexto</li>
                      <li>2. Riscos e controles</li>
                      <li>3. Revisão</li>
                    </ol>
                    <div className="stack-form">
                      <label>
                        Qual atividade será realizada?
                        <select defaultValue="">
                          <option value="" disabled>
                            Selecione para explorar
                          </option>
                          {activities.map((a) => (
                            <option key={a}>{a}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Descrição específica do serviço
                        <textarea
                          rows={3}
                          placeholder="Descreva a atividade, o local e as condições de trabalho."
                        />
                      </label>
                      <div className="notice">
                        Os campos desta prévia não são salvos. Não inclua dados
                        reais.
                      </div>
                    </div>
                    <h3 className="form-section-title">
                      Exemplo de apresentação do checklist
                    </h3>
                    <p className="subtle">
                      Perguntas ilustrativas; não constituem modelo normativo ou
                      critério de liberação.
                    </p>
                    <DemoChecklist />
                    <div className="form-footer">
                      <LockKeyhole size={18} />
                      <span>
                        Avanço operacional indisponível até revisão do modelo e
                        implementação da Fase 2.
                      </span>
                    </div>
                  </div>
                </section>
              )}
              {tab === "pt" && (
                <section className="card">
                  <div className="section-heading">
                    <div>
                      <h2>
                        {selected ? selected.name : "Permissões de trabalho"}
                      </h2>
                      <p>
                        {selected
                          ? selected.id
                          : "Planejamento, revisão e autorização responsável."}
                      </p>
                    </div>
                    {selected && (
                      <button
                        className="text-button"
                        onClick={() => setSelected(null)}
                      >
                        Voltar à lista
                      </button>
                    )}
                  </div>
                  {demo ? (
                    selected ? (
                      <div className="permit-detail">
                        <span className="pill amber">{selected.status}</span>
                        <h3>Esta atividade não está autorizada.</h3>
                        <p>
                          {selected.activity} · {selected.unit} ·{" "}
                          {selected.team}
                        </p>
                        <ol className="review-flow">
                          <li>
                            <Check /> Contexto da atividade registrado — exemplo
                          </li>
                          <li>
                            <Clock3 /> Análise de riscos pendente de revisão
                          </li>
                          <li>
                            <LockKeyhole /> Aprovações e assinaturas pendentes
                          </li>
                          <li>
                            <LockKeyhole /> Liberação indisponível nesta
                            demonstração
                          </li>
                        </ol>
                        <button
                          className="button secondary"
                          onClick={() => navigate("apr")}
                        >
                          Consultar estrutura da APR <ArrowRight size={16} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <SearchBox value={query} onChange={setQuery} />
                        <ActivityTable
                          rows={demoRows.filter((r) =>
                            `${r.name} ${r.activity} ${r.status}`
                              .toLowerCase()
                              .includes(query.toLowerCase()),
                          )}
                          onSelect={setSelected}
                        />
                      </>
                    )
                  ) : (
                    <div className="empty">
                      <FileCheck2 size={36} />
                      <h3>Fluxo de autorização em desenvolvimento</h3>
                      <p>
                        A Fase 3 incluirá PT vinculada à versão da APR,
                        responsáveis, bloqueios, assinaturas e regras próprias
                        para PET.
                      </p>
                      <Link className="button secondary" href="/demonstracao">
                        Explorar demonstração
                      </Link>
                    </div>
                  )}
                </section>
              )}
              {tab === "documents" && (
                <section className="card empty">
                  <FolderArchive size={36} />
                  <h2>Documentos com histórico preservado</h2>
                  <p>
                    A Fase 4 entregará PDFs, consulta autorizada, QR de
                    verificação e retenção fundamentada por tipo de documento.
                  </p>
                  <div className="notice">
                    Ainda não há documentos emitidos. A demonstração não gera
                    comprovantes de autorização.
                  </div>
                </section>
              )}
              {tab === "account" && (
                <section className="card account">
                  <div className="section-heading">
                    <h2>Minha conta</h2>
                    <LockKeyhole size={20} />
                  </div>
                  <dl>
                    <dt>Nome</dt>
                    <dd>{demo ? "Pessoa fictícia" : me?.name}</dd>
                    <dt>Autenticação multifator</dt>
                    <dd>
                      {demo
                        ? "Demonstração"
                        : me?.mfa
                          ? "Confirmada pelo provedor"
                          : "Não confirmada; acesso privilegiado bloqueado"}
                    </dd>
                    <dt>Identificador para vínculo</dt>
                    <dd className="identity">
                      {demo ? "Não disponível na demonstração" : me?.userId}
                    </dd>
                  </dl>
                  {!demo && (
                    <div className="account-actions">
                      {me?.platformOperator && (
                        <Link
                          className="button secondary"
                          href={commercial ? "/painel" : "/comercial"}
                        >
                          {commercial ? "Área da empresa" : "Painel comercial"}
                        </Link>
                      )}
                      <button
                        className="button secondary"
                        onClick={async () => {
                          try {
                            await request("/auth/logout", me?.csrf, {}, "POST");
                            window.location.href = "/";
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        <LogOut size={18} />
                        Sair da aplicação
                      </button>
                    </div>
                  )}
                </section>
              )}
              {commercial && tab === "companies" && (
                <section className="card">
                  <div className="section-heading">
                    <h2>Cadastros comerciais</h2>
                    <span className="pill neutral">
                      Sem acesso às APRs e PTs
                    </span>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Empresa</th>
                          <th>Razão social</th>
                          <th>CNPJ informado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {companies.map((c) => (
                          <tr key={c.id}>
                            <td>
                              <strong>{c.name}</strong>
                            </td>
                            <td>{c.legalName}</td>
                            <td>{c.cnpj}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          )}
          <footer className="page-footer">
            <span>
              <ShieldCheck size={15} /> Vigia · Gestão de segurança operacional
            </span>
            <span>Desenvolvimento · Sem homologação para uso operacional</span>
          </footer>
        </main>
      </div>
      {modal && (
        <div className="modal-overlay">
          <section
            className="modal card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="section-heading">
              <h2 id="modal-title">
                {modal === "unit"
                  ? "Nova unidade"
                  : modal === "member"
                    ? "Vincular usuário"
                    : "Cadastrar empresa"}
              </h2>
              <button
                className="icon-button"
                onClick={() => setModal(null)}
                aria-label="Fechar cadastro"
              >
                <X />
              </button>
            </div>
            <form className="stack-form" onSubmit={save}>
              {modal === "unit" ? (
                <label>
                  Nome da unidade
                  <input
                    autoFocus
                    name="name"
                    required
                    minLength={2}
                    maxLength={120}
                  />
                </label>
              ) : modal === "member" ? (
                <>
                  <label>
                    Nome de exibição
                    <input
                      autoFocus
                      name="displayName"
                      required
                      minLength={2}
                      maxLength={120}
                    />
                  </label>
                  <label>
                    Identificador da conta
                    <input name="userId" required pattern="[a-f0-9]{64}" />
                    <small>
                      Disponível em Minha conta do usuário. Não use e-mail ou
                      CPF.
                    </small>
                  </label>
                  <label>
                    Perfil
                    <select name="role">
                      {Object.entries(roleNames).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Escopo
                    <select name="scope">
                      <option value="all">Todas as unidades</option>
                      <option value="unit">Uma unidade específica</option>
                    </select>
                  </label>
                  <label>
                    Unidade (quando escopo específico)
                    <select name="unitId">
                      <option value="">Selecione</option>
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : (
                <>
                  <label>
                    Razão social
                    <input
                      autoFocus
                      name="legalName"
                      required
                      minLength={2}
                      maxLength={120}
                    />
                  </label>
                  <label>
                    Nome fantasia
                    <input name="name" required minLength={2} maxLength={120} />
                  </label>
                  <label>
                    CNPJ sem pontuação
                    <input
                      name="cnpj"
                      required
                      pattern="[A-Z0-9]{12}[0-9]{2}"
                      maxLength={14}
                    />
                    <small>
                      Validação cadastral na Receita ainda não integrada.
                    </small>
                  </label>
                  <label>
                    Nome do administrador
                    <input
                      name="adminName"
                      required
                      minLength={2}
                      maxLength={120}
                    />
                  </label>
                  <label>
                    Identificador da conta do administrador
                    <input name="adminUserId" required pattern="[a-f0-9]{64}" />
                  </label>
                </>
              )}
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              <div className="form-actions">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setModal(null)}
                >
                  Cancelar
                </button>
                <button className="button primary" disabled={busy}>
                  {busy ? "Salvando…" : "Salvar cadastro"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
function Stat({
  icon: Icon,
  label,
  value,
  detail,
  tone = "green",
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
  detail: string;
  tone?: string;
}) {
  return (
    <article className={`card stat ${tone}`}>
      <div className="stat-top">
        <span>{label}</span>
        <Icon size={20} />
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}
function SearchBox({
  value,
  onChange,
}: {
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <label className="search">
      <Search size={18} />
      <span className="sr-only">Buscar registros</span>
      <input
        placeholder="Buscar registros…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
function ActivityTable({
  rows,
  onSelect,
}: {
  rows: typeof demoRows;
  onSelect: (r: (typeof demoRows)[number]) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Atividade / documento</th>
            <th>Unidade</th>
            <th>Situação</th>
            <th>
              <span className="sr-only">Detalhes</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <button className="row-title" onClick={() => onSelect(r)}>
                  {r.name}
                </button>
                <small>
                  {r.id} · {r.activity}
                </small>
              </td>
              <td>{r.unit}</td>
              <td>
                <span
                  className={`pill ${r.status === "Aguardando correção" ? "red" : r.status === "Em análise" ? "amber" : "neutral"}`}
                >
                  {r.status}
                </span>
              </td>
              <td>
                <button
                  className="icon-button"
                  aria-label={`Ver ${r.id}`}
                  onClick={() => onSelect(r)}
                >
                  <ArrowUpRight size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <div className="empty">Nenhum exemplo corresponde à busca.</div>
      )}
    </div>
  );
}
function DemoChecklist() {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const questions = [
    {
      text: "Os controles definidos na análise foram verificados no local?",
      expected: "Sim",
    },
    {
      text: "Existe alguma condição nova que ainda não foi analisada?",
      expected: "Não",
    },
    {
      text: "Os envolvidos receberam informações sobre os riscos da atividade?",
      expected: "Sim",
    },
  ];
  return (
    <div className="checklist">
      {questions.map((q, i) => (
        <fieldset key={q.text}>
          <legend>
            {i + 1}. {q.text}
          </legend>
          <small>
            Exemplo de resposta esperada: {q.expected}. Revisão profissional
            pendente.
          </small>
          {["Sim", "Não", "N/A"].map((a) => (
            <label key={a} className={answers[i] === a ? "selected" : ""}>
              <input
                type="radio"
                name={`question-${i}`}
                value={a}
                checked={answers[i] === a}
                onChange={() => setAnswers({ ...answers, [i]: a })}
              />
              {a === "N/A" ? "N/A (Não se aplica)" : a}
            </label>
          ))}
          {answers[i] && answers[i] !== q.expected && (
            <p className="incompatible">
              <AlertTriangle size={16} />
              Resposta exige avaliação. Nenhuma autorização é emitida.
            </p>
          )}
        </fieldset>
      ))}
    </div>
  );
}
