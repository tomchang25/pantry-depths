import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { renderBalanceReportHtml } from "./balance/report-html";
import { createBalanceAnalysis } from "@/harness/balance-analysis";

const DEFAULT_OUTPUT = "dev/docs/reports/pantry_depths_balance.html";

async function main(): Promise<void> {
  const outputPath = resolve(DEFAULT_OUTPUT);
  await writeFile(outputPath, renderBalanceReportHtml(createBalanceAnalysis()), "utf8");
  process.stdout.write(`Generated balance report at ${outputPath}.\n`);
}

void main().catch((caught: unknown) => {
  const message = caught instanceof Error ? caught.message : "Unable to generate the balance report.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
