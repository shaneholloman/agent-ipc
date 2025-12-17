#!/usr/bin/env bash
# Method 3: tmux Buffer - Use tmux's shared paste buffer
# Usage: ./method3-buffer.sh set <message>
#        ./method3-buffer.sh get
#        ./method3-buffer.sh list

set -euo pipefail

ACTION="${1:-}"
MESSAGE="${2:-}"
BUFFER_NAME="agent-ipc"

case "$ACTION" in
    set)
        if [[ -z "$MESSAGE" ]]; then
            echo "Usage: $0 set <message>"
            exit 1
        fi
        SENDER=$(tmux display-message -p '#{session_name}' 2>/dev/null || echo "unknown")
        TIMESTAMP=$(date '+%H:%M:%S')
        tmux set-buffer -b "$BUFFER_NAME" "[$TIMESTAMP] $SENDER: $MESSAGE"
        echo "Buffer set"
        ;;
    get)
        if tmux show-buffer -b "$BUFFER_NAME" 2>/dev/null; then
            :
        else
            echo "(buffer empty)"
        fi
        ;;
    list)
        echo "All tmux buffers:"
        tmux list-buffers 2>/dev/null || echo "(no buffers)"
        ;;
    *)
        echo "Usage: $0 <action> [message]"
        echo ""
        echo "Actions:"
        echo "  set <message>  - Set the shared buffer content"
        echo "  get            - Get the current buffer content"
        echo "  list           - List all tmux buffers"
        echo ""
        echo "Note: Buffer is shared across ALL tmux sessions"
        exit 1
        ;;
esac
