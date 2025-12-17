# Claude Code Hooks

This directory contains hook scripts for Claude Code sessions. These hooks enable the IPC (Inter-Process Communication) system for multi-agent collaboration.

## Required Global Hook

The IPC system depends on `ipc-context.sh` which injects AGENTS.md content at session start. This hook should be installed **globally** (not in this project) to avoid double-injection.

**Location:** `~/.claude/hooks/ipc-context.sh`

**Script content:**

```bash
#!/bin/bash

# Injects AGENTS.md from current directory or parent directories at session start

SEARCH_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"

# Function to search upward for AGENTS.md
find_agents_md() {
    local dir="$1"
    while [[ "$dir" != "/" ]]; do
        if [[ -f "$dir/AGENTS.md" ]]; then
            echo "$dir/AGENTS.md"
            return 0
        fi
        dir=$(dirname "$dir")
    done
    return 1
}

# Try to find AGENTS.md
AGENTS_FILE=$(find_agents_md "$SEARCH_DIR")

if [[ -n "$AGENTS_FILE" ]]; then
    CONTENT=$(cat "$AGENTS_FILE")
    # Output as structured JSON with additionalContext field - ONLY to stdout
    jq -n --arg content "$CONTENT" --arg path "$AGENTS_FILE" '{
        hookSpecificOutput: {
            hookEventName: "SessionStart",
            additionalContext: ("# AGENTS.md Context\n\nLocated at: " + $path + "\n\n" + $content + "\n\n---\n")
        }
    }'
fi
```

**Global settings registration** (`~/.claude/settings.json`):

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/hooks/ipc-context.sh",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

**Why global?** This hook searches for AGENTS.md in any project. Installing it globally means it works across all your projects without duplication.

## Project Hook Scripts

| Script | Trigger | Purpose |
|--------|---------|---------|
| `ipc-state.sh` | SessionStart, Stop | Detects IPC sessions, creates session state files, generates persistent descriptors |

## Installation

### Option 1: Symlink (Recommended)

Create a symlink from `.claude/hooks/` to this directory:

```bash
# From project root
rm -rf .claude/hooks
ln -s ../hooks .claude/hooks
```

This ensures changes to hook scripts are immediately reflected without copying.

### Option 2: Copy

Copy hook scripts to the Claude hooks directory:

```bash
# From project root
mkdir -p .claude/hooks
cp hooks/*.sh .claude/hooks/
chmod +x .claude/hooks/*.sh
```

Note: With this method, you must re-copy after any changes to hook scripts.

## Hook Details

### ipc-state.sh

**Triggers:** `SessionStart`, `Stop`

**What it does:**

1. Reads hook input JSON from stdin (provided by Claude Code)
2. Detects the tmux session name
3. Determines if this is an IPC session (`agent-dev`, `agent-tester`, etc.)
4. On SessionStart:
   - Generates a three-word descriptor (e.g., `brave-amber-fox`)
   - Writes session state to `logs/.session-<tmux_session>`
   - Logs the event to `logs/events.jsonl`
5. On Stop:
   - Cleans up the session state file
   - Logs the stop event

**Session state file format:**

```json
{
  "tmux_session": "agent-dev",
  "role": "developer",
  "ipc_mode": true,
  "descriptor": "brave-amber-fox",
  "started_at": "2025-12-17T07:53:56Z",
  "session_id": "abc123"
}
```

## Settings Configuration

The hooks must be registered in `.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/ipc-state.sh",
            "timeout": 10
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/ipc-state.sh",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

## Adding New Hooks

1. Create the script in this `hooks/` directory
2. Make it executable: `chmod +x hooks/your-hook.sh`
3. Register it in `.claude/settings.json`
4. If using copy method, re-copy to `.claude/hooks/`
5. Restart the Claude session (hooks only activate on session start)

## Testing Hooks

To test a hook manually:

```bash
# Simulate SessionStart event
echo '{"hook_event_name": "SessionStart", "session_id": "test-123"}' | ./hooks/ipc-state.sh

# Check results
cat logs/.session-agent-dev
cat logs/events.jsonl
```

## Troubleshooting

**Hook not running:**

- Verify the hook is registered in `.claude/settings.json`
- Check that the script is executable (`chmod +x`)
- Restart the Claude session (hooks register at startup)

**Permission denied:**

```bash
chmod +x hooks/*.sh
chmod +x .claude/hooks/*.sh
```

**Hook output not appearing:**

- Hook stdout becomes "additional context" in system reminders
- Hook stderr is logged but not shown to the agent
- Exit code 0 = success, non-zero = failure
