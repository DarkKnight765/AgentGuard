#!/bin/bash
# Compile base.rego to WASM bundle.
# Requires: OPA CLI (https://www.openpolicyagent.org/docs/latest/#running-opa)
#
# This runs ONCE on your dev machine. The resulting policy.wasm is committed
# to the repo. There is NO runtime compilation — the backend loads the
# pre-compiled WASM at startup.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "Building OPA WASM bundle..."

opa build -t wasm \
  -e agentguard/allow \
  -e agentguard/needs_approval \
  base.rego \
  -o bundle.tar.gz

mkdir -p out
tar -xzf bundle.tar.gz -C out/

echo "✓ policy.wasm extracted to policies/out/policy.wasm"
ls -la out/policy.wasm
