package agentguard

import data.agentguard.allow
import data.agentguard.needs_approval

# Readers can call anything prefixed "read" or "get"
# Deployers can read freely, but risky actions need approval
# Everything not explicitly allowed or flagged for approval is denied by default.
