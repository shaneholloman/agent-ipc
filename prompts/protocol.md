# Multi-Agent Communication Protocol

This document defines communication protocols for AI agents collaborating on `agent-ipc`.

## Roles

| Role      | Session Name                | Responsibility                                |
| --------- | --------------------------- | --------------------------------------------- |
| Developer | `agent-dev`                 | Implements features, drives development       |
| Tester    | `agent-tester`              | Reviews code, validates changes, catches bugs |
| Tester-2  | `agent-tester-2` (optional) | Parallel testing when safe                    |

**Naming Convention:**

- `agent-N` (numbered) - Reserved for human-interactive sessions
- `agent-<role>` (named) - Inter-agent mode sessions with specific roles

**Note:** Actual session names may vary. The onboarding prompt will specify the exact session names in use. When in doubt, check your session name with `tmux display-message -p '#{session_name}'`.

## Workflow Modes

There are two collaboration modes. Know which one you're in.

### SYNC Mode (Same Session)

Developer and Tester share the same Claude Code session, taking turns.

- **Communication**: Plain text messages in the conversation
- **IPC methods**: Not used (no tmux commands needed)
- **Session names**: Both agents are in the same session
- **Use case**: Quick reviews, pair programming, immediate feedback

Example:

```txt
Developer: "Please review src/ipc.ts lines 50-100"
Tester: "REVIEW COMPLETE: Found 2 issues..."
```

### ASYNC Mode (Separate Sessions)

Developer and Tester run in separate tmux sessions.

- **Communication**: Use IPC CLI or TypeScript methods
- **Session names**: `agent-dev`, `agent-tester` (role-based)
- **Use case**: Parallel work, long-running tasks, autonomous agents

Example:

```bash
# Developer sends to Tester
pnpm run cli send agent-tester "Review request: ..."

# Developer checks response
pnpm run cli read agent-tester -n 50
```

Or via TypeScript:

```typescript
ipc.handoffTask("agent-tester", "Review src/ipc.ts", "...", "medium");
```

### How to Know Which Mode

- **SYNC**: Developer and Tester are the same Claude session taking turns
- **ASYNC**: You're in a separate tmux session (check: `tmux display-message -p '#{session_name}'`)
- **Onboarding**: User explicitly tells you the mode in the initial prompt

### The User Role

The **User** (human) orchestrates agent collaboration:

- Spawns tmux sessions
- Sends initial onboarding prompts
- May communicate directly during setup
- Is NOT the "Developer" or "Tester" agent

During onboarding, you're receiving messages from the User.
After setup, agent-to-agent communication uses IPC.

### Bootstrapping Flow (ASYNC Mode)

1. User spawns `agent-dev` session
2. User spawns `agent-tester` session
3. User sends onboarding prompt to each agent
4. Agents read role docs and confirm understanding
5. Developer begins work, uses IPC to communicate with Tester
6. User observes but doesn't intervene unless needed

## Message Types

All protocol messages use the format:

```txt
[PROTOCOL:<TYPE>] from <session> at <timestamp>
<content>
```

### STATUS_UPDATE

Broadcast current work status to all collaborators.

```typescript
ipc.notifyStatus(status, currentTask?, progress?);
```

Status values:

- `idle` - Not actively working
- `working` - Actively implementing/testing
- `blocked` - Waiting on something
- `completed` - Task finished

### CONTEXT_COMPACTION

Notify when conversation context was compacted (summarized).

```typescript
ipc.notifyCompaction(summary, retainedKnowledge[], currentTaskState);
```

This is critical - after compaction, the agent may not recall specific conversation details.

### TASK_HANDOFF

Delegate a task to another agent.

```typescript
ipc.handoffTask(target, task, context, priority);
```

Priority: `low`, `medium`, `high`

### ERROR_NOTICE

Report errors to collaborators.

```typescript
ipc.notifyError(error, recoverable, needsAssistance);
```

## Workflow Protocols

### Feature Development Flow

```flow
Developer                           Tester
    |                                  |
    |-- STATUS_UPDATE: working ------->|
    |                                  |
    | (implements feature)             |
    |                                  |
    |-- TASK_HANDOFF: review --------->|
    |                                  |
    |                  (reviews code)  |
    |                                  |
    |<-------- feedback message -------|
    |                                  |
    | (addresses feedback)             |
    |                                  |
    |-- STATUS_UPDATE: completed ----->|
```

### Context Compaction Flow

When an agent's context compacts:

```flow
Agent (compacted)                  Collaborators
    |                                  |
    |-- CONTEXT_COMPACTION ----------->|
    |   - summary of retained info     |
    |   - current task state           |
    |                                  |
    |<----- (provide context if -------|
    |        needed for continuity)    |
```

### Error Recovery Flow

```flow
Agent (with error)                 Collaborators
    |                                  |
    |-- ERROR_NOTICE ----------------->|
    |   - error description            |
    |   - recoverable: true/false      |
    |   - needsAssistance: true/false  |
    |                                  |
    |<----- (assistance if needed) ----|
```

## Critical: Hook Activation

**Hooks only become active after a Claude session restarts.**

When adding or modifying hooks:

1. Make the changes to `.claude/settings.json` or hook scripts
2. Notify collaborators that hooks were changed
3. **Session must be closed and reopened** for hooks to take effect
4. Verify hooks are working after restart

Example notification:

```txt
HOOK CHANGE NOTICE: Added/modified <hook name>
Location: .claude/hooks/<script>
Action required: Restart session for changes to take effect
```

## Free-Form Messages

Not all communication needs to use protocol messages. Use plain messages for:

- Quick questions
- Clarifications
- Discussion
- Informal coordination

Protocol messages are for structured events that may be parsed or logged.

## Request Protocol

When making requests to another agent:

1. **Be specific** - state exactly what you need
2. **Provide context** - include relevant file paths, line numbers
3. **Set priority** - indicate urgency
4. **Specify response format** - what kind of response you expect

Example:

```txt
REQUEST: Review the new protocol methods in ipc.ts:278-394
Context: Added 4 new methods for multi-agent coordination
Priority: Medium
Expected response: List of issues found, or approval if none
```

## Escalation to User

Escalate to user when:

- Fundamental disagreement between agents
- Major architectural decisions
- Security concerns
- Unclear requirements
- Need for external resources or permissions
- Session restart required for hook changes

## Session Management

### Starting Human-Interactive Sessions

```bash
cs  # Creates agent-N with auto-increment (for human use)
```

### Starting Inter-Agent Sessions

```bash
# Developer session (alias: csd)
tmux new-session -d -s agent-dev -c "$(pwd)" 'claude'
tmux attach -t agent-dev

# Tester session (alias: cst)
tmux new-session -d -s agent-tester -c "$(pwd)" 'claude'
tmux attach -t agent-tester
```

The `-c "$(pwd)"` ensures agents start in the project directory.

### Listing Sessions

```bash
csl  # List all Claude sessions
# Or via CLI
pnpm run cli list
```

### Checking Current Session

```bash
tmux display-message -p '#{session_name}'
```

### Ending Sessions

```bash
# Kill specific session
tmux kill-session -t agent-dev
tmux kill-session -t agent-tester

# Kill others, keep current (alias: cso)
# See docs/tmux-aliases.md for implementation

# Kill ALL sessions (alias: csx)
# See docs/tmux-aliases.md for implementation
```

## Best Practices

1. **Acknowledge messages** - Confirm receipt of handoffs
2. **Be concise** - Don't overwhelm with verbose messages
3. **Stay in role** - Developer implements, Tester validates
4. **Use structured messages** for significant events
5. **Document decisions** - Update docs after architectural choices
6. **Test integrations** - Verify IPC works after changes
7. **Restart after hook changes** - Critical for hooks to take effect
