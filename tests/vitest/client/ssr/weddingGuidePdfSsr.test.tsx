// @vitest-environment node
/*
 * Purpose: /ghidul-mirilor-pdf renders on the server with its content and SEO head, so
 * Google sees it for „ghidul mirilor", „ghidul mirilor pdf", „ghid pentru miri".
 */
import { expect, test } from "vitest";
import { render } from "src/client/entry-server";

test("the guide page renders on the server with title, canonical and structured data", async () => {
  const { appHtml, head } = await render("/ghidul-mirilor-pdf");
  expect(appHtml).toContain("Ghidul Mirilor");
  expect(appHtml).toContain("înainte de ziua cea mare");
  expect(appHtml).toContain("Descarcă PDF-ul");
  expect(head).toContain("Ghidul Mirilor PDF gratuit");
  expect(head).toContain('href="https://www.ancavisuals.ro/ghidul-mirilor-pdf"');
  expect(head).toContain("ghid pentru miri");
  expect(head).toContain("DigitalDocument");
});
