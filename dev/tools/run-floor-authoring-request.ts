import {
  createFloorAuthoringDependencies,
  handleFloorAuthoringRequest,
  type FloorAuthoringRequest,
} from "./floor-set/authoring-api";

async function readStandardInput(): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  const request = JSON.parse(await readStandardInput()) as FloorAuthoringRequest;
  const response = await handleFloorAuthoringRequest(request, createFloorAuthoringDependencies(process.cwd()));
  const payload = JSON.stringify(response ?? { status: 404, body: { message: "Unknown floor authoring operation." } });

  await new Promise<void>((resolve, reject) => {
    process.stdout.write(payload, (error) => (error ? reject(error) : resolve()));
  });
  process.exit(0);
}

main().catch((caught: unknown) => {
  const message = caught instanceof Error ? caught.stack : String(caught);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
