# Helix Integration

> Failing concept

This guide explains how to use Helix editor with Claude Code in an integrated tmux session.

## Overview

The Helix integration creates a side-by-side workflow:

```text
+---------------------------+-----------------------------+
| Pane 0: Helix             | Pane 1: Claude Code         |
|                           |                             |
| :pipe hx-send             | Receives code/questions     |
| :sh hx-ask "question"     | Generates responses         |
| :sh hx-yank               | Output captured back        |
+---------------------------+-----------------------------+
```

## Quick Start

```bash
# Source your updated shell config
source ~/.zshrc

# Start the integrated session
ash

# Or with custom session name and directory
ash my-project ~/code/my-project
```

## Shell Alias

The `ash` function creates a tmux session with:

- Left pane: Helix editor
- Right pane: Claude Code

```bash
ash                          # agent-helix in current directory
ash my-session               # custom session name
ash my-session /path/to/dir  # custom name and directory
```

## Helix Commands

From within Helix, you can interact with Claude Code using these commands:

### Send Selection to Claude

Select text in Helix, then:

```vim
:pipe hx-send
```

This pipes the selected text directly to Claude Code.

### Ask a Question About Code

Select code and ask a question:

```vim
:pipe hx-ask "explain this function"
:pipe hx-ask "what does this regex do"
:pipe hx-ask "refactor this for readability"
```

### Capture Claude's Response

Copy Claude's recent output to clipboard:

```vim
:sh hx-yank
:sh hx-yank 100    # capture 100 lines instead of default 50
```

Then paste in Helix with `p` or `P`.

## Optional Keybindings

Add these to `~/.config/helix/config.toml` for quick access:

```toml
[keys.normal.space.c]
s = ":pipe-to ~/git/_sources/_shaneholloman/agent-ipc/scripts/helix/hx-send.sh"
a = ":pipe-to ~/git/_sources/_shaneholloman/agent-ipc/scripts/helix/hx-ask.sh"
y = ":sh ~/git/_sources/_shaneholloman/agent-ipc/scripts/helix/hx-yank.sh"
```

This creates `<space>c` as a "Claude" prefix:

- `<space>cs` - Send selection to Claude
- `<space>ca` - Ask about selection (uses default question)
- `<space>cy` - Yank Claude's output to clipboard

## Environment Variables

The scripts support these environment variables:

| Variable     | Default                                   | Description               |
| ------------ | ----------------------------------------- | ------------------------- |
| `IPC_DIR`    | `~/git/_sources/_shaneholloman/agent-ipc` | Path to agent-ipc project |
| `HX_SESSION` | `agent-helix`                             | tmux session name         |

Example:

```bash
export IPC_DIR="$HOME/projects/agent-ipc"
export HX_SESSION="my-helix-session"
```

## CLI Commands

The TypeScript CLI provides these Helix-specific commands:

```bash
# Send stdin to Claude pane
echo "Hello Claude" | pnpm run cli helix-send

# Read Claude pane output
pnpm run cli helix-read -n 50

# Create a Helix session
pnpm run cli helix-session -n my-session -d /path/to/project
```

## Workflow Example

1. Start a Helix + Claude session:

   ```bash
   ash
   ```

2. Open a file in Helix (left pane)

3. Select a function you want explained

4. Run `:pipe hx-ask "explain this function"`

5. Watch Claude respond in the right pane

6. Run `:sh hx-yank` to copy the response

7. Paste where needed in Helix

## Troubleshooting

### Scripts not found

Ensure the scripts are executable:

```bash
chmod +x ~/git/_sources/_shaneholloman/agent-ipc/scripts/helix/*.sh
```

### Session not found errors

Make sure you're in an `agent-helix` session:

```bash
tmux display-message -p '#{session_name}'
```

### pnpm not found

The scripts require pnpm. Install it:

```bash
npm install -g pnpm
```

### Clipboard not working

On Linux, install `xclip` or `xsel`:

```bash
# Debian/Ubuntu
sudo apt install xclip

# Arch
sudo pacman -S xclip
```

## How It Works

1. Shell wrappers (`hx-send.sh`, etc.) are thin scripts that call the TypeScript CLI
2. The CLI uses tmux's `send-keys` and `capture-pane` commands
3. Text is sent to Claude with `C-Enter` to submit (Claude Code's TUI requirement)
4. Output is captured and copied to the system clipboard

## Related Documentation

- `docs/patterns.md` - IPC patterns and discoveries
- `docs/tmux-aliases.md` - All agent session aliases
- `README.md` - Project overview
