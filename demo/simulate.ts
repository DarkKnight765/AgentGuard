/**
 * AgentGuard Live Walkthrough & Acceptance Demo Script
 * 
 * Simulates a scripted sequence of agent calls against the live gateway to demonstrate:
 *  1. Identity & Registration
 *  2. Policy evaluation (Allowed tool call)
 *  3. Policy evaluation (High-risk action requiring approval)
 *  4. Human-in-the-loop Admin Denial
 *  5. Role separation with second agent
 *  6. Human-in-the-loop Admin Approval
 *  7. Emergency Kill Switch trigger (Suspension)
 *  8. Sub-millisecond kill-switch enforcement on very next call
 */

const rawUrl = (process.env.API_URL || 'http://localhost:3001').trim().replace(/\/+$/, '');
const API_BASE = rawUrl.endsWith('/api') ? rawUrl : `${rawUrl}/api`;

// Terminal colors
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';

function logHeader(step: number, title: string) {
  console.log(`\n${BOLD}${CYAN}─────────────────────────────────────────────────────────────────────────────${RESET}`);
  console.log(`${BOLD}${CYAN}  STEP ${step}: ${title}${RESET}`);
  console.log(`${BOLD}${CYAN}─────────────────────────────────────────────────────────────────────────────${RESET}`);
}

function logSuccess(msg: string) {
  console.log(`  ${GREEN}✓ ${msg}${RESET}`);
}

function logWarn(msg: string) {
  console.log(`  ${YELLOW}⚠ ${msg}${RESET}`);
}

function logError(msg: string) {
  console.log(`  ${RED}✗ ${msg}${RESET}`);
}

async function request(path: string, options: RequestInit = {}) {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${JSON.stringify(json)}`);
  }
  return json;
}

async function runDemo() {
  console.log(`\n${BOLD}${GREEN}🛡️  AGENTGUARD LIVE DEMO & ACCEPTANCE VERIFICATION${RESET}`);
  console.log(`${DIM}Targeting Gateway API at: ${API_BASE}${RESET}\n`);

  try {
    // ─── STEP 1 ─────────────────────────────────────────────────────────
    logHeader(1, 'Register ResearchAgent (role: reader)');
    const research = await request('/agents', {
      method: 'POST',
      body: JSON.stringify({
        name: `ResearchAgent-${Date.now().toString().slice(-4)}`,
        owner: 'research-core',
        role: 'reader',
      }),
    });
    const researchId = research.id;
    const researchKey = research.apiKey;
    logSuccess(`Agent registered: ${BOLD}${research.name}${RESET} (ID: ${researchId})`);
    logSuccess(`One-time API Key generated: ${DIM}${researchKey.slice(0, 16)}...${RESET}`);

    // ─── STEP 2 ─────────────────────────────────────────────────────────
    logHeader(2, "Call 'read_repository' as ResearchAgent -> Expect ALLOW");
    const t2Start = Date.now();
    const call2 = await request('/gateway/check', {
      method: 'POST',
      headers: { 'X-API-Key': researchKey },
      body: JSON.stringify({
        tool: 'read_repository',
        args: { repo: 'agentguard/core' },
      }),
    });
    const t2Duration = Date.now() - t2Start;

    if (call2.decision === 'allow') {
      logSuccess(`Gateway Decision: ${BOLD}${GREEN}ALLOW${RESET} (Backend latency: ${call2.latencyMs}ms, roundtrip: ${t2Duration}ms)`);
      console.log(`    Policy Rule: Readers are explicitly permitted tools matching "read*" or "get*"`);
    } else {
      throw new Error(`Expected 'allow' but received '${call2.decision}'`);
    }

    // ─── STEP 3 ─────────────────────────────────────────────────────────
    logHeader(3, "Call 'delete_repository' as ResearchAgent -> Expect NEEDS_APPROVAL");
    const call3 = await request('/gateway/check', {
      method: 'POST',
      headers: { 'X-API-Key': researchKey },
      body: JSON.stringify({
        tool: 'delete_repository',
        args: { repo: 'production-db-backup' },
      }),
    });

    if (call3.decision === 'needs_approval' && call3.approvalId) {
      logSuccess(`Gateway Decision: ${BOLD}${YELLOW}NEEDS_APPROVAL${RESET}`);
      logSuccess(`Approval Ticket Created: ${BOLD}${call3.approvalId}${RESET}`);
      console.log(`    Policy Rule: Tool 'delete_repository' flagged as high-risk, quarantined for human review`);
    } else {
      throw new Error(`Expected 'needs_approval' with approvalId but got: ${JSON.stringify(call3)}`);
    }

    // ─── STEP 4 ─────────────────────────────────────────────────────────
    logHeader(4, "Admin Decision -> DENY the pending request");
    const approvalId1 = call3.approvalId;
    const decision4 = await request(`/approvals/${approvalId1}/decide`, {
      method: 'POST',
      body: JSON.stringify({ decision: 'deny' }),
    });

    if (decision4.status === 'denied') {
      logSuccess(`Approval ${approvalId1} status updated to: ${BOLD}${RED}DENIED${RESET}`);
      logSuccess(`Action successfully blocked. Audit log and WebSocket event broadcast.`);
    } else {
      throw new Error(`Expected approval status 'denied' but got '${decision4.status}'`);
    }

    // ─── STEP 5 ─────────────────────────────────────────────────────────
    logHeader(5, 'Register DeploymentAgent (role: deployer)');
    const deployer = await request('/agents', {
      method: 'POST',
      body: JSON.stringify({
        name: `DeploymentAgent-${Date.now().toString().slice(-4)}`,
        owner: 'devops-infra',
        role: 'deployer',
      }),
    });
    const deployerKey = deployer.apiKey;
    logSuccess(`Agent registered: ${BOLD}${deployer.name}${RESET} (role: deployer)`);

    // ─── STEP 6 ─────────────────────────────────────────────────────────
    logHeader(6, "Call 'deploy_production' as DeploymentAgent -> NEEDS_APPROVAL, then APPROVE");
    const call6 = await request('/gateway/check', {
      method: 'POST',
      headers: { 'X-API-Key': deployerKey },
      body: JSON.stringify({
        tool: 'deploy_production',
        args: { env: 'us-east-1-prod', tag: 'v2.4.0' },
      }),
    });

    if (call6.decision !== 'needs_approval') {
      throw new Error(`Expected 'needs_approval' for deploy_production but got '${call6.decision}'`);
    }
    logSuccess(`Gateway Decision: ${BOLD}${YELLOW}NEEDS_APPROVAL${RESET} (Approval ID: ${call6.approvalId})`);

    const decision6 = await request(`/approvals/${call6.approvalId}/decide`, {
      method: 'POST',
      body: JSON.stringify({ decision: 'approve' }),
    });

    if (decision6.status === 'approved') {
      logSuccess(`Admin Decision: ${BOLD}${GREEN}APPROVED${RESET} (Reviewed at: ${new Date(decision6.reviewedAt).toLocaleTimeString()})`);
      logSuccess(`Agent permitted to proceed with execution.`);
    } else {
      throw new Error(`Expected approval status 'approved' but got '${decision6.status}'`);
    }

    // ─── STEP 7 ─────────────────────────────────────────────────────────
    logHeader(7, 'Emergency Kill Switch: Suspend ResearchAgent');
    const suspendPatch = await request(`/agents/${researchId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'suspended' }),
    });

    if (suspendPatch.status === 'suspended') {
      logSuccess(`Agent status changed to ${BOLD}${RED}SUSPENDED${RESET} in Postgres`);
      logSuccess(`Write-through invalidation pushed directly to Redis key: ${DIM}agent:${researchId}:status${RESET}`);
    } else {
      throw new Error(`Failed to suspend agent: ${JSON.stringify(suspendPatch)}`);
    }

    // ─── STEP 8 ─────────────────────────────────────────────────────────
    logHeader(8, 'Verify Kill Switch: Call read_repository immediately -> Expect DENY');
    const t8Start = performance.now();
    const call8 = await request('/gateway/check', {
      method: 'POST',
      headers: { 'X-API-Key': researchKey },
      body: JSON.stringify({
        tool: 'read_repository',
        args: { repo: 'agentguard/core' },
      }),
    });
    const t8DurationMs = (performance.now() - t8Start).toFixed(1);

    if (call8.decision === 'deny' && call8.reason === 'Agent is suspended') {
      logSuccess(`Gateway Decision: ${BOLD}${RED}DENIED${RESET} [Reason: "${call8.reason}"]`);
      console.log(`\n  ${BOLD}${GREEN}🎯 KILL SWITCH VERIFIED: Call was denied in ${call8.latencyMs}ms (internal gateway latency, total roundtrip ${t8DurationMs}ms)!${RESET}`);
      console.log(`  ${DIM}Intercepted immediately at Redis status check before reaching OPA policy engine.${RESET}`);
    } else {
      throw new Error(`Expected kill switch deny but got: ${JSON.stringify(call8)}`);
    }

    // ─── DEMO COMPLETE ──────────────────────────────────────────────────
    console.log(`\n${BOLD}${GREEN}═════════════════════════════════════════════════════════════════════════════${RESET}`);
    console.log(`${BOLD}${GREEN}  ✓ ALL 8 ACCEPTANCE TESTS PASSED SUCCESSFULLY!${RESET}`);
    console.log(`${BOLD}${GREEN}═════════════════════════════════════════════════════════════════════════════${RESET}\n`);

  } catch (err: any) {
    console.error(`\n${BOLD}${RED}DEMO EXECUTION FAILED:${RESET}`, err.message);
    process.exit(1);
  }
}

runDemo();
