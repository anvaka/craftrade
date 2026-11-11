// Which provider decides untried pairs on a real server. Kept out of app.ts so
// the app can be loaded where the Bedrock SDK cannot (the solo world in a browser).
import { BedrockProvider, hasBedrockCredentials } from './bedrock.ts';
import { ProceduralProvider, type FusionProvider } from './provider.ts';

/** CRAFT_PROVIDER=procedural|bedrock forces the choice; otherwise it follows the credentials. */
export function defaultProvider(env: NodeJS.ProcessEnv = process.env): FusionProvider {
  const forced = env.CRAFT_PROVIDER;
  if (forced === 'bedrock' || (forced !== 'procedural' && hasBedrockCredentials(env))) return new BedrockProvider();
  return new ProceduralProvider();
}
