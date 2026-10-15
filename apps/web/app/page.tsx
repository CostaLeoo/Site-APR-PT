import Link from "next/link";
import {
  ShieldCheck,
  ArrowRight,
  FileCheck2,
  Users,
  LockKeyhole,
} from "lucide-react";
export default function Home() {
  return (
    <main id="conteudo" className="welcome">
      <div className="welcome-brand">
        <ShieldCheck size={36} />
        <strong>
          vigia<span>segurança operacional</span>
        </strong>
      </div>
      <div className="welcome-content">
        <span className="eyebrow">APR & PERMISSÃO DE TRABALHO</span>
        <h1>
          Segurança em
          <br />
          cada etapa.
        </h1>
        <p>
          Organize equipes, analise riscos e mantenha as decisões de segurança
          no lugar certo.
        </p>
        <div className="welcome-actions">
          <a className="button primary" href="/auth/login">
            Entrar na plataforma <ArrowRight size={18} />
          </a>
          <Link className="button secondary" href="/demonstracao">
            Conhecer a demonstração
          </Link>
        </div>
        <div className="notice">
          Em desenvolvimento · A Fase 1 permite gerenciar empresas e acessos. A
          emissão de APR, PT e PET ainda não está disponível.
        </div>
      </div>
      <div className="welcome-footer">
        <span>
          <FileCheck2 size={18} /> Rastreabilidade
        </span>
        <span>
          <Users size={18} /> Responsabilidade
        </span>
        <span>
          <LockKeyhole size={18} /> Acesso controlado
        </span>
      </div>
    </main>
  );
}
