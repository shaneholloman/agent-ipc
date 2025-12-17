export {
  ClaudeIPC,
  type Message,
  type SendResult,
  type WaitOptions,
  type IPCOptions,
  type ProtocolMessageType,
  type ProtocolMessage,
  type CompactionNotice,
  type StatusUpdate,
  type TaskHandoff,
  type ErrorNotice,
  type Heartbeat,
} from "./claude-ipc.js";
export { tmux, type TmuxSession, type SendOptions, type CaptureOptions } from "./tmux.js";
export { logger } from "./logger.js";
export {
  SessionLogger,
  generateDescriptor,
  type LogEntry,
  type LogEntryType,
  type ActiveSession,
  type SessionState,
} from "./session-logger.js";
export {
  parseProtocolMessage,
  isProtocolMessage,
  extractProtocolMessages,
  type ParsedProtocolMessage,
} from "./protocol.js";
