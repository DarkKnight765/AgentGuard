import fs from 'fs';
import path from 'path';
import {
  initPolicyEngineFromBuffer,
  evaluatePolicy,
  toDecision,
} from '../services/policyEngine';

/**
 * Unit tests for the OPA/WASM policy engine.
 *
 * These test the core security logic in isolation — no HTTP server,
 * no Redis, no Postgres. Just the WASM evaluation function against
 * the precompiled base.rego policy.
 *
 * For a project whose entire pitch is "the enforcement has to be right,"
 * these tests are disproportionately high-value.
 */

const WASM_PATH = path.resolve(__dirname, '../../..', 'policies/out/policy.wasm');

beforeAll(async () => {
  const wasmBuffer = fs.readFileSync(WASM_PATH);
  await initPolicyEngineFromBuffer(wasmBuffer);
});

describe('Policy Engine — base.rego rules', () => {
  // ─── Reader role ────────────────────────────────────────────

  test('reader allowed on read-prefixed tool', () => {
    const result = evaluatePolicy({ role: 'reader', tool: 'read_repository' });
    expect(result.allow).toBe(true);
    expect(toDecision(result)).toBe('allow');
  });

  test('reader allowed on get-prefixed tool', () => {
    const result = evaluatePolicy({ role: 'reader', tool: 'get_file' });
    expect(result.allow).toBe(true);
    expect(toDecision(result)).toBe('allow');
  });

  test('reader denied on unknown tool', () => {
    const result = evaluatePolicy({ role: 'reader', tool: 'launch_missiles' });
    expect(result.allow).toBe(false);
    expect(result.needs_approval).toBe(false);
    expect(toDecision(result)).toBe('deny');
  });

  test('reader gets needs_approval on delete_repository', () => {
    const result = evaluatePolicy({ role: 'reader', tool: 'delete_repository' });
    expect(result.needs_approval).toBe(true);
    expect(toDecision(result)).toBe('needs_approval');
  });

  // ─── Deployer role ──────────────────────────────────────────

  test('deployer allowed on read-prefixed tool', () => {
    const result = evaluatePolicy({ role: 'deployer', tool: 'read_repository' });
    expect(result.allow).toBe(true);
    expect(toDecision(result)).toBe('allow');
  });

  test('deployer allowed on get-prefixed tool', () => {
    const result = evaluatePolicy({ role: 'deployer', tool: 'get_config' });
    expect(result.allow).toBe(true);
    expect(toDecision(result)).toBe('allow');
  });

  test('deployer needs approval on deploy_production', () => {
    const result = evaluatePolicy({ role: 'deployer', tool: 'deploy_production' });
    expect(result.needs_approval).toBe(true);
    expect(toDecision(result)).toBe('needs_approval');
  });

  test('deployer needs approval on delete_repository', () => {
    const result = evaluatePolicy({ role: 'deployer', tool: 'delete_repository' });
    expect(result.needs_approval).toBe(true);
    expect(toDecision(result)).toBe('needs_approval');
  });

  test('deployer denied on unknown tool', () => {
    const result = evaluatePolicy({ role: 'deployer', tool: 'drop_database' });
    expect(result.allow).toBe(false);
    expect(result.needs_approval).toBe(false);
    expect(toDecision(result)).toBe('deny');
  });

  // ─── Unknown role ───────────────────────────────────────────

  test('unknown role denied on read tool', () => {
    const result = evaluatePolicy({ role: 'unknown', tool: 'read_repository' });
    expect(result.allow).toBe(false);
    expect(toDecision(result)).toBe('deny');
  });

  test('unknown role denied on any tool', () => {
    const result = evaluatePolicy({ role: 'admin', tool: 'deploy_production' });
    expect(result.allow).toBe(false);
    // deploy_production only needs_approval for deployer role specifically
    expect(toDecision(result)).toBe('deny');
  });

  // ─── Edge cases ─────────────────────────────────────────────

  test('delete_repository needs approval regardless of role', () => {
    // The rule `needs_approval if { input.tool == "delete_repository" }` has no role guard
    const readerResult = evaluatePolicy({ role: 'reader', tool: 'delete_repository' });
    const deployerResult = evaluatePolicy({ role: 'deployer', tool: 'delete_repository' });
    const unknownResult = evaluatePolicy({ role: 'random', tool: 'delete_repository' });

    expect(readerResult.needs_approval).toBe(true);
    expect(deployerResult.needs_approval).toBe(true);
    expect(unknownResult.needs_approval).toBe(true);
  });

  test('empty tool name is denied', () => {
    const result = evaluatePolicy({ role: 'reader', tool: '' });
    expect(result.allow).toBe(false);
    expect(toDecision(result)).toBe('deny');
  });
});
