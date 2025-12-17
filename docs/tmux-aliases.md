# Agent Tmux Session Aliases

Shell functions for managing AI agent sessions in tmux.

## Command Reference

| Command | Description |
|---------|-------------|
| `ag` | Run agent directly (no tmux) |
| `as` | Start human session (auto-increments: agent-1, agent-2, ...) |
| `asd` | Start IPC Developer session (agent-dev) |
| `ast` | Start IPC Tester session (agent-tester) |
| `ask <name>` | Kill a specific agent session by name |
| `asl` | List all agent tmux sessions |
| `asa <name>` | Attach to a specific agent session |
| `aso` | Kill other agent sessions (keeps current) |
| `asx` | Exterminate ALL agent sessions (nuclear) |

## Session Types

### Human Sessions (`as`)

For interactive human use. Sessions are numbered: `agent-1`, `agent-2`, etc.

```bash
as   # Creates agent-N and attaches
```

### IPC Sessions (`asd`, `ast`)

For multi-agent collaboration. Sessions use role names and start in the current directory.

```bash
asd  # Creates agent-dev in $(pwd) and attaches
ast  # Creates agent-tester in $(pwd) and attaches
```

IPC sessions trigger hooks and follow the protocol defined in `prompts/protocol.md`.

## Installation

Add the following to your shell aliases file (e.g., `~/.aliases`, `~/.zshrc`, or `~/.bashrc`):

```bash
## Agent aliases (runs claude, uses agent-* session naming)
alias ag='claude'

# Agent in tmux with auto-incrementing session names (human use)
as() {
    local max=0
    local session_name

    # Find all existing claude sessions and get the highest number
    while IFS= read -r line; do
        if [[ "$line" =~ ^agent-([0-9]+): ]]; then
            num="${BASH_REMATCH[1]:-${match[1]}}"
            (( num > max )) && max=$num
        elif [[ "$line" =~ ^agent: ]]; then
            # Handle bare "agent" session as agent-0
            (( 0 > max )) || max=$((max > 0 ? max : 0))
        fi
    done < <(tmux list-sessions 2>/dev/null)

    # Increment for new session
    session_name="agent-$((max + 1))"

    # Create new tmux session and run claude
    tmux new-session -d -s "$session_name" "claude"
    tmux attach-session -t "$session_name"
}

# Start IPC Developer session (with auto-initialization)
asd() {
    if tmux has-session -t "agent-dev" 2>/dev/null; then
        echo "agent-dev session already exists. Attaching..."
        tmux attach-session -t "agent-dev"
    else
        echo "Starting Agent IPC Developer session..."
        tmux new-session -d -s "agent-dev" -c "$(pwd)" "claude"
        sleep 2  # Wait for agent to initialize and hooks to run
        tmux send-keys -t "agent-dev" "Initialize: Agent IPC Developer Session" Enter
        tmux attach-session -t "agent-dev"
    fi
}

# Start IPC Tester session (with auto-initialization)
ast() {
    if tmux has-session -t "agent-tester" 2>/dev/null; then
        echo "agent-tester session already exists. Attaching..."
        tmux attach-session -t "agent-tester"
    else
        echo "Starting Agent IPC Tester session..."
        tmux new-session -d -s "agent-tester" -c "$(pwd)" "claude"
        sleep 2  # Wait for agent to initialize and hooks to run
        tmux send-keys -t "agent-tester" "Initialize: Agent IPC Tester Session" Enter
        tmux attach-session -t "agent-tester"
    fi
}

# Kill a specific agent session by name
ask() {
    local target="${1:-}"

    if [[ -z "$target" ]]; then
        echo "Usage: ask <session-name>"
        echo ""
        echo "Available agent sessions:"
        asl
        return 1
    fi

    if tmux kill-session -t "$target" 2>/dev/null; then
        echo "Killed session: $target"
    else
        echo "Session '$target' not found"
        asl
        return 1
    fi
}

# Exterminate all agent tmux sessions (nuclear)
asx() {
    local count=0
    while IFS= read -r session; do
        if [[ "$session" =~ ^agent(-[0-9]+|-[a-z]+(-[0-9]+)?)?$ ]]; then
            tmux kill-session -t "$session" 2>/dev/null && ((count++))
        fi
    done < <(tmux list-sessions -F '#{session_name}' 2>/dev/null)

    if (( count > 0 )); then
        echo "Exterminated $count agent session(s)"
    else
        echo "No agent sessions found"
    fi
}

# Kill other agent tmux sessions (keep current)
aso() {
    local current=$(tmux display-message -p '#{session_name}' 2>/dev/null)
    local count=0
    while IFS= read -r session; do
        if [[ "$session" =~ ^agent(-[0-9]+|-[a-z]+(-[0-9]+)?)?$ && "$session" != "$current" ]]; then
            tmux kill-session -t "$session" 2>/dev/null && ((count++))
        fi
    done < <(tmux list-sessions -F '#{session_name}' 2>/dev/null)

    if (( count > 0 )); then
        echo "Killed $count other agent session(s)"
    else
        echo "No other agent sessions found"
    fi
}

# List all agent tmux sessions
asl() {
    local sessions=$(tmux list-sessions -F '#{session_name}: #{session_windows} window(s) #{?session_attached,(attached),}' 2>/dev/null | grep -E '^agent(-[0-9]+|-[a-z]+(-[0-9]+)?)?:')
    if [[ -n "$sessions" ]]; then
        echo "$sessions"
    else
        echo "No agent sessions found"
    fi
}

# Attach to an agent tmux session
asa() {
    local target="${1:-}"

    if [[ -z "$target" ]]; then
        echo "Usage: asa <session-name>"
        echo ""
        echo "Available agent sessions:"
        asl
        return 1
    fi

    if tmux has-session -t "$target" 2>/dev/null; then
        tmux attach-session -t "$target"
    else
        echo "Session '$target' not found"
        echo ""
        echo "Available agent sessions:"
        asl
        return 1
    fi
}
```

## Activation

After adding to your shell config, reload it:

```bash
source ~/.zshrc
```

## Usage Examples

### Human Sessions

```bash
# Start first agent session
$ as
# Creates agent-1 and attaches

# Open another terminal, start second session
$ as
# Creates agent-2 and attaches

# List all agent sessions
$ asl
agent-1: 1 window(s) (attached)
agent-2: 1 window(s)
```

### IPC Sessions

```bash
# Navigate to project directory first
$ cd ~/projects/agent-ipc

# Start Developer session
$ asd
# Creates agent-dev in project directory and attaches

# In another terminal, start Tester session
$ ast
# Creates agent-tester in project directory and attaches

# List shows both types
$ asl
agent-1: 1 window(s)
agent-dev: 1 window(s) (attached)
agent-tester: 1 window(s)
```

### Cleanup

```bash
# From within a session, kill all others
$ aso
Killed 2 other agent session(s)

# Nuclear option - kills ALL agent sessions including current
$ asx
Exterminated 3 agent session(s)
```

## Notes

- `asx` (exterminate) kills your current session too - use `aso` to keep current
- `asd` and `ast` start in `$(pwd)` so agents have access to project files
- IPC sessions (`agent-dev`, `agent-tester`) trigger protocol hooks
- Human sessions (`agent-N`) do not trigger IPC hooks
- Session numbering always increments from the highest existing number
- Requires tmux and Claude Code CLI to be installed
