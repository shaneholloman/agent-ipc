#!/usr/bin/env bash
# Method 4: Named Pipe (FIFO) - Real-time streaming between sessions
# Usage: ./method4-fifo.sh create
#        ./method4-fifo.sh send <message>
#        ./method4-fifo.sh listen
#        ./method4-fifo.sh destroy

set -euo pipefail

FIFO="/tmp/claude-ipc-fifo"
ACTION="${1:-}"
MESSAGE="${2:-}"

case "$ACTION" in
    create)
        if [[ -p "$FIFO" ]]; then
            echo "FIFO already exists at $FIFO"
        else
            mkfifo "$FIFO"
            echo "FIFO created at $FIFO"
        fi
        ;;
    send)
        if [[ -z "$MESSAGE" ]]; then
            echo "Usage: $0 send <message>"
            exit 1
        fi
        if [[ ! -p "$FIFO" ]]; then
            echo "Error: FIFO not found. Run '$0 create' first"
            exit 1
        fi
        SENDER=$(tmux display-message -p '#{session_name}' 2>/dev/null || echo "unknown")
        TIMESTAMP=$(date '+%H:%M:%S')
        # Note: This will block until someone reads from the pipe
        echo "[$TIMESTAMP] $SENDER: $MESSAGE" > "$FIFO" &
        echo "Message queued (will deliver when listener connects)"
        ;;
    listen)
        if [[ ! -p "$FIFO" ]]; then
            echo "Error: FIFO not found. Run '$0 create' first"
            exit 1
        fi
        echo "Listening on FIFO (Ctrl+C to stop)..."
        while true; do
            if read -r line < "$FIFO"; then
                echo "$line"
            fi
        done
        ;;
    destroy)
        rm -f "$FIFO"
        echo "FIFO destroyed"
        ;;
    *)
        echo "Usage: $0 <action> [message]"
        echo ""
        echo "Actions:"
        echo "  create         - Create the named pipe"
        echo "  send <message> - Send a message (blocks until read)"
        echo "  listen         - Listen for messages (blocking)"
        echo "  destroy        - Remove the named pipe"
        echo ""
        echo "Note: FIFO is a blocking pipe. One session listens,"
        echo "      others send. Messages delivered in real-time."
        exit 1
        ;;
esac
