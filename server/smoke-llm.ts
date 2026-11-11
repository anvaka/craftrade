// Fuse three sample pairs through the real Bedrock provider and print the raw
// and repaired results. Nothing is stored. Run when credentials are in place:
//   AWS_BEARER_TOKEN_BEDROCK=... AWS_REGION=us-east-1 npx tsx server/smoke-llm.ts
// Optional: CRAFT_MODEL_ID to try another model.

import { BASE_ITEMS } from '../src/shared/content/items.ts';
import { effectText, fusionBudget, itemPoints, itemTier, recipeKey, type ItemSpec } from '../src/shared/item.ts';
import { BedrockProvider, hasBedrockCredentials } from './bedrock.ts';
import { validatePick } from './provider.ts';

if (!hasBedrockCredentials()) {
  console.error('No Bedrock credentials found. Set AWS_BEARER_TOKEN_BEDROCK (or standard AWS credentials) and AWS_REGION.');
  process.exit(2);
}
if (BASE_ITEMS.length < 4) {
  console.error('Need at least four authored items to pick sample pairs from.');
  process.exit(2);
}

// Three pairs spread across the authored list, so the samples differ in theme.
const at = (f: number) => BASE_ITEMS[Math.min(BASE_ITEMS.length - 1, Math.floor(BASE_ITEMS.length * f))];
const pairs: [ItemSpec, ItemSpec][] = [[BASE_ITEMS[0], BASE_ITEMS[1]], [at(0.3), at(0.6)], [at(0.5), at(0.9)]];

const provider = new BedrockProvider({ timeoutMs: 30_000 });
console.log(`model ${provider.model}\n`);
let failed = 0;

for (const [a, b] of pairs) {
  const budget = fusionBudget(a, b);
  const key = recipeKey(a.id, b.id);
  console.log(`--- ${a.name} + ${b.name}  (budget ${budget})`);
  try {
    const pick = await provider.propose(a, b, budget, key);
    console.log('raw:     ', provider.last?.text);
    console.log('usage:   ', JSON.stringify(provider.last?.usage));
    console.log(`time:     ${provider.last?.ms} ms, stop_reason ${provider.last?.stopReason}`);
    const fixed = validatePick(pick, budget, key);
    if (!fixed) {
      failed++;
      console.log('repaired: rejected, no usable effect');
      continue;
    }
    console.log('names:   ', fixed.names.join(' | ') || '(none passed the name check)');
    console.log(`glyph:    ${fixed.glyph}   tags: ${fixed.tags.join(', ')}`);
    console.log(`repaired: ${itemPoints(fixed.effects)} points, tier ${itemTier(fixed)}`);
    for (const e of fixed.effects) console.log(`          ${e.p} ${e.l}${e.neg ? ' (drawback)' : ''}: ${effectText(e)}`);
  } catch (err) {
    failed++;
    console.log('failed:  ', err);
    if (provider.last) console.log('last raw:', provider.last.text);
  }
  console.log();
}
// The second and third calls should show cache_read_input_tokens above zero
// if the system prompt is long enough to cache on this model.
process.exit(failed ? 1 : 0);
