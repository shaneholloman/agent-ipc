/**
 * Protocol message parsing utilities
 *
 * Parses human-readable protocol messages back into structured objects.
 * Companion to formatProtocolMessage() in claude-ipc.ts.
 */

import type {
  ProtocolMessage,
  ProtocolMessageType,
  CompactionNotice,
  StatusUpdate,
  TaskHandoff,
  ErrorNotice,
  Heartbeat,
} from "./claude-ipc.js";

/**
 * Union type of all parsed protocol messages
 */
export type ParsedProtocolMessage =
  | ProtocolMessage
  | CompactionNotice
  | StatusUpdate
  | TaskHandoff
  | ErrorNotice
  | Heartbeat;

/**
 * Parse a protocol message from text format back to structured object
 * Returns null if the text is not a valid protocol message
 *
 * Format: [PROTOCOL:<TYPE>] from <session> at <timestamp> seq=<n>
 */
export function parseProtocolMessage(text: string): ParsedProtocolMessage | null {
  const lines = text.trim().split("\n");
  if (lines.length === 0) return null;

  // Parse header: [PROTOCOL:TYPE] from session at timestamp seq=N
  const headerMatch = lines[0].match(
    /^\[PROTOCOL:([A-Z_]+)\] from ([^\s]+) at ([^\s]+)(?: seq=(\d+))?$/
  );
  if (!headerMatch) return null;

  const [, typeUpper, from, timestamp, seqStr] = headerMatch;
  const type = typeUpper.toLowerCase() as ProtocolMessageType;
  const seq = seqStr ? parseInt(seqStr, 10) : undefined;

  // Parse body into key-value pairs
  const body: Record<string, string> = {};
  for (let i = 1; i < lines.length; i++) {
    const colonIdx = lines[i].indexOf(": ");
    if (colonIdx > 0) {
      const key = lines[i].slice(0, colonIdx).toLowerCase().replace(/\s+/g, "_");
      const value = lines[i].slice(colonIdx + 2);
      body[key] = value;
    }
  }

  // Build typed message based on type
  switch (type) {
    case "context_compaction":
      return {
        type,
        from,
        timestamp,
        seq,
        summary: body.summary || "",
        retainedKnowledge: body.retained ? body.retained.split(", ") : [],
        currentTaskState: body.current_task || "",
      } as CompactionNotice;

    case "status_update":
      return {
        type,
        from,
        timestamp,
        seq,
        status: (body.status as StatusUpdate["status"]) || "idle",
        currentTask: body.task,
        progress: body.progress,
      } as StatusUpdate;

    case "task_handoff":
      return {
        type,
        from,
        timestamp,
        seq,
        task: body.task || "",
        priority: (body.priority as TaskHandoff["priority"]) || "medium",
        context: body.context || "",
      } as TaskHandoff;

    case "error_notice":
      return {
        type,
        from,
        timestamp,
        seq,
        error: body.error || "",
        recoverable: body.recoverable === "true",
        needsAssistance: body.needs_assistance === "true",
      } as ErrorNotice;

    case "heartbeat":
      return {
        type,
        from,
        timestamp,
        seq,
        status: (body.status as Heartbeat["status"]) || "alive",
        currentTask: body.task,
      } as Heartbeat;

    default:
      // Unknown type, return base protocol message
      return { type, from, timestamp, seq };
  }
}

/**
 * Check if text contains a protocol message
 */
export function isProtocolMessage(text: string): boolean {
  return /^\[PROTOCOL:[A-Z_]+\]/.test(text.trim());
}

/**
 * Extract all protocol messages from a block of text
 * Useful for parsing tmux capture output that may contain multiple messages
 */
export function extractProtocolMessages(text: string): ParsedProtocolMessage[] {
  const messages: ParsedProtocolMessage[] = [];
  const lines = text.split("\n");

  let currentMessage: string[] = [];
  let inMessage = false;

  for (const line of lines) {
    if (line.startsWith("[PROTOCOL:")) {
      // Start of new message - save previous if exists
      if (inMessage && currentMessage.length > 0) {
        const parsed = parseProtocolMessage(currentMessage.join("\n"));
        if (parsed) messages.push(parsed);
      }
      currentMessage = [line];
      inMessage = true;
    } else if (inMessage) {
      // Continue current message if line has content
      if (line.trim() && line.includes(": ")) {
        currentMessage.push(line);
      } else if (!line.trim()) {
        // Empty line ends message
        const parsed = parseProtocolMessage(currentMessage.join("\n"));
        if (parsed) messages.push(parsed);
        currentMessage = [];
        inMessage = false;
      }
    }
  }

  // Don't forget last message
  if (inMessage && currentMessage.length > 0) {
    const parsed = parseProtocolMessage(currentMessage.join("\n"));
    if (parsed) messages.push(parsed);
  }

  return messages;
}
