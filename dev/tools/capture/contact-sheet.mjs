/**
 * The contact sheet: one static page putting the previous run beside the latest, scene by scene.
 *
 * Written fresh on every capture into `capture-output/index.html`, next to the `latest/` and
 * `previous/` directories it points into. It is a plain file for a person (or an agent reading
 * screenshots) to open — no server, no scripts beyond hiding the previous-run column when there is
 * no previous run to show.
 */

function escapeHtml(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function statsLine(result) {
  const parts = [];

  if (result.fps) {
    parts.push(`avg ${result.fps.avgFps} FPS`, `worst frame ${result.fps.minFps} FPS`);
  }

  if (result.world) {
    parts.push(`${result.world.enemies} enemies`, `HP ${result.world.hp}/${result.world.maxHp}`);

    if (result.world.held) {
      parts.push(`holding ${result.world.held}`);
    }
  }

  return parts.join(" · ");
}

export function contactSheetHtml(results, runInfo) {
  const rows = results
    .map((result) => {
      const name = escapeHtml(result.name);
      return `
    <section class="scene">
      <h2>${name}</h2>
      <p class="note">${escapeHtml(result.note)}</p>
      <div class="pair">
        <figure>
          <img src="previous/${name}.png" alt="${name}, previous run" onerror="this.closest('figure').classList.add('missing')" />
          <figcaption>previous</figcaption>
        </figure>
        <figure>
          <img src="latest/${name}.png" alt="${name}, latest run" onerror="this.closest('figure').classList.add('missing')" />
          <figcaption>latest</figcaption>
        </figure>
      </div>
      <p class="stats">${escapeHtml(statsLine(result))}</p>
    </section>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Capture contact sheet</title>
<style>
  body { margin: 0; padding: 24px; background: #17111f; color: #e8e0d0; font: 14px/1.5 system-ui, sans-serif; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .run-info { color: #9a8fb0; margin: 0 0 24px; }
  .scene { margin-bottom: 36px; }
  h2 { font-size: 15px; margin: 0 0 2px; }
  .note { color: #9a8fb0; margin: 0 0 8px; }
  .pair { display: flex; gap: 12px; flex-wrap: wrap; }
  figure { margin: 0; }
  figure img { display: block; width: min(620px, 46vw); border: 1px solid #3a2f4a; border-radius: 4px; }
  figure.missing { display: none; }
  figcaption { color: #9a8fb0; font-size: 12px; margin-top: 4px; }
  .stats { color: #c8bfa8; margin: 8px 0 0; font-size: 13px; }
</style>
</head>
<body>
<h1>Capture contact sheet</h1>
<p class="run-info">${escapeHtml(runInfo)}</p>
${rows}
</body>
</html>
`;
}
