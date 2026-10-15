import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function navigate(page: import("@playwright/test").Page, label: string) {
  const menu = page.getByRole("button", { name: "Abrir menu" });
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: label, exact: true })
    .click();
}
test("demonstração navegável, perguntas verticais e nenhuma liberação", async ({
  page,
}, info) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Conhecer a demonstração" }).click();
  await expect(page.getByText("Demonstração navegável.")).toBeVisible();
  await page.screenshot({
    path: `.local/preview-${info.project.name}.png`,
    fullPage: true,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await navigate(page, "Análises de risco");
  const groups = page.locator("fieldset");
  await expect(groups).toHaveCount(3);
  const first = await groups.nth(0).boundingBox(),
    second = await groups.nth(1).boundingBox();
  expect(second!.y).toBeGreaterThan(first!.y + first!.height);
  await groups.nth(1).getByRole("radio", { name: "Sim", exact: true }).check();
  await expect(
    groups.nth(1).getByText("Resposta exige avaliação.", { exact: false }),
  ).toBeVisible();
  const labels = groups.nth(0).locator("label");
  const a = await labels.nth(0).boundingBox(),
    b = await labels.nth(1).boundingBox();
  expect(b!.y).toBeGreaterThanOrEqual(a!.y + a!.height);
  await navigate(page, "Permissões de trabalho");
  await page
    .getByRole("button", { name: "Manutenção de cobertura", exact: true })
    .click();
  await expect(
    page.getByText("Esta atividade não está autorizada."),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("login OIDC, unidade persistida, vínculo, auditoria e logout", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Entrar na plataforma" }).click();
  await expect(page).toHaveURL(/painel/);
  await expect(
    page.getByRole("heading", { name: "Visão geral", exact: true }),
  ).toBeVisible();
  await navigate(page, "Unidades");
  await page.getByRole("button", { name: "Nova unidade" }).click();
  const name = `Unidade fictícia ${Date.now()}`;
  await page.getByLabel("Nome da unidade").fill(name);
  await page.getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await page.reload();
  await navigate(page, "Unidades");
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await navigate(page, "Pessoas e acessos");
  await expect(page.getByText("Administrador Alfa — fictício")).toBeVisible();
  await navigate(page, "Trilha de auditoria");
  await expect(page.getByText("Cadastro criado").first()).toBeVisible();
  await navigate(page, "Minha conta");
  await expect(page.getByText("Confirmada pelo provedor")).toBeVisible();
  await page.getByRole("button", { name: "Sair da aplicação" }).click();
  await expect(page).toHaveURL("/");
  const r = await page.request.get("/v1/me");
  expect(r.status()).toBe(401);
});
