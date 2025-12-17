import { exec, execSync } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

/**
 * Escape a string for safe use in single-quoted shell arguments.
 * Replaces ' with '\'' (end quote, escaped quote, start quote).
 */
function shellEscape(str: string): string {
    return str.replace(/'/g, "'\\''");
}

export interface TmuxSession {
    name: string;
    windows: number;
    attached: boolean;
}

export interface SendOptions {
    submit?: boolean;
}

export interface CaptureOptions {
    lines?: number;
}

/**
 * Low-level tmux operations
 */
export const tmux = {
    /**
     * Execute a tmux command synchronously
     */
    execSync(args: string): string {
        try {
            return execSync(`tmux ${args}`, { encoding: "utf-8" }).trim();
        } catch {
            return "";
        }
    },

    /**
     * Execute a tmux command asynchronously
     */
    async exec(args: string): Promise<string> {
        try {
            const { stdout } = await execAsync(`tmux ${args}`);
            return stdout.trim();
        } catch {
            return "";
        }
    },

    /**
     * Check if a session exists
     */
    hasSession(name: string): boolean {
        try {
            execSync(`tmux has-session -t '${shellEscape(name)}' 2>/dev/null`);
            return true;
        } catch {
            return false;
        }
    },

    /**
     * List all tmux sessions
     */
    listSessions(): TmuxSession[] {
        const output = this.execSync(
            'list-sessions -F "#{session_name}:#{session_windows}:#{session_attached}"',
        );
        if (!output) return [];

        return output.split("\n").map((line) => {
            const [name, windows, attached] = line.split(":");
            return {
                name,
                windows: parseInt(windows, 10),
                attached: attached === "1",
            };
        });
    },

    /**
     * List agent sessions
     * Matches:
     * - agent (base)
     * - agent-1, agent-2 (numbered, for human-interactive)
     * - agent-dev, agent-tester (role-based, for inter-agent)
     * - agent-tester-2 (role-based with instance number)
     */
    listAgentSessions(): TmuxSession[] {
        return this.listSessions().filter((s) =>
            /^agent(-\d+|-[a-z]+(-\d+)?)?$/.test(s.name),
        );
    },

    /**
     * Get the current session name
     */
    currentSession(): string | null {
        const result = this.execSync("display-message -p '#{session_name}'");
        return result || null;
    },

    /**
     * Send keys to a session
     */
    sendKeys(target: string, keys: string): void {
        execSync(
            `tmux send-keys -t '${shellEscape(target)}' '${shellEscape(keys)}'`,
        );
    },

    /**
     * Send Ctrl+Enter to submit in agent TUI
     * Small delay ensures paste completes before submit
     */
    sendSubmit(target: string): void {
        // Brief delay to ensure paste buffer is fully processed
        execSync(
            `sleep 0.1 && tmux send-keys -t '${shellEscape(target)}' C-Enter`,
        );
    },

    /**
     * Capture pane content
     */
    capturePane(target: string, options: CaptureOptions = {}): string {
        const lines = options.lines ?? 50;
        return this.execSync(
            `capture-pane -t '${shellEscape(target)}' -p -S -${lines}`,
        );
    },

    /**
     * Create a new session running an agent
     */
    createAgentSession(name: string, command = "claude"): void {
        execSync(`tmux new-session -d -s '${shellEscape(name)}' ${command}`);
    },

    /**
     * Kill a session
     */
    killSession(name: string): boolean {
        try {
            execSync(`tmux kill-session -t '${shellEscape(name)}'`);
            return true;
        } catch {
            return false;
        }
    },
};
