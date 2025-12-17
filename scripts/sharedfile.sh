#!/usr/bin/env bash
# Method 2: Shared File - Read/write messages to a common file
# Usage: ./method2-sharedfile.sh send <message>
#        ./method2-sharedfile.sh read
#        ./method2-sharedfile.sh watch
#        ./method2-sharedfile.sh clear

set -euo pipefail

INBOX="/tmp/agent-ipc-inbox.txt"
ACTION="${1:-}"
MESSAGE="${2:-}"

# Get current session name for attribution
SENDER=$(tmux display-message -p '#{session_name}' 2>/dev/null || echo "unknown")

case "$ACTION" in
    send)
        if [[ -z "$MESSAGE" ]]; then
            echo "Usage: $0 send <message>"
            exit 1
        fi
        TIMESTAMP=$(date '+%H:%M:%S')
        echo "[$TIMESTAMP] $SENDER: $MESSAGE" >> "$INBOX"
        echo "Message sent"
        ;;
    read)
        if [[ -f "$INBOX" ]]; then
            cat "$INBOX"
        else
            echo "(inbox empty)"
        fi
        ;;
    watch)
        echo "Watching inbox (Ctrl+C to stop)..."
        touch "$INBOX"
        tail -f "$INBOX"
        ;;
    clear)
        rm -f "$INBOX"
        echo "Inbox cleared"
        ;;
    *)
        echo "Usage: $0 <action> [message]"
        echo ""
        echo "Actions:"
        echo "  send <message>  - Send a message to the shared inbox"
        echo "  read            - Read all messages"
        echo "  watch           - Watch for new messages in real-time"
        echo "  clear           - Clear the inbox"
        exit 1
        ;;
esac
