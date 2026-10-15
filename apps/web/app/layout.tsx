import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Vigia · Segurança em cada etapa",
  description:
    "Gestão de APR e permissões de trabalho. Ambiente em desenvolvimento.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <a className="skip" href="#conteudo">
          Ir para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
