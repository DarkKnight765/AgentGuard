import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// The base Rego policy source (from spec §11).
// Stored in the Policy table for display purposes in the dashboard.
const BASE_REGO = `package agentguard

default allow = false
default needs_approval = false

# Readers can call anything prefixed "read" or "get"
allow {
  input.role == "reader"
  startswith(input.tool, "read")
}

allow {
  input.role == "reader"
  startswith(input.tool, "get")
}

# Deployers can read freely, but risky actions need approval
allow {
  input.role == "deployer"
  startswith(input.tool, "read")
}

needs_approval {
  input.role == "deployer"
  input.tool == "deploy_production"
}

needs_approval {
  input.tool == "delete_repository"
}

# Everything not explicitly allowed or flagged for approval is denied by default.
`;

/**
 * Generate an API key and its SHA-256 hash.
 */
function generateApiKey(): { plaintext: string; hash: string } {
  const plaintext = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(plaintext).digest('hex');
  return { plaintext, hash };
}

async function seed() {
  console.log('🌱 Seeding AgentGuard database...\n');

  // Clean existing data
  await prisma.approval.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.policy.deleteMany();
  await prisma.agent.deleteMany();

  // ── ResearchAgent (reader) ──────────────────────────────────

  const researchKey = generateApiKey();
  const researchAgent = await prisma.agent.create({
    data: {
      name: 'ResearchAgent',
      owner: 'research-team',
      role: 'reader',
      apiKeyHash: researchKey.hash,
      policies: {
        create: {
          regoSource: BASE_REGO,
          version: 1,
        },
      },
    },
  });

  // ── DeploymentAgent (deployer) ──────────────────────────────

  const deployKey = generateApiKey();
  const deployAgent = await prisma.agent.create({
    data: {
      name: 'DeploymentAgent',
      owner: 'platform-team',
      role: 'deployer',
      apiKeyHash: deployKey.hash,
      policies: {
        create: {
          regoSource: BASE_REGO,
          version: 1,
        },
      },
    },
  });

  // ── Print results ───────────────────────────────────────────

  console.log('✅ Agents created:\n');

  console.log(`  📋 ResearchAgent (reader)`);
  console.log(`     ID:      ${researchAgent.id}`);
  console.log(`     API Key: ${researchKey.plaintext}`);
  console.log();

  console.log(`  📋 DeploymentAgent (deployer)`);
  console.log(`     ID:      ${deployAgent.id}`);
  console.log(`     API Key: ${deployKey.plaintext}`);
  console.log();

  console.log('⚠️  Save these API keys — they cannot be recovered after this.\n');
}

seed()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
