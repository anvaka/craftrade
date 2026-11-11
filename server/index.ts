// Entry point: one process serving the API and, when built, the client.
//   tsx server/index.ts
// Env: PORT, DB_PATH, MARKET_OPEN, TRUST_PROXY, CRAFT_PROVIDER, CRAFT_MODEL_ID,
//      AWS_REGION, AWS_BEARER_TOKEN_BEDROCK (or standard AWS credentials).

import { serve } from '@hono/node-server';
import { createApp, defaultProvider } from './app.ts';

const provider = defaultProvider();
const app = createApp({ provider, staticDir: './dist' });
const port = Number(process.env.PORT ?? 8787);

serve({ fetch: app.fetch, port }, () => {
  console.log(`craftrade server on :${port}`);
  console.log(`fusion provider: ${provider.llm ? `Bedrock, ${provider.model}` : 'procedural (no model credentials configured)'}`);
  if (process.env.MARKET_OPEN === '0') console.log('trading is closed (MARKET_OPEN=0)');
});
