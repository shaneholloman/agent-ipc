# Claude IPC Project Instructions

Project-specific instructions for Claude instances working on this codebase.

**Note:** `AGENTS.md` symlinks to this file. Other AI agents (Gemini, Codex, Cline, etc.) use `AGENTS.md` as their convention for project instructions. The symlink ensures all agents read from a single source of truth.

## Project Overview

This is an inter-process communication library for Claude Code sessions running in tmux. The primary audience is **agents**, not humans.

## Key Documentation

| File | Purpose |
|------|---------|
| `prompts/protocol.md` | Communication protocol between agents |
| `prompts/developer.md` | Developer role responsibilities |
| `prompts/tester.md` | Tester role responsibilities |
| `docs/patterns.md` | IPC patterns and discoveries |
| `docs/tmux-aliases.md` | Shell alias definitions |

## IPC Session Detection

Hooks should only activate in IPC mode. Detection logic:

```bash
SESSION=$(tmux display-message -p '#{session_name}' 2>/dev/null)
[[ -z "$SESSION" ]] && exit 0                    # Not in tmux
[[ "$SESSION" =~ ^claude-[0-9]+$ ]] && exit 0    # Human session
# Proceed - this is an IPC session (claude-dev, claude-tester, etc.)
```

Session naming convention:

- `claude-N` (numbered) - Human-interactive sessions, no IPC hooks
- `claude-<role>` (named) - IPC sessions, hooks active

## Shell Aliases

This project uses tmux aliases defined in `docs/tmux-aliases.md`. Users must install these to their shell profile.

| Alias | Command |
|-------|---------|
| `cs` | Start human session (claude-N) |
| `csd` | Start IPC Developer session (claude-dev) |
| `cst` | Start IPC Tester session (claude-tester) |
| `csl` | List all Claude sessions |
| `csa` | Attach to session |
| `cso` | Kill others, keep current |
| `csx` | Exterminate ALL sessions |

### Shane's Setup

Shane's aliases are located at: `~/.cops/config/zsh/.aliases`

This is a symlinked configuration managed by his dotfiles. Other users will have different paths (e.g., `~/.zshrc`, `~/.bashrc`, `~/.aliases`).

## Development Commands

```bash
pnpm install          # Install dependencies
pnpm run build        # Compile TypeScript
pnpm run test         # Run vitest tests
pnpm run cli <cmd>    # Run CLI commands
```

## Protocol Message Format

All structured IPC messages follow:

```
[PROTOCOL:<TYPE>] from <session> at <timestamp>
<content>
```

Types: `STATUS_UPDATE`, `CONTEXT_COMPACTION`, `TASK_HANDOFF`, `ERROR_NOTICE`, `HEARTBEAT`

## Critical Reminders

1. **Hooks require session restart** - After modifying hooks, the Claude session must be restarted for changes to take effect

2. **Always check responses** - After sending IPC messages, wait and read the response. Never fire-and-forget.

3. **Explicit commands over aliases** - In protocol documentation, always show the actual tmux commands. Note aliases as optional shorthand. Agents need to see what actually executes.

4. **Documentation standards** - Files in `docs/` use lowercase-with-dashes. Standard convention files (README.md, CHANGELOG.md, LICENSE) stay uppercase at root.
