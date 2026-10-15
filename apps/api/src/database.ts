import { PrismaClient, Prisma } from "@prisma/client";
export type Tx = Prisma.TransactionClient;
export class Database {
  readonly client: PrismaClient;
  constructor(url: string) {
    this.client = new PrismaClient({ datasources: { db: { url } } });
  }
  onModuleDestroy() {
    return this.client.$disconnect();
  }
  async verifyRole() {
    const [r] = await this.client.$queryRaw<
      { rolsuper: boolean; rolbypassrls: boolean; owns: boolean }[]
    >`
      SELECT rolsuper,rolbypassrls,EXISTS(SELECT 1 FROM pg_tables WHERE schemaname='public' AND tableowner=current_user) AS owns FROM pg_roles WHERE rolname=current_user`;
    if (!r || r.rolsuper || r.rolbypassrls || r.owns)
      throw new Error(
        "A API exige usuário sem superuser, BYPASSRLS ou propriedade de tabelas",
      );
  }
  context<T>(
    userId: string,
    tenantId: string | null,
    fn: (tx: Tx) => Promise<T>,
  ) {
    return this.client.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.subject',${userId},true),set_config('app.tenant',${tenantId ?? ""},true)`;
        return fn(tx);
      },
      { isolationLevel: "Serializable", maxWait: 5000, timeout: 10000 },
    );
  }
}
