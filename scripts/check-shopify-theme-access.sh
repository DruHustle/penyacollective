#!/usr/bin/env bash

set -euo pipefail

theme_id="${SHOPIFY_THEME_ID_TO_CHECK:-}"
theme_secret_name="${SHOPIFY_THEME_SECRET_NAME:-SHOPIFY_THEME_ID}"
theme_label="${SHOPIFY_THEME_LABEL:-theme}"

if [ -z "${SHOPIFY_CLI_THEME_TOKEN:-}" ]; then
  echo "::error::SHOPIFY_CLI_THEME_TOKEN is not set. Add a valid Shopify CLI theme token in GitHub Secrets."
  exit 1
fi

if [ -z "${SHOPIFY_STORE_DOMAIN:-}" ]; then
  echo "::error::SHOPIFY_STORE_DOMAIN is not set. Use the raw *.myshopify.com store domain."
  exit 1
fi

if [ -z "$theme_id" ]; then
  echo "::error::${theme_secret_name} is not set. Add the numeric Shopify theme ID in GitHub Secrets."
  exit 1
fi

if [[ "$SHOPIFY_STORE_DOMAIN" =~ ^https?:// ]]; then
  echo "::error::SHOPIFY_STORE_DOMAIN must not include http:// or https://. Use the raw *.myshopify.com domain."
  exit 1
fi

if [[ "$SHOPIFY_STORE_DOMAIN" == */* ]]; then
  echo "::error::SHOPIFY_STORE_DOMAIN must not include a trailing slash or path. Use only the raw *.myshopify.com domain."
  exit 1
fi

if [[ ! "$SHOPIFY_STORE_DOMAIN" =~ ^[A-Za-z0-9][A-Za-z0-9-]*\.myshopify\.com$ ]]; then
  echo "::error::SHOPIFY_STORE_DOMAIN must look like your-store.myshopify.com."
  exit 1
fi

if [[ ! "$theme_id" =~ ^[0-9]+$ ]]; then
  echo "::error::${theme_secret_name} must be a numeric Shopify theme ID. Found '$theme_id'."
  exit 1
fi

set +e
theme_list_output="$(shopify theme list --store "$SHOPIFY_STORE_DOMAIN" --no-color 2>&1)"
status=$?
set -e
normalized_output="$(printf '%s' "$theme_list_output" | tr '\r\n' ' ')"

if [ "$status" -ne 0 ]; then
  if printf '%s' "$normalized_output" | grep -Eqi 'Invalid API key|unrecognized login|wrong[[:space:]]+password|status[" ]*:[ ]*401|Error[[:space:]]*\(Code:[[:space:]]*401\)|401 undefined'; then
    echo "::error::Shopify CLI authentication failed for $SHOPIFY_STORE_DOMAIN while checking the ${theme_label}. Verify SHOPIFY_CLI_THEME_TOKEN and SHOPIFY_STORE_DOMAIN. The token must belong to this exact store and the domain must be the raw *.myshopify.com value."
  else
    echo "::error::Shopify CLI could not verify access to $SHOPIFY_STORE_DOMAIN while checking the ${theme_label}."
  fi

  printf '%s\n' "$theme_list_output"
  exit "$status"
fi

if ! printf '%s\n' "$theme_list_output" | grep -Eq "(^|[^0-9])#?${theme_id}([^0-9]|$)"; then
  echo "::error::${theme_secret_name}=$theme_id was not found on $SHOPIFY_STORE_DOMAIN. Run 'shopify theme list --store $SHOPIFY_STORE_DOMAIN' and update the secret."
  printf '%s\n' "$theme_list_output"
  exit 1
fi

echo "Verified ${theme_label} access for theme ID ${theme_id} on ${SHOPIFY_STORE_DOMAIN}."
