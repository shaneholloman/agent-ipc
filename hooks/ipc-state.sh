#!/usr/bin/env bash
# Hook: Auto-detect IPC mode and initialize session state
# Triggered by: SessionStart, Stop
#
# This hook:
# 1. Detects if we're in an IPC session (agent-dev, agent-tester)
# 2. Generates a persistent descriptor for the ENTIRE IPC session
# 3. Writes session state to logs/.session for the agent to read
# 4. Logs events for audit trail
#
# CRITICAL: The descriptor is generated ONCE at SessionStart and persists.
# This ensures all log entries go to the same JSONL file even if the
# agent restarts (context compaction, etc.)

set -e

# Read hook input from stdin
INPUT=$(cat)

# Extract event info
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"')
EVENT_TYPE=$(echo "$INPUT" | jq -r '.hook_event_name // "unknown"')
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Detect tmux session
TMUX_SESSION=$(tmux display-message -p '#{session_name}' 2>/dev/null || echo "")

# Determine IPC mode
IPC_MODE="false"
ROLE=""
if [[ -n "$TMUX_SESSION" ]]; then
  if [[ "$TMUX_SESSION" == "agent-dev" ]]; then
    IPC_MODE="true"
    ROLE="developer"
  elif [[ "$TMUX_SESSION" == "agent-tester" ]]; then
    IPC_MODE="true"
    ROLE="tester"
  elif [[ "$TMUX_SESSION" =~ ^agent-tester-[0-9]+$ ]]; then
    IPC_MODE="true"
    ROLE="tester"
  elif [[ "$TMUX_SESSION" =~ ^agent-dev-[0-9]+$ ]]; then
    IPC_MODE="true"
    ROLE="developer"
  fi
fi

# Ensure logs directory exists
LOGS_DIR="$(pwd)/logs"
mkdir -p "$LOGS_DIR"

# Word lists for three-word descriptor (same as logger-session.ts)
ADJECTIVES=(brave calm dark eager fair gentle happy idle jolly keen lively merry noble odd proud quick rare sharp tall urgent vivid warm young zesty bold crisp deft fine grand hale)
COLORS=(amber blue coral dusk ember frost gold haze iris jade khaki lime mint navy olive pearl quartz rose sage teal umber violet wine azure brass cedar denim fern grape ivory)
ANIMALS=(ant bear crow deer eagle fox goat hawk ibis jay kite lion moth newt owl puma quail raven seal tiger urchin viper wolf yak zebra badger crane dove finch gull)

# Generate three-word descriptor
generate_descriptor() {
  local adj_idx=$((RANDOM % ${#ADJECTIVES[@]}))
  local color_idx=$((RANDOM % ${#COLORS[@]}))
  local animal_idx=$((RANDOM % ${#ANIMALS[@]}))
  echo "${ADJECTIVES[$adj_idx]}-${COLORS[$color_idx]}-${ANIMALS[$animal_idx]}"
}

# Write session state file on start (per-session to avoid collisions)
# Each IPC session gets its own state file: .session-agent-dev, .session-agent-tester, etc.
STATE_FILE="$LOGS_DIR/.session-$TMUX_SESSION"
if [[ "$EVENT_TYPE" == "SessionStart" && "$IPC_MODE" == "true" ]]; then
  # Generate descriptor ONCE for this IPC session
  DESCRIPTOR=$(generate_descriptor)

  cat > "$STATE_FILE" << EOF
{
  "tmux_session": "$TMUX_SESSION",
  "role": "$ROLE",
  "ipc_mode": true,
  "descriptor": "$DESCRIPTOR",
  "started_at": "$TIMESTAMP",
  "session_id": "$SESSION_ID"
}
EOF
fi

# Clean up session state on stop
if [[ "$EVENT_TYPE" == "Stop" && -n "$TMUX_SESSION" ]]; then
  rm -f "$LOGS_DIR/.session-$TMUX_SESSION" 2>/dev/null || true
fi

# Log to event file for audit
EVENT_LOG="$LOGS_DIR/events.jsonl"
echo "{\"event\":\"$EVENT_TYPE\",\"tmux_session\":\"$TMUX_SESSION\",\"role\":\"$ROLE\",\"ipc_mode\":$IPC_MODE,\"timestamp\":\"$TIMESTAMP\"}" >> "$EVENT_LOG"

exit 0
