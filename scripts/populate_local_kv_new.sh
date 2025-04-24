#!/bin/bash

# Simple script to add/update a key-value pair in a local KV namespace using Wrangler.
# Usage: ./scripts/set-local-kv.sh <NAMESPACE_ID> <KEY> <VALUE>
# Example: ./scripts/set-local-kv.sh <your_namespace_id> drivebright_upsell2_normal_campaign_id 169

# --- Configuration ---
# Ensure wrangler is installed and configured.

# --- Arguments ---
NAMESPACE=$1
KEY=$2
VALUE=$3

# --- Validation ---
if [ -z "$NAMESPACE" ]; then
  echo "Error: NAMESPACE_BINDING_NAME argument is required."
  echo "Usage: $0 <NAMESPACE_BINDING_NAME> <KEY> <VALUE>"
  exit 1
fi

if [ -z "$KEY" ]; then
  echo "Error: KEY argument is required."
  echo "Usage: $0 <NAMESPACE_BINDING_NAME> <KEY> <VALUE>"
  exit 1
fi

if [ -z "$VALUE" ]; then
  echo "Error: VALUE argument is required."
  echo "Usage: $0 <NAMESPACE_BINDING_NAME> <KEY> <VALUE>"
  exit 1
fi

# --- Execution ---
echo "Attempting to set key '$KEY' in local namespace '$NAMESPACE'..."

# Use wrangler kv key put with the --namespace-id and --local flags
# Provide the namespace ID directly; no binding configuration needed in wrangler.toml.
# Try adding explicit quotes around each part for the wrangler command
echo "Debug: About to execute Wrangler command with binding '$NAMESPACE', key '$KEY', and value '$VALUE'. Command: npx wrangler kv:key put --binding \"$NAMESPACE\" --local \"$KEY\" \"$VALUE\""
npx wrangler kv key put --namespace-id "$NAMESPACE" --local "$KEY" "$VALUE"

# Check exit status
if [ $? -eq 0 ]; then
  echo "Successfully set '$KEY' = '$VALUE' in local namespace '$NAMESPACE'."
else
  echo "Error: Failed to set key '$KEY' in local namespace '$NAMESPACE'."
  echo "Please ensure wrangler is installed, you are logged in (if needed), and you have the correct namespace ID."
  exit 1
fi

exit 0

# $ ./scripts/populate_local_kv_new.sh PIXEL_CONFIG drivebright_upsell2_normal_campaign_id 169