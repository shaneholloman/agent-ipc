# Claude IPC

Inter-process communication for Claude Code sessions running in tmux.

## Status: Working

Bidirectional Claude-to-Claude communication has been tested and confirmed working.

## Installation

```bash
# Clone and install
cd claude-ipc
pnpm install

# Run with tsx (development)
pnpm run cli <command>

# Or build and run
pnpm run build
node dist/cli.js <command>
```

## TypeScript API

### ClaudeIPC Class

```typescript
import { ClaudeIPC } from "./src/index.js";

const ipc = new ClaudeIPC();

// List all Claude sessions
const sessions = ipc.listSessions();

// Send a message to another session
const result = ipc.send("claude-2", "Hello from TypeScript!");

// Read output from a session
const output = ipc.read("claude-2", 50);

// Send and wait for response
const response = await ipc.sendAndWait("claude-2", "What is 2+2?", {
  timeout: 30000,
  pollInterval: 2000,
});

// Broadcast to all other sessions
const results = ipc.broadcast("Status check");

// Session management
const newSession = ipc.createSession(); // Creates claude-N
ipc.killSession("claude-2");
ipc.killOthers(); // Keep current, kill rest
ipc.killAll();

// Protocol methods for multi-agent coordination
ipc.notifyCompaction("Summary of retained context", ["item1", "item2"], "current task");
ipc.notifyStatus("working", "Current task", "50% progress");
ipc.handoffTask("claude-2", "Task description", "Context for the task", "high");
ipc.notifyError("Error description", true, false);
```

### CLI Commands

```bash
# List sessions
pnpm run cli list

# Send message
pnpm run cli send claude-2 "Your message here"

# Read output (default 50 lines)
pnpm run cli read claude-2
pnpm run cli read claude-2 -n 30

# Send and wait for response (with optional timeout/poll)
pnpm run cli ask claude-2 "What is the capital of France?"
pnpm run cli ask claude-2 "Complex question" -t 120000 -p 3000

# Broadcast to all
pnpm run cli broadcast "Status check"

# Session management
pnpm run cli create
pnpm run cli kill claude-2
pnpm run cli kill-others
pnpm run cli kill-all
pnpm run cli current
```

## Documentation

| File                   | Description                                                    |
| ---------------------- | -------------------------------------------------------------- |
| `docs/tmux-aliases.md` | Shell aliases (`cs`, `csd`, `cst`, `csl`, `csa`, `cso`, `csx`) |
| `docs/patterns.md`     | Detailed IPC patterns and key discoveries                      |

## Alternative IPC Methods (scripts/)

The TypeScript CLI is the primary interface. These bash scripts in `scripts/` demonstrate alternative IPC patterns:

| Script          | Pattern           | Use Case                                         |
| --------------- | ----------------- | ------------------------------------------------ |
| `sharedfile.sh` | Shared file inbox | Persistent, survives disconnections, audit trail |
| `buffer.sh`     | tmux paste buffer | Native tmux, lower latency                       |
| `fifo.sh`       | Named pipe (FIFO) | Streaming, real-time continuous data             |

## The Key Discovery

Claude Code's TUI uses multi-line input:

- `Enter` = newline (does not submit)
- `Ctrl+Enter` = submit prompt

When sending programmatically, **text and submit must be separate tmux commands**:

```bash
# This works:
tmux send-keys -t claude-2 'Your message'
tmux send-keys -t claude-2 C-Enter

# This does NOT work:
tmux send-keys -t claude-2 'Your message' C-Enter
```

## Shell Aliases

| Command      | Description                                                 |
| ------------ | ----------------------------------------------------------- |
| `c`          | Run Claude directly (no tmux)                               |
| `cs`         | New human session (auto-increment: claude-1, claude-2, ...) |
| `csd`        | Start IPC Developer session (claude-dev)                    |
| `cst`        | Start IPC Tester session (claude-tester)                    |
| `csl`        | List all Claude sessions                                    |
| `csa <name>` | Attach to session                                           |
| `cso`        | Kill others (keep current)                                  |
| `csx`        | Exterminate ALL sessions (nuclear)                          |

## Quick Start

```bash
# 1. Source shell config (after installing aliases)
source ~/.zshrc

# 2. Start Claude sessions
cs  # Creates claude-1
cs  # Creates claude-2

# 3. List sessions
csl

# 4. Send message via CLI
pnpm run cli send claude-2 "Hello from TypeScript!"

# 5. Read response
pnpm run cli read claude-2
```

## Use Cases

- **Task delegation**: Orchestrator Claude assigns work to specialist Claudes
- **Parallel exploration**: Multiple Claudes explore different approaches
- **Peer review**: One Claude reviews another's output
- **Pipeline processing**: Chain Claudes for multi-stage workflows

## Logging

Uses [pino](https://github.com/pinojs/pino) for structured logging with pretty output in development.

```bash
# Set log level (default: info)
LOG_LEVEL=debug pnpm run cli list

# Available levels: trace, debug, info, warn, error, fatal
```

Development mode (NODE_ENV != production) uses pino-pretty for colorized output:

```sh
[06:13:24] INFO: Claude sessions
    count: 3
[06:13:24] INFO:
    session: "claude-1"
    windows: 1
```

Production mode outputs JSON for log aggregation.

## Project Structure

```tree
claude-ipc/
├── src/
│   ├── index.ts           # Exports
│   ├── claude-ipc.ts      # Main ClaudeIPC class
│   ├── claude-ipc.test.ts # Vitest tests
│   ├── cli.ts             # CLI interface (commander.js)
│   ├── logger.ts          # Pino logger configuration
│   └── tmux.ts            # Low-level tmux operations
├── prompts/               # Role prompts and protocols
│   ├── developer.md       # Developer role prompt
│   ├── tester.md          # Tester role prompt
│   └── protocol.md        # Communication protocol spec
├── .claude/
│   ├── settings.json      # Project hook configuration
│   └── hooks/             # Hook scripts
│       └── session-event.sh
├── scripts/               # Alternative IPC methods
│   ├── sharedfile.sh      # Shared file inbox
│   ├── buffer.sh          # tmux paste buffer
│   └── fifo.sh            # Named pipe streaming
├── docs/                  # Documentation
│   ├── patterns.md        # IPC patterns and discoveries
│   └── tmux-aliases.md    # Shell alias documentation
├── dist/                  # Compiled JavaScript
├── CLAUDE.md              # Project instructions for Claude instances
├── AGENTS.md              # Symlink to CLAUDE.md (for Gemini, Codex, Cline, etc.)
└── README.md
```

## Cleanup

```bash
# Clear shared file inbox
./scripts/sharedfile.sh clear

# Destroy named pipe
./scripts/fifo.sh destroy

# Kill other Claude sessions (keep current)
cso

# Exterminate ALL sessions including your own (nuclear)
csx
```
