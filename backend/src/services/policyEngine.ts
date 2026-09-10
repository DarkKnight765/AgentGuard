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
 * The WASM has two entrypoints: agentguard/allow and agentguard/needs_approval.
 * We evaluate each separately and combine the results.
 */

let policy: LoadedPolicy | null = null;
let allowEntrypoint: number | undefined;
let needsApprovalEntrypoint: number | undefined;

/**
 * Load the precompiled policy.wasm from disk.
 * Call this once at server startup.
 */
export async function initPolicyEngine(wasmPath?: string): Promise<void> {
  const resolvedPath = wasmPath || process.env.POLICY_WASM_PATH || path.resolve(__dirname, '../../..', 'policies/out/policy.wasm');

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(
      `Policy WASM not found at ${resolvedPath}. ` +
      `Run policies/build.sh to compile base.rego to WASM first.`
    );
  }

  const wasmBuffer = fs.readFileSync(resolvedPath);
  policy = await loadPolicy(wasmBuffer);

  // Discover entrypoint IDs from the policy's entrypoints map
  const entrypoints = (policy as any).entrypoints;
  if (entrypoints) {
    for (const [name, id] of Object.entries(entrypoints)) {
      if (name === 'agentguard/allow') allowEntrypoint = id as number;
      if (name === 'agentguard/needs_approval') needsApprovalEntrypoint = id as number;
    }
  }

  console.log(`[PolicyEngine] Loaded policy.wasm (${wasmBuffer.byteLength} bytes)`);
  console.log(`[PolicyEngine] Entrypoints: allow=${allowEntrypoint}, needs_approval=${needsApprovalEntrypoint}`);
}

/**
 * Load a policy directly from a WASM buffer.
 * Used by unit tests to avoid filesystem dependency.
 */
export async function initPolicyEngineFromBuffer(wasmBuffer: Buffer): Promise<void> {
  policy = await loadPolicy(wasmBuffer);

  const entrypoints = (policy as any).entrypoints;
  if (entrypoints) {
    for (const [name, id] of Object.entries(entrypoints)) {
      if (name === 'agentguard/allow') allowEntrypoint = id as number;
      if (name === 'agentguard/needs_approval') needsApprovalEntrypoint = id as number;
    }
  }
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
 * Evaluates both entrypoints (allow & needs_approval) separately and
 * combines the results. If neither is true, the decision is "deny".
 */
export function evaluatePolicy(input: PolicyInput): PolicyResult {
  if (!policy) {
    throw new Error('Policy engine not initialized — call initPolicyEngine() first');
  }

  // Evaluate "allow" entrypoint
  const allowResult = policy.evaluate(input, allowEntrypoint);
  const allow = allowResult && allowResult.length > 0
    ? Boolean(allowResult[0].result)
    : false;

  // Evaluate "needs_approval" entrypoint
  const needsApprovalResult = policy.evaluate(input, needsApprovalEntrypoint);
  const needs_approval = needsApprovalResult && needsApprovalResult.length > 0
    ? Boolean(needsApprovalResult[0].result)
    : false;

  return { allow, needs_approval };
}

/**
 * Convert a PolicyResult to a gateway decision string.
 */
export function toDecision(result: PolicyResult): 'allow' | 'deny' | 'needs_approval' {
  // If explicitly allowed, allow (even if needs_approval is also true,
  // allow takes precedence to avoid contradictory states)
  if (result.allow) return 'allow';
  if (result.needs_approval) return 'needs_approval';
  return 'deny';
}
