# Agent IPC Patterns

Documented patterns for agent-to-agent communication via tmux.

## The Key Discovery

Claude Code uses a multi-line TUI input where:

- **Enter** = newline within the input (does not submit)
- **Ctrl+Enter** = submit the prompt

When sending messages programmatically, **text and submit must be separate commands**.

## Working Pattern: Send Message

```bash
# Step 1: Send the message text
tmux send-keys -t <target-session> 'Your message here'

# Step 2: Submit with Ctrl+Enter (MUST be separate command)
tmux send-keys -t <target-session> C-Enter
```

Or chained with `&&`:

```bash
tmux send-keys -t <target-session> 'Your message' && tmux send-keys -t <target-session> C-Enter
```

### What Does NOT Work

```bash
# FAILS - C-Enter in same command is not recognized
tmux send-keys -t <target-session> 'Your message' C-Enter

# PARTIAL - Adds text but does not submit
tmux send-keys -t <target-session> 'Your message' Enter
```

## Working Pattern: Read Response

```bash
# Capture visible pane content
tmux capture-pane -t <target-session> -p

# With scrollback history (last 50 lines)
tmux capture-pane -t <target-session> -p -S -50

# Last 100 lines
tmux capture-pane -t <target-session> -p -S -100
```

## Pattern Summary

| Action | Command | Works |
|--------|---------|-------|
| Send text only | `send-keys "msg"` | Yes (no submit) |
| Send + newline | `send-keys "msg" Enter` | Partial |
| Send + submit (one cmd) | `send-keys "msg" C-Enter` | No |
| Send + submit (two cmds) | `send-keys "msg" && send-keys C-Enter` | Yes |
| Read output | `capture-pane -p` | Yes |

## Session Discovery

```bash
# List all Claude sessions
tmux list-sessions -F '#{session_name}' | grep -E '^claude(-[0-9]+)?$'

# Get current session name
tmux display-message -p '#{session_name}'

# Check if session exists
tmux has-session -t agent-2 2>/dev/null && echo "exists"

# Get session info with attachment status
tmux list-sessions -F '#{session_name}: #{session_windows} window(s) #{?session_attached,(attached),}'
```

## Complete Conversation Flow

```bash
#!/usr/bin/env bash
# Example: Send message and read response

TARGET="agent-2"
MESSAGE="What is the capital of France?"

# Send the message
tmux send-keys -t "$TARGET" "$MESSAGE"
tmux send-keys -t "$TARGET" C-Enter

# Wait for response (adjust based on expected response time)
sleep 5

# Read the response
tmux capture-pane -t "$TARGET" -p -S -20
```

## Bidirectional Communication

Both directions have been tested and confirmed working:

```
claude  -->  agent-2  : Working
claude  <--  agent-2  : Working
```

Each Claude instance can:

1. Send messages to other sessions using `tmux send-keys`
2. Submit with separate `C-Enter` command
3. Read responses using `tmux capture-pane`

## Practical Example: Claude-to-Claude Chat

From the `claude` session, a full exchange looks like:

```bash
# Claude sends to agent-2
tmux send-keys -t agent-2 "Hello, I am Claude from another session. Can you hear me?"
tmux send-keys -t agent-2 C-Enter

# Wait for response
sleep 8

# Read what agent-2 said
tmux capture-pane -t agent-2 -p -S -30
```

Output shows the conversation:

```
> Hello, I am Claude from another session. Can you hear me?

Yes, I can see your message. This is an interesting experiment in
inter-process communication between Claude instances.
```

## Use Cases

- **Task delegation**: One Claude orchestrates, others execute
- **Parallel exploration**: Multiple Claudes explore different approaches
- **Peer review**: One Claude reviews another's work
- **Specialized agents**: Different sessions configured for different tasks

## Limitations

- No shared memory or state between sessions
- Context must be explicitly passed via messages
- Latency from terminal serialization
- Each instance starts fresh (no persistent memory across sessions)

## Multi-Agent Coordination Protocols

The TypeScript library includes built-in protocol methods for structured agent communication.

### Protocol Message Types

All protocol messages follow this format:

```
[PROTOCOL:<TYPE>] from <session> at <ISO timestamp>
<type-specific content>
```

### Context Compaction Notification

When an agent's conversation context is compacted, broadcast to collaborators:

```typescript
ipc.notifyCompaction(
  "Working from summarized context after compaction",
  ["project structure", "pino logging complete", "16 tests passing"],
  "Adding protocol documentation"
);
```

Produces:

```
[PROTOCOL:CONTEXT_COMPACTION] from claude at 2024-01-15T06:15:30.000Z
Summary: Working from summarized context after compaction
Retained: project structure, pino logging complete, 16 tests passing
Current task: Adding protocol documentation
```

### Status Update

Broadcast current status to all collaborators:

```typescript
ipc.notifyStatus("working", "Implementing protocol methods", "80% complete");
```

Produces:

```
[PROTOCOL:STATUS_UPDATE] from claude at 2024-01-15T06:15:30.000Z
Status: working
Task: Implementing protocol methods
Progress: 80% complete
```

Status values: `idle`, `working`, `blocked`, `completed`

### Task Handoff

Delegate a task to a specific agent:

```typescript
ipc.handoffTask(
  "agent-2",
  "Review the protocol implementation",
  "New protocol methods added to ipc.ts - check for edge cases",
  "medium"
);
```

Produces:

```
[PROTOCOL:TASK_HANDOFF] from claude at 2024-01-15T06:15:30.000Z
Task: Review the protocol implementation
Priority: medium
Context: New protocol methods added to ipc.ts - check for edge cases
```

Priority values: `low`, `medium`, `high`

### Error Notice

Broadcast an error to all collaborators:

```typescript
ipc.notifyError(
  "Build failed due to type error in tmux.ts",
  true,
  false
);
```

Produces:

```
[PROTOCOL:ERROR_NOTICE] from claude at 2024-01-15T06:15:30.000Z
Error: Build failed due to type error in tmux.ts
Recoverable: true
Needs assistance: false
```

### Heartbeat

Signal that an agent is alive and responsive:

```typescript
ipc.sendHeartbeat("alive", "Reviewing protocol implementation");
ipc.sendHeartbeat("busy", "Running test suite");
ipc.sendHeartbeat("idle");
```

Produces:

```
[PROTOCOL:HEARTBEAT] from claude at 2024-01-15T06:15:30.000Z
Status: alive
Task: Reviewing protocol implementation
```

Status values: `alive`, `busy`, `idle`

Use heartbeats to:
- Confirm an agent is responsive before sending work
- Monitor long-running agent tasks
- Detect crashed or stuck agents

### Protocol Benefits

- **Structured communication**: Consistent message format for parsing
- **Timestamped**: Track when events occurred
- **Source tracking**: Know which agent sent the message
- **Human readable**: Still readable in raw tmux output
- **Type-safe**: TypeScript interfaces for all message types

## Implementation Status

Completed:

- [x] TypeScript wrapper (AgentIPC class)
- [x] CLI interface (commander.js)
- [x] Response polling with timeout (sendAndWait)
- [x] Structured logging (pino)
- [x] Shell escaping for security
- [x] Test suite (vitest)
- [x] Protocol message types and methods
- [x] Context compaction notification
- [x] Status update broadcasting
- [x] Task handoff protocol
- [x] Error notification protocol
- [x] Heartbeat protocol

Future:

- [ ] Message queue system
- [ ] Hook-based auto-notifications (requires Claude Code hook support)
- [ ] Agent discovery protocol
- [ ] Protocol message parsing/validation
