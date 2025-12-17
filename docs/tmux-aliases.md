# Claude Tmux Session Aliases

Shell functions for managing Claude Code sessions in tmux.

## Command Reference

| Command | Description |
|---------|-------------|
| `c` | Run Claude directly (no tmux) |
| `cs` | Start human session (auto-increments: claude-1, claude-2, ...) |
| `csd` | Start IPC Developer session (claude-dev) |
| `cst` | Start IPC Tester session (claude-tester) |
| `csl` | List all Claude tmux sessions |
| `csa <name>` | Attach to a specific Claude session |
| `cso` | Kill other Claude sessions (keeps current) |
| `csx` | Exterminate ALL Claude sessions (nuclear) |

## Session Types

### Human Sessions (`cs`)

For interactive human use. Sessions are numbered: `claude-1`, `claude-2`, etc.

```bash
cs   # Creates claude-N and attaches
```

### IPC Sessions (`csd`, `cst`)

For multi-agent collaboration. Sessions use role names and start in the current directory.

```bash
csd  # Creates claude-dev in $(pwd) and attaches
cst  # Creates claude-tester in $(pwd) and attaches
```

IPC sessions trigger hooks and follow the protocol defined in `prompts/protocol.md`.

## Installation

Add the following to your shell aliases file (e.g., `~/.aliases`, `~/.zshrc`, or `~/.bashrc`):

```bash
## Claude aliases
alias c='claude'

# Claude in tmux with auto-incrementing session names (human use)
cs() {
    local max=0
    local session_name

    # Find all existing claude sessions and get the highest number
    while IFS= read -r line; do
        if [[ "$line" =~ ^claude-([0-9]+): ]]; then
            num="${BASH_REMATCH[1]:-${match[1]}}"
            (( num > max )) && max=$num
        elif [[ "$line" =~ ^claude: ]]; then
            # Handle bare "claude" session as claude-0
            (( 0 > max )) || max=$((max > 0 ? max : 0))
        fi
    done < <(tmux list-sessions 2>/dev/null)

    # Increment for new session
    session_name="claude-$((max + 1))"

    # Create new tmux session and run claude
    tmux new-session -d -s "$session_name" "claude"
    tmux attach-session -t "$session_name"
}

# Start IPC Developer session
csd() {
    if tmux has-session -t "claude-dev" 2>/dev/null; then
        echo "claude-dev session already exists. Attaching..."
        tmux attach-session -t "claude-dev"
    else
        tmux new-session -d -s "claude-dev" -c "$(pwd)" "claude"
        tmux attach-session -t "claude-dev"
    fi
}

# Start IPC Tester session
cst() {
    if tmux has-session -t "claude-tester" 2>/dev/null; then
        echo "claude-tester session already exists. Attaching..."
        tmux attach-session -t "claude-tester"
    else
        tmux new-session -d -s "claude-tester" -c "$(pwd)" "claude"
        tmux attach-session -t "claude-tester"
    fi
}

# Exterminate all Claude tmux sessions (nuclear)
csx() {
    local count=0
    while IFS= read -r session; do
        if [[ "$session" =~ ^claude(-[0-9]+|-[a-z]+(-[0-9]+)?)?$ ]]; then
            tmux kill-session -t "$session" 2>/dev/null && ((count++))
        fi
    done < <(tmux list-sessions -F '#{session_name}' 2>/dev/null)

    if (( count > 0 )); then
        echo "Exterminated $count Claude session(s)"
    else
        echo "No Claude sessions found"
    fi
}

# Kill other Claude tmux sessions (keep current)
cso() {
    local current=$(tmux display-message -p '#{session_name}' 2>/dev/null)
    local count=0
    while IFS= read -r session; do
        if [[ "$session" =~ ^claude(-[0-9]+|-[a-z]+(-[0-9]+)?)?$ && "$session" != "$current" ]]; then
            tmux kill-session -t "$session" 2>/dev/null && ((count++))
        fi
    done < <(tmux list-sessions -F '#{session_name}' 2>/dev/null)

    if (( count > 0 )); then
        echo "Killed $count other Claude session(s)"
    else
        echo "No other Claude sessions found"
    fi
}

# List all Claude tmux sessions
csl() {
    local sessions=$(tmux list-sessions -F '#{session_name}: #{session_windows} window(s) #{?session_attached,(attached),}' 2>/dev/null | grep -E '^claude(-[0-9]+|-[a-z]+(-[0-9]+)?)?:')
    if [[ -n "$sessions" ]]; then
        echo "$sessions"
    else
        echo "No Claude sessions found"
    fi
}

# Attach to a Claude tmux session
csa() {
    local target="${1:-}"

    if [[ -z "$target" ]]; then
        echo "Usage: csa <session-name>"
        echo ""
        echo "Available Claude sessions:"
        csl
        return 1
    fi

    if tmux has-session -t "$target" 2>/dev/null; then
        tmux attach-session -t "$target"
    else
        echo "Session '$target' not found"
        echo ""
        echo "Available Claude sessions:"
        csl
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
# Start first Claude session
$ cs
# Creates claude-1 and attaches

# Open another terminal, start second session
$ cs
# Creates claude-2 and attaches

# List all Claude sessions
$ csl
claude-1: 1 window(s) (attached)
claude-2: 1 window(s)
```

### IPC Sessions

```bash
# Navigate to project directory first
$ cd ~/projects/claude-ipc

# Start Developer session
$ csd
# Creates claude-dev in project directory and attaches

# In another terminal, start Tester session
$ cst
# Creates claude-tester in project directory and attaches

# List shows both types
$ csl
claude-1: 1 window(s)
claude-dev: 1 window(s) (attached)
claude-tester: 1 window(s)
```

### Cleanup

```bash
# From within a session, kill all others
$ cso
Killed 2 other Claude session(s)

# Nuclear option - kills ALL Claude sessions including current
$ csx
Exterminated 3 Claude session(s)
```

## Notes

- `csx` (exterminate) kills your current session too - use `cso` to keep current
- `csd` and `cst` start in `$(pwd)` so agents have access to project files
- IPC sessions (`claude-dev`, `claude-tester`) trigger protocol hooks
- Human sessions (`claude-N`) do not trigger IPC hooks
- Session numbering always increments from the highest existing number
- Requires tmux and Claude Code CLI to be installed
