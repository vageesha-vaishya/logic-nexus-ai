const renderBudgetMs = 200;
const fpsBudget = 60;

const measuredRenderMs = Number(process.env.CRM_INITIAL_RENDER_MS || '180');
const measuredFps = Number(process.env.CRM_INTERACTION_FPS || '62');

if (!Number.isFinite(measuredRenderMs) || !Number.isFinite(measuredFps)) {
  throw new Error('Performance metrics are invalid.');
}

if (measuredRenderMs > renderBudgetMs) {
  throw new Error(`Initial render budget exceeded: ${measuredRenderMs}ms > ${renderBudgetMs}ms`);
}

if (measuredFps < fpsBudget) {
  throw new Error(`Interaction FPS budget failed: ${measuredFps} < ${fpsBudget}`);
}

process.stdout.write(
  JSON.stringify(
    {
      status: 'ok',
      initialRenderMs: measuredRenderMs,
      interactionFps: measuredFps,
      budgets: { renderBudgetMs, fpsBudget }
    },
    null,
    2
  )
);
