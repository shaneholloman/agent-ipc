import { tmux, TmuxSession } from "./tmux.js";

export interface Message {
  from: string;
  to: string;
  content: string;
  timestamp: Date;
}

/**
 * Protocol message types for multi-agent coordination
 */
export type ProtocolMessageType =
  | "context_compaction"
  | "status_update"
  | "task_handoff"
  | "error_notice"
  | "heartbeat";

export interface ProtocolMessage {
  type: ProtocolMessageType;
  from: string;
  timestamp: string;
}

export interface CompactionNotice extends ProtocolMessage {
  type: "context_compaction";
  summary: string;
  retainedKnowledge: string[];
  currentTaskState: string;
}

export interface StatusUpdate extends ProtocolMessage {
  type: "status_update";
  status: "idle" | "working" | "blocked" | "completed";
  currentTask?: string;
  progress?: string;
}

export interface TaskHandoff extends ProtocolMessage {
  type: "task_handoff";
  task: string;
  context: string;
  priority: "low" | "medium" | "high";
}

export interface ErrorNotice extends ProtocolMessage {
  type: "error_notice";
  error: string;
  recoverable: boolean;
  needsAssistance: boolean;
}

export interface Heartbeat extends ProtocolMessage {
  type: "heartbeat";
  status: "alive" | "busy" | "idle";
  currentTask?: string;
  uptime?: number;
}

export interface SendResult {
  success: boolean;
  message: string;
}

export interface WaitOptions {
  timeout?: number;
  pollInterval?: number;
  lines?: number;
}

/**
 * Claude IPC - Inter-process communication between Claude Code sessions
 *
 * Enables Claude instances running in different tmux sessions to
 * communicate with each other via tmux send-keys and capture-pane.
 */
export class ClaudeIPC {
  private sessionName: string;

  constructor(sessionName?: string) {
    this.sessionName = sessionName ?? tmux.currentSession() ?? "unknown";
  }

  /**
   * Get the current session name
   */
  get session(): string {
    return this.sessionName;
  }

  /**
   * List all Claude sessions
   */
  listSessions(): TmuxSession[] {
    return tmux.listClaudeSessions();
  }

  /**
   * Check if a session exists
   */
  sessionExists(name: string): boolean {
    return tmux.hasSession(name);
  }

  /**
   * Send a message to another Claude session
   *
   * Key insight: text and C-Enter must be separate tmux commands
   */
  send(target: string, message: string): SendResult {
    if (!this.sessionExists(target)) {
      return {
        success: false,
        message: `Session '${target}' not found`,
      };
    }

    try {
      // Step 1: Send the message text
      tmux.sendKeys(target, message);

      // Step 2: Submit with Ctrl+Enter (MUST be separate command)
      tmux.sendSubmit(target);

      return {
        success: true,
        message: `Sent to ${target}`,
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  /**
   * Read the current output from a session
   * Returns null if session doesn't exist, empty string if no output
   */
  read(target: string, lines = 50): string | null {
    if (!this.sessionExists(target)) {
      return null;
    }
    return tmux.capturePane(target, { lines });
  }

  /**
   * Send a message and wait for a response
   *
   * Polls the target session until new content appears or timeout
   */
  async sendAndWait(
    target: string,
    message: string,
    options: WaitOptions = {}
  ): Promise<string> {
    const { timeout = 30000, pollInterval = 1000, lines = 50 } = options;

    // Verify session exists first
    if (!this.sessionExists(target)) {
      throw new Error(`Session '${target}' not found`);
    }

    // Capture initial state (we know session exists, so this won't be null)
    const initialContent = this.read(target, lines) ?? "";

    // Send the message
    const result = this.send(target, message);
    if (!result.success) {
      throw new Error(result.message);
    }

    // Poll for new content
    const startTime = Date.now();
    let lastContent = initialContent;

    while (Date.now() - startTime < timeout) {
      await this.sleep(pollInterval);

      const currentContent = this.read(target, lines) ?? "";

      // Check if content has changed and is no longer "thinking"
      if (currentContent !== lastContent) {
        // Check if Claude is still processing
        if (
          currentContent.includes("Wrangling") ||
          currentContent.includes("Thinking")
        ) {
          lastContent = currentContent;
          continue;
        }

        // Extract the new response
        const response = this.extractNewContent(initialContent, currentContent);
        if (response) {
          return response;
        }
      }

      lastContent = currentContent;
    }

    throw new Error(`Timeout waiting for response from ${target}`);
  }

  /**
   * Broadcast a message to all Claude sessions except self
   */
  broadcast(message: string): Map<string, SendResult> {
    const results = new Map<string, SendResult>();
    const sessions = this.listSessions();

    for (const session of sessions) {
      if (session.name !== this.sessionName) {
        results.set(session.name, this.send(session.name, message));
      }
    }

    return results;
  }

  /**
   * Create a new Claude session with auto-incrementing name
   */
  createSession(): string {
    const sessions = this.listSessions();
    let maxNum = 0;

    for (const session of sessions) {
      const match = session.name.match(/^claude-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }

    const newName = `claude-${maxNum + 1}`;
    tmux.createClaudeSession(newName);
    return newName;
  }

  /**
   * Kill a Claude session
   */
  killSession(name: string): boolean {
    return tmux.killSession(name);
  }

  /**
   * Kill all Claude sessions except the current one
   */
  killOthers(): number {
    const sessions = this.listSessions();
    let count = 0;

    for (const session of sessions) {
      if (session.name !== this.sessionName) {
        if (this.killSession(session.name)) {
          count++;
        }
      }
    }

    return count;
  }

  /**
   * Kill all Claude sessions
   */
  killAll(): number {
    const sessions = this.listSessions();
    let count = 0;

    for (const session of sessions) {
      if (this.killSession(session.name)) {
        count++;
      }
    }

    return count;
  }

  // ===== Protocol Methods =====

  /**
   * Broadcast a context compaction notice to all collaborating agents
   */
  notifyCompaction(
    summary: string,
    retainedKnowledge: string[],
    currentTaskState: string
  ): Map<string, SendResult> {
    const notice: CompactionNotice = {
      type: "context_compaction",
      from: this.sessionName,
      timestamp: new Date().toISOString(),
      summary,
      retainedKnowledge,
      currentTaskState,
    };

    const message = this.formatProtocolMessage(notice);
    return this.broadcast(message);
  }

  /**
   * Broadcast a status update to all collaborating agents
   */
  notifyStatus(
    status: StatusUpdate["status"],
    currentTask?: string,
    progress?: string
  ): Map<string, SendResult> {
    const update: StatusUpdate = {
      type: "status_update",
      from: this.sessionName,
      timestamp: new Date().toISOString(),
      status,
      currentTask,
      progress,
    };

    const message = this.formatProtocolMessage(update);
    return this.broadcast(message);
  }

  /**
   * Send a task handoff to a specific agent
   */
  handoffTask(
    target: string,
    task: string,
    context: string,
    priority: TaskHandoff["priority"] = "medium"
  ): SendResult {
    const handoff: TaskHandoff = {
      type: "task_handoff",
      from: this.sessionName,
      timestamp: new Date().toISOString(),
      task,
      context,
      priority,
    };

    const message = this.formatProtocolMessage(handoff);
    return this.send(target, message);
  }

  /**
   * Broadcast an error notice to all collaborating agents
   */
  notifyError(
    error: string,
    recoverable: boolean,
    needsAssistance: boolean
  ): Map<string, SendResult> {
    const notice: ErrorNotice = {
      type: "error_notice",
      from: this.sessionName,
      timestamp: new Date().toISOString(),
      error,
      recoverable,
      needsAssistance,
    };

    const message = this.formatProtocolMessage(notice);
    return this.broadcast(message);
  }

  /**
   * Send a heartbeat to all collaborating agents
   * Use periodically to signal agent is alive and responsive
   */
  sendHeartbeat(
    status: Heartbeat["status"] = "alive",
    currentTask?: string
  ): Map<string, SendResult> {
    const heartbeat: Heartbeat = {
      type: "heartbeat",
      from: this.sessionName,
      timestamp: new Date().toISOString(),
      status,
      currentTask,
    };

    const message = this.formatProtocolMessage(heartbeat);
    return this.broadcast(message);
  }

  /**
   * Format a protocol message for human-readable transmission
   */
  private formatProtocolMessage(msg: ProtocolMessage): string {
    const header = `[PROTOCOL:${msg.type.toUpperCase()}] from ${msg.from} at ${msg.timestamp}`;

    switch (msg.type) {
      case "context_compaction": {
        const m = msg as CompactionNotice;
        return `${header}\nSummary: ${m.summary}\nRetained: ${m.retainedKnowledge.join(", ")}\nCurrent task: ${m.currentTaskState}`;
      }
      case "status_update": {
        const m = msg as StatusUpdate;
        let text = `${header}\nStatus: ${m.status}`;
        if (m.currentTask) text += `\nTask: ${m.currentTask}`;
        if (m.progress) text += `\nProgress: ${m.progress}`;
        return text;
      }
      case "task_handoff": {
        const m = msg as TaskHandoff;
        return `${header}\nTask: ${m.task}\nPriority: ${m.priority}\nContext: ${m.context}`;
      }
      case "error_notice": {
        const m = msg as ErrorNotice;
        return `${header}\nError: ${m.error}\nRecoverable: ${m.recoverable}\nNeeds assistance: ${m.needsAssistance}`;
      }
      case "heartbeat": {
        const m = msg as Heartbeat;
        let text = `${header}\nStatus: ${m.status}`;
        if (m.currentTask) text += `\nTask: ${m.currentTask}`;
        return text;
      }
      default:
        return `${header}\n${JSON.stringify(msg, null, 2)}`;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private extractNewContent(before: string, after: string): string | null {
    // Simple diff: find content after the prompt indicator
    const lines = after.split("\n");
    const beforeLines = new Set(before.split("\n"));

    const newLines = lines.filter((line) => !beforeLines.has(line));

    // Look for Claude's response (lines starting with special chars or plain text after >)
    const responseLines: string[] = [];
    let inResponse = false;

    for (const line of newLines) {
      // Skip empty lines at start
      if (!inResponse && !line.trim()) continue;

      // Skip the prompt line
      if (line.startsWith(">")) continue;

      // Start capturing response
      inResponse = true;
      responseLines.push(line);
    }

    return responseLines.length > 0 ? responseLines.join("\n").trim() : null;
  }
}

export default ClaudeIPC;
