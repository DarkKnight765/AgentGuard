import fs from 'fs';
import path from 'path';
import { loadPolicy, LoadedPolicy } from '@open-policy-agent/opa-wasm';

/**
 * OPA/WASM Policy Engine.
 *
 * Loads the precompiled policy.wasm once at server startup and holds the
 * instance in memory. All agents share the same base policy — there is no
 * per-agent WASM and no runtime recompilation.
 *
 * The WASM evaluates { role, tool, args } and returns { allow, needs_approval }.
 * If neither is true, the decision is "deny" (closed by default).
 */

let policy: LoadedPolicy | null = null;

/**
 * Load the precompiled policy.wasm from disk.
 * Call this once at server startup.
 */
export async function initPolicyEngine(wasmPath?: string): Promise<void> {
  const resolvedPath = wasmPath || path.resolve(__dirname, '../../..', 'policies/out/policy.wasm');

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(
      `Policy WASM not found at ${resolvedPath}. ` +
      `Run policies/build.sh to compile base.rego to WASM first.`
    );
  }

  const wasmBuffer = fs.readFileSync(resolvedPath);
  policy = await loadPolicy(wasmBuffer);
  console.log(`[PolicyEngine] Loaded policy.wasm (${wasmBuffer.byteLength} bytes)`);
}

/**
 * Load a policy directly from a WASM buffer.
 * Used by unit tests to avoid filesystem dependency.
 */
export async function initPolicyEngineFromBuffer(wasmBuffer: Buffer): Promise<void> {
  policy = await loadPolicy(wasmBuffer);
}

export interface PolicyInput {
  role: string;
  tool: string;
  args?: Record<string, any>;
}

export interface PolicyResult {
  allow: boolean;
  needs_approval: boolean;
}

/**
 * Evaluate the loaded policy against the given input.
 *
 * Returns { allow, needs_approval }. If neither is true, the caller
 * should treat the decision as "deny" (closed-by-default).
 */
export function evaluatePolicy(input: PolicyInput): PolicyResult {
  if (!policy) {
    throw new Error('Policy engine not initialized — call initPolicyEngine() first');
  }

  const resultSet = policy.evaluate(input);

  // OPA WASM returns an array of result objects.
  // Each entrypoint produces a result under its path.
  // We query agentguard/allow and agentguard/needs_approval.
  if (!resultSet || resultSet.length === 0) {
    return { allow: false, needs_approval: false };
  }

  const result = resultSet[0].result;

  // The result structure depends on the entrypoints.
  // With multiple entrypoints, we get an object like:
  //   { agentguard: { allow: true/false, needs_approval: true/false } }
  // or a flat result per entrypoint. Let's handle both.

  if (result && typeof result === 'object') {
    // Check for nested structure
    if ('agentguard' in result) {
      const ag = (result as any).agentguard;
      return {
        allow: Boolean(ag?.allow),
        needs_approval: Boolean(ag?.needs_approval),
      };
    }

    // Flat structure
    return {
      allow: Boolean((result as any).allow),
      needs_approval: Boolean((result as any).needs_approval),
    };
  }

  return { allow: false, needs_approval: false };
}

/**
 * Convert a PolicyResult to a gateway decision string.
 */
export function toDecision(result: PolicyResult): 'allow' | 'deny' | 'needs_approval' {
  if (result.allow) return 'allow';
  if (result.needs_approval) return 'needs_approval';
  return 'deny';
}
