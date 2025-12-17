#!/bin/bash

# Injects AGENTS.md from current directory or parent directories at session start

SEARCH_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"

# Function to search upward for AGENTS.md
find_agents_md() {
    local dir="$1"
    while [[ "$dir" != "/" ]]; do
        if [[ -f "$dir/AGENTS.md" ]]; then
            echo "$dir/AGENTS.md"
            return 0
        fi
        dir=$(dirname "$dir")
    done
    return 1
}

# Try to find AGENTS.md in project hierarchy first
AGENTS_FILE=$(find_agents_md "$SEARCH_DIR")

# Fallback to global AGENTS.md if no project-specific one found
if [[ -z "$AGENTS_FILE" && -f "$HOME/.claude/AGENTS.md" ]]; then
    AGENTS_FILE="$HOME/.claude/AGENTS.md"
fi

if [[ -n "$AGENTS_FILE" ]]; then
    CONTENT=$(cat "$AGENTS_FILE")
    # Output as structured JSON with additionalContext field - ONLY to stdout
    jq -n --arg content "$CONTENT" --arg path "$AGENTS_FILE" '{
        hookSpecificOutput: {
            hookEventName: "SessionStart",
            additionalContext: ("# AGENTS.md Context\n\nLocated at: " + $path + "\n\n" + $content + "\n\n---\n")
        }
    }'
fi
