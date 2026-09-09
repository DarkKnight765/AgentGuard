package agentguard

default allow = false
default needs_approval = false

# Readers can call anything prefixed "read" or "get"
allow if {
  input.role == "reader"
  startswith(input.tool, "read")
}

allow if {
  input.role == "reader"
  startswith(input.tool, "get")
}

# Deployers can read freely, but risky actions need approval
allow if {
  input.role == "deployer"
  startswith(input.tool, "read")
}

allow if {
  input.role == "deployer"
  startswith(input.tool, "get")
}

needs_approval if {
  input.role == "deployer"
  input.tool == "deploy_production"
}

needs_approval if {
  input.tool == "delete_repository"
}

# Everything not explicitly allowed or flagged for approval is denied by default.
