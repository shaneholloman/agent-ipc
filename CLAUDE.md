# Claude IPC Project Instructions

Project-specific instructions for Claude instances working on this codebase.

**Note:** `AGENTS.md` symlinks to this file. Other AI agents (Gemini, Codex, Cline, etc.) use `AGENTS.md` as their convention for project instructions. The symlink ensures all agents read from a single source of truth.

## AUTOMATIC STARTUP - EXECUTE IMMEDIATELY

**When you see `Initialize: Agent IPC Developer Session` or `Initialize: Agent IPC Tester Session` as the first message, this is an auto-initialization prompt. You MUST immediately execute the startup sequence below and announce readiness.**

### Startup Sequence

1. **Check for session state**: Read `logs/.session-<tmux_session>` if it exists (created by startup hook)

   For example, `logs/.session-claude-dev` or `logs/.session-claude-tester`. Each IPC session gets its own state file to avoid collisions when running multiple agents.

   The state file contains:

   ```json
   {
     "tmux_session": "claude-dev",
     "role": "developer",
     "ipc_mode": true,
     "descriptor": "brave-amber-fox",
     "started_at": "2025-12-17T07:53:56Z",
     "session_id": "abc123"
   }
   ```

   The `descriptor` is generated ONCE at session start and persists for the entire IPC session. This ensures all log entries go to the same JSONL file (`logs/<descriptor>.jsonl`) even if context is compacted and the agent restarts.

2. **Or detect via tmux**: Run `tmux display-message -p '#{session_name}'`

3. **Role assignment**:
   - `claude-dev` or `claude-dev-N` → Developer. Read `prompts/developer.md` and `prompts/protocol.md`
   - `claude-tester` or `claude-tester-N` → Tester. Read `prompts/tester.md` and `prompts/protocol.md`
   - `claude-N` (numbered) or not in tmux → Human-interactive mode, no IPC protocol

4. **Announce readiness**: Display a clear status announcement (see format below)

5. **Logging is automatic**: Every IPC operation writes to `logs/<descriptor>.jsonl`

### Required Announcement Format

After completing the startup sequence, display this announcement:

```
AGENT IPC SESSION INITIALIZED

| Property | Value |
|----------|-------|
| Session | <tmux_session> |
| Role | <Developer/Tester> |
| Descriptor | <three-word-descriptor> |
| IPC Mode | Active |
| Log File | logs/<descriptor>.jsonl |

This is a multi-agent peer programming session. Other agents may join:
- Developer (claude-dev): Implements features, drives development
- Tester (claude-tester): Reviews code, validates changes

Ready for <development/testing> tasks.
```

This announcement:

- Confirms the IPC session is active
- Shows the agent's identity and role
- Explains the multi-agent collaboration context
- Signals readiness to the user

This is not optional. The IPC protocol requires automatic initialization and announcement.

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
| `csk <name>` | Kill a specific session |
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

## Session Lifecycle (Automatic)

The IPC system handles session lifecycle automatically via a two-stage initialization:

### Stage 1: Hook Initialization

When `csd` or `cst` alias runs:

1. **tmux session created** with role-based name (`claude-dev`, `claude-tester`)
2. **Claude starts** in the tmux session
3. **SessionStart hook fires** → detects tmux session → writes `logs/.session-<name>` with role and persistent descriptor
4. **Context injected** → CLAUDE.md instructions appear in system reminders

### Stage 2: Auto-Initialization Prompt

After a 2-second delay:

1. **Alias sends auto-prompt**: `Initialize: Agent IPC Developer Session`
2. **Agent executes startup sequence** → reads session state, role docs
3. **Agent announces readiness** → displays IPC session status to user
4. **User sees confirmation** → knows agent is ready for peer programming

### Ongoing Session

- **Logging**: All IPC operations append to `logs/<descriptor>.jsonl`
- **Context Compaction**: Agent restarts → reads same `.session` file → continues with same descriptor
- **SessionStop**: Hook runs → cleans up `.session` file

This two-stage flow ensures:

- Agent automatically initializes without waiting for human input
- User immediately sees confirmation that IPC mode is active
- Role identity persists across context compaction
- No manual configuration required

## Critical Reminders

1. **Hooks require session restart** - After modifying hooks in `.claude/hooks/`, you must kill and restart the tmux session for changes to take effect. The hook is registered at session start.

2. **Always check responses** - After sending IPC messages, wait and read the response. Never fire-and-forget.

3. **Explicit commands over aliases** - In protocol documentation, always show the actual tmux commands. Note aliases as optional shorthand. Agents need to see what actually executes.

4. **Documentation standards** - Files in `docs/` use lowercase-with-dashes. Standard convention files (README.md, CHANGELOG.md, LICENSE) stay uppercase at root.

5. **Log file per IPC session** - The descriptor is generated ONCE at session start. Even if the agent restarts (context compaction), the same log file is used. This is handled automatically.
