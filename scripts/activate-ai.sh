#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
WEB_DIR="$ROOT_DIR/orbital-harmony-app"
IOS_WWW_DIR="$ROOT_DIR/ios/OrbitalHarmony/Resources/www"

cd "$ROOT_DIR"

for command_name in node npm npx curl rsync; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    exit 1
  fi
done

vercel() {
  npx --yes vercel@latest "$@"
}

echo "==> Authenticating with Vercel"
if ! vercel whoami >/dev/null 2>&1; then
  vercel login
fi

if [[ ! -f .vercel/project.json ]]; then
  echo "==> Linking this repository root to a Vercel project"
  echo "    Select your existing project when prompted, or create a new one."
  vercel link
fi

read -r -s -p "Paste your OpenAI API key (input hidden): " OPENAI_KEY
printf '\n'
if [[ -z "$OPENAI_KEY" ]]; then
  echo "No API key entered; nothing was changed." >&2
  exit 1
fi
trap 'unset OPENAI_KEY' EXIT

echo "==> Configuring production environment variables"
vercel env add AI_PROVIDER production --value openai --force --no-sensitive --yes
printf '%s' "$OPENAI_KEY" \
  | vercel env add OPENAI_API_KEY production --force --sensitive --yes
unset OPENAI_KEY
vercel env add OPENAI_MODEL production --value gpt-4.1-mini --force --no-sensitive --yes
vercel env add TRIVIA_ALLOWED_ORIGINS production --value 'orbital://app' --force --no-sensitive --yes

echo "==> Deploying to production"
DEPLOY_URL="$(vercel --prod --yes)"
DEPLOY_URL="${DEPLOY_URL%/}"

echo "==> Verifying server configuration and a real AI response"
HEALTH_JSON="$(curl --fail --silent --show-error "$DEPLOY_URL/api/trivia")"
TRIVIA_JSON="$(curl --fail --silent --show-error \
  --request POST \
  --header 'Content-Type: application/json' \
  --data '{"kind":"birthday","month":2,"day":21}' \
  "$DEPLOY_URL/api/trivia")"

node - "$HEALTH_JSON" "$TRIVIA_JSON" <<'NODE'
const health = JSON.parse(process.argv[2]);
const trivia = JSON.parse(process.argv[3]);
if (!health.configured) throw new Error('The deployed AI provider is not configured.');
if (!trivia.generatedBy || !trivia.fact) throw new Error('The deployed API did not return AI trivia.');
console.log(`    Provider: ${health.provider} (${health.model})`);
console.log(`    Sample: ${trivia.fact}`);
NODE

echo "==> Saving the public endpoint for local web and iOS builds"
printf 'VITE_TRIVIA_API_URL=%s/api/trivia\n' "$DEPLOY_URL" > "$WEB_DIR/.env.local"

echo "==> Testing and rebuilding the web app"
(
  cd "$WEB_DIR"
  npm run test:ai
  npm run lint
  npm run build
)

echo "==> Synchronizing the iOS web bundle"
rsync -a --delete "$WEB_DIR/dist/" "$IOS_WWW_DIR/"
diff -qr "$WEB_DIR/dist" "$IOS_WWW_DIR"

cat <<EOF

AI trivia is active.
Web app: $DEPLOY_URL
API:     $DEPLOY_URL/api/trivia

Restart the current Vite development server so it reloads
orbital-harmony-app/.env.local. AI cards will display:
"AI-curated · Wikipedia CC BY-SA"
EOF