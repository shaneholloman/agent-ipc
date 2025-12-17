/**
 * Session Logger - JSONL logging for IPC communication
 *
 * Provides structured logging alongside tmux direct communication.
 * Two channels, same information:
 * - tmux: real-time, human-observable
 * - JSONL: structured, parseable, audit trail
 */

import {
	appendFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { logger } from "./logger.js";

// Word lists for three-word descriptors (like Claude's todo lists)
const ADJECTIVES = [
	"brave",
	"calm",
	"dark",
	"eager",
	"fair",
	"gentle",
	"happy",
	"idle",
	"jolly",
	"keen",
	"lively",
	"merry",
	"noble",
	"odd",
	"proud",
	"quick",
	"rare",
	"sharp",
	"tall",
	"urgent",
	"vivid",
	"warm",
	"young",
	"zesty",
	"bold",
	"crisp",
	"deft",
	"fine",
	"grand",
	"hale",
];

const COLORS = [
	"amber",
	"blue",
	"coral",
	"dusk",
	"ember",
	"frost",
	"gold",
	"haze",
	"iris",
	"jade",
	"khaki",
	"lime",
	"mint",
	"navy",
	"olive",
	"pearl",
	"quartz",
	"rose",
	"sage",
	"teal",
	"umber",
	"violet",
	"wine",
	"azure",
	"brass",
	"cedar",
	"denim",
	"fern",
	"grape",
	"ivory",
];

const ANIMALS = [
	"ant",
	"bear",
	"crow",
	"deer",
	"eagle",
	"fox",
	"goat",
	"hawk",
	"ibis",
	"jay",
	"kite",
	"lion",
	"moth",
	"newt",
	"owl",
	"puma",
	"quail",
	"raven",
	"seal",
	"tiger",
	"urchin",
	"viper",
	"wolf",
	"yak",
	"zebra",
	"badger",
	"crane",
	"dove",
	"finch",
	"gull",
];

/**
 * Log entry types that mirror protocol message types
 */
export type LogEntryType =
	| "session_start"
	| "session_end"
	| "message_sent"
	| "message_received"
	| "status_update"
	| "task_handoff"
	| "error_notice"
	| "heartbeat"
	| "context_compaction"
	| "custom";

/**
 * Base log entry structure
 */
export interface LogEntry {
	timestamp: string;
	type: LogEntryType;
	session: string;
	descriptor: string;
	target?: string;
	content: Record<string, unknown>;
}

/**
 * Session metadata stored in .active file
 */
export interface ActiveSession {
	session: string;
	descriptor: string;
	startedAt: string;
	pid?: number;
}

/**
 * Generate a three-word descriptor like "brave-copper-fox"
 */
export function generateDescriptor(): string {
	const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
	const color = COLORS[Math.floor(Math.random() * COLORS.length)];
	const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
	return `${adj}-${color}-${animal}`;
}

/**
 * Session state persisted by the startup hook
 */
export interface SessionState {
	tmux_session: string;
	role: string;
	ipc_mode: boolean;
	descriptor: string;
	started_at: string;
	session_id: string;
}

/**
 * Session Logger class for JSONL logging
 *
 * IMPORTANT: Descriptor persistence
 * - In IPC mode, the startup hook generates the descriptor ONCE at SessionStart
 * - The descriptor is stored in logs/.session
 * - This ensures all log entries go to the same file even if agent restarts
 * - Falls back to generating a new descriptor for non-IPC sessions
 */
export class SessionLogger {
	private logsDir: string;
	private sessionName: string;
	private descriptor: string;
	private logFile: string;
	private activeFile: string;
	private sessionStateFile: string;

	constructor(sessionName?: string, logsDir?: string) {
		this.logsDir = logsDir || join(process.cwd(), "logs");
		this.activeFile = join(this.logsDir, ".active");

		// Determine session name first (needed to find per-session state file)
		const providedName =
			sessionName || process.env.TMUX_SESSION || "unknown-session";

		// Session state file is per-session: .session-claude-dev, .session-claude-tester, etc.
		this.sessionStateFile = join(this.logsDir, `.session-${providedName}`);

		this.ensureLogsDir();

		// Try to read persistent descriptor from session state (set by hook)
		const sessionState = this.readSessionState();
		if (sessionState?.descriptor) {
			// Use the persistent descriptor from the hook
			this.descriptor = sessionState.descriptor;
			this.sessionName = sessionState.tmux_session || providedName;
			logger.debug(
				{ descriptor: this.descriptor },
				"Using persistent descriptor from session state",
			);
		} else {
			// Fallback: generate new descriptor (non-IPC session or hook didn't run)
			this.sessionName = providedName;
			this.descriptor = generateDescriptor();
			logger.debug(
				{ descriptor: this.descriptor },
				"Generated new descriptor (no session state)",
			);
		}

		this.logFile = join(this.logsDir, `${this.descriptor}.jsonl`);
	}

	/**
	 * Read session state from .session file (created by startup hook)
	 */
	private readSessionState(): SessionState | null {
		if (!existsSync(this.sessionStateFile)) {
			return null;
		}
		try {
			const content = readFileSync(this.sessionStateFile, "utf-8");
			return JSON.parse(content) as SessionState;
		} catch (err) {
			logger.warn({ err }, "Failed to read session state file");
			return null;
		}
	}

	/**
	 * Get the session state (for agents to read role info)
	 */
	getSessionState(): SessionState | null {
		return this.readSessionState();
	}

	/**
	 * Ensure logs directory exists
	 */
	private ensureLogsDir(): void {
		if (!existsSync(this.logsDir)) {
			mkdirSync(this.logsDir, { recursive: true });
		}
	}

	/**
	 * Get the session descriptor
	 */
	getDescriptor(): string {
		return this.descriptor;
	}

	/**
	 * Get the session name
	 */
	getSessionName(): string {
		return this.sessionName;
	}

	/**
	 * Get the log file path
	 */
	getLogFile(): string {
		return this.logFile;
	}

	/**
	 * Write a log entry to the JSONL file
	 */
	private writeEntry(entry: LogEntry): void {
		const line = `${JSON.stringify(entry)}\n`;
		appendFileSync(this.logFile, line);
		logger.debug({ entry }, "Log entry written");
	}

	/**
	 * Create a base log entry with common fields
	 */
	private createEntry(
		type: LogEntryType,
		content: Record<string, unknown>,
		target?: string,
	): LogEntry {
		return {
			timestamp: new Date().toISOString(),
			type,
			session: this.sessionName,
			descriptor: this.descriptor,
			...(target && { target }),
			content,
		};
	}

	/**
	 * Log session start
	 */
	logSessionStart(): void {
		const entry = this.createEntry("session_start", {
			pid: process.pid,
			cwd: process.cwd(),
		});
		this.writeEntry(entry);
		this.registerActive();
		logger.info(
			{ session: this.sessionName, descriptor: this.descriptor },
			"Session started",
		);
	}

	/**
	 * Log session end
	 */
	logSessionEnd(reason?: string): void {
		const entry = this.createEntry("session_end", {
			reason: reason || "normal",
		});
		this.writeEntry(entry);
		this.unregisterActive();
		logger.info({ session: this.sessionName, reason }, "Session ended");
	}

	/**
	 * Log a message sent to another session
	 */
	logMessageSent(target: string, message: string, protocol?: string): void {
		const entry = this.createEntry(
			"message_sent",
			{
				message,
				protocol: protocol || "direct",
				byteLength: Buffer.byteLength(message),
			},
			target,
		);
		this.writeEntry(entry);
	}

	/**
	 * Log a message received (when reading from another session)
	 */
	logMessageReceived(source: string, message: string, lines?: number): void {
		const entry = this.createEntry("message_received", {
			message,
			lines: lines || message.split("\n").length,
			byteLength: Buffer.byteLength(message),
		});
		entry.target = source; // Source of the message
		this.writeEntry(entry);
	}

	/**
	 * Log a status update
	 */
	logStatusUpdate(
		status: string,
		currentTask?: string,
		progress?: string,
	): void {
		const entry = this.createEntry("status_update", {
			status,
			currentTask,
			progress,
		});
		this.writeEntry(entry);
	}

	/**
	 * Log a task handoff
	 */
	logTaskHandoff(
		target: string,
		task: string,
		context: string,
		priority: string,
	): void {
		const entry = this.createEntry(
			"task_handoff",
			{
				task,
				context,
				priority,
			},
			target,
		);
		this.writeEntry(entry);
	}

	/**
	 * Log an error notice
	 */
	logErrorNotice(
		error: string,
		recoverable: boolean,
		needsAssistance: boolean,
	): void {
		const entry = this.createEntry("error_notice", {
			error,
			recoverable,
			needsAssistance,
		});
		this.writeEntry(entry);
	}

	/**
	 * Log a heartbeat
	 */
	logHeartbeat(status: string, currentTask?: string): void {
		const entry = this.createEntry("heartbeat", {
			status,
			currentTask,
		});
		this.writeEntry(entry);
	}

	/**
	 * Log context compaction
	 */
	logContextCompaction(
		summary: string,
		retainedKnowledge: string[],
		currentTaskState: string,
	): void {
		const entry = this.createEntry("context_compaction", {
			summary,
			retainedKnowledge,
			currentTaskState,
		});
		this.writeEntry(entry);
	}

	/**
	 * Log a custom entry
	 */
	logCustom(
		name: string,
		data: Record<string, unknown>,
		target?: string,
	): void {
		const entry = this.createEntry(
			"custom",
			{
				name,
				...data,
			},
			target,
		);
		this.writeEntry(entry);
	}

	/**
	 * Register this session as active
	 */
	private registerActive(): void {
		const active: ActiveSession = {
			session: this.sessionName,
			descriptor: this.descriptor,
			startedAt: new Date().toISOString(),
			pid: process.pid,
		};

		let activeList: ActiveSession[] = [];
		if (existsSync(this.activeFile)) {
			try {
				const content = readFileSync(this.activeFile, "utf-8");
				activeList = JSON.parse(content);
			} catch {
				activeList = [];
			}
		}

		// Remove stale entries for this session
		activeList = activeList.filter((a) => a.session !== this.sessionName);
		activeList.push(active);

		writeFileSync(this.activeFile, JSON.stringify(activeList, null, 2));
	}

	/**
	 * Unregister this session from active list
	 */
	private unregisterActive(): void {
		if (!existsSync(this.activeFile)) return;

		try {
			const content = readFileSync(this.activeFile, "utf-8");
			let activeList: ActiveSession[] = JSON.parse(content);
			activeList = activeList.filter((a) => a.session !== this.sessionName);

			writeFileSync(this.activeFile, JSON.stringify(activeList, null, 2));
		} catch {
			// Ignore errors during cleanup
		}
	}

	/**
	 * Get list of active sessions
	 */
	static getActiveSessions(logsDir?: string): ActiveSession[] {
		const dir = logsDir || join(process.cwd(), "logs");
		const activeFile = join(dir, ".active");

		if (!existsSync(activeFile)) return [];

		try {
			const content = readFileSync(activeFile, "utf-8");
			return JSON.parse(content);
		} catch {
			return [];
		}
	}

	/**
	 * Read log entries from a session's log file
	 */
	static readLog(
		descriptor: string,
		logsDir?: string,
		limit?: number,
	): LogEntry[] {
		const dir = logsDir || join(process.cwd(), "logs");
		const logFile = join(dir, `${descriptor}.jsonl`);

		if (!existsSync(logFile)) return [];

		try {
			const content = readFileSync(logFile, "utf-8");
			const lines = content.trim().split("\n").filter(Boolean);
			const entries = lines.map((line) => JSON.parse(line) as LogEntry);

			if (limit && limit > 0) {
				return entries.slice(-limit);
			}
			return entries;
		} catch (err) {
			logger.error({ err, logFile }, "Failed to read log file");
			return [];
		}
	}

	/**
	 * Find log file by session name (searches active sessions)
	 */
	static findLogBySession(
		sessionName: string,
		logsDir?: string,
	): string | null {
		const active = SessionLogger.getActiveSessions(logsDir);
		const session = active.find((a) => a.session === sessionName);
		return session?.descriptor || null;
	}
}
