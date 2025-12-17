#!/usr/bin/env bash
# Hook: Log session events and optionally notify collaborators
# Triggered by: SessionStart, Stop
#
# IMPORTANT: Hooks only become active after session restart

set -e

# Read hook input from stdin
INPUT=$(cat)

# Extract event info
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"')
EVENT_TYPE=$(echo "$INPUT" | jq -r '.hook_event_name // "unknown"')
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Log to shared event file
LOG_DIR="$HOME/.claude/ipc-events"
mkdir -p "$LOG_DIR"

EVENT_LOG="$LOG_DIR/events.jsonl"
echo "{\"event\":\"$EVENT_TYPE\",\"session\":\"$SESSION_ID\",\"timestamp\":\"$TIMESTAMP\"}" >> "$EVENT_LOG"

# Optional: Broadcast to other sessions via claude-ipc CLI
# Uncomment when the CLI is globally installed
# if command -v claude-ipc &> /dev/null; then
#   claude-ipc broadcast "[SESSION:$EVENT_TYPE] $SESSION_ID at $TIMESTAMP"
# fi

exit 0
