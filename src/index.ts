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
} from "./core/ipc.js";
export { tmux, type TmuxSession, type SendOptions, type CaptureOptions } from "./core/tmux.js";
export { logger } from "./utils/logger.js";
export {
  SessionLogger,
  generateDescriptor,
  type LogEntry,
  type LogEntryType,
  type ActiveSession,
  type SessionState,
} from "./utils/logger-session.js";
export {
  parseProtocolMessage,
  isProtocolMessage,
  extractProtocolMessages,
  type ParsedProtocolMessage,
} from "./core/protocol.js";
