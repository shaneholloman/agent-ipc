#!/usr/bin/env node
import { Command } from "commander";
import { ClaudeIPC } from "./core/ipc.js";
import { extractProtocolMessages } from "./core/protocol.js";
import logger from "./utils/logger.js";
import { SessionLogger } from "./utils/logger-session.js";

// CLI commands are stateless - disable logging to avoid descriptor spam
const ipc = new ClaudeIPC({ disableLogging: true });

const program = new Command();

program
	.name("claude-ipc")
	.description("Inter-process communication for Claude Code sessions via tmux")
	.version("1.0.0");

program
	.command("list")
	.alias("ls")
	.description("List all Claude sessions")
	.action(() => {
		const sessions = ipc.listSessions();
		if (sessions.length === 0) {
			logger.info("No Claude sessions found");
			return;
		}
		logger.info({ count: sessions.length }, "Claude sessions");
		for (const s of sessions) {
			const attached = s.attached ? "(attached)" : "";
			const current = s.name === ipc.session ? "(current)" : "";
			logger.info({ session: s.name, windows: s.windows, attached, current });
		}
	});

program
	.command("send")
	.description("Send a message to a Claude session")
	.argument("<target>", "Target session name")
	.argument("<message...>", "Message to send")
	.action((target: string, messageParts: string[]) => {
		const message = messageParts.join(" ");
		const result = ipc.send(target, message);
		if (result.success) {
			logger.info({ target }, "Message sent");
		} else {
			logger.error({ target, error: result.message }, "Send failed");
			process.exit(1);
		}
	});

program
	.command("read")
	.description("Read output from a Claude session")
	.argument("<target>", "Target session name")
	.option("-n, --lines <number>", "Number of lines to read", "50")
	.action((target: string, options: { lines: string }) => {
		const lines = parseInt(options.lines, 10);
		const output = ipc.read(target, lines);
		if (output === null) {
			logger.error({ target }, "Session not found");
			process.exit(1);
		}
		logger.info({ target, lines }, "Pane content:");
		process.stdout.write(`${output}\n`);
	});

program
	.command("ask")
	.description("Send a message and wait for response")
	.argument("<target>", "Target session name")
	.argument("<message...>", "Message to send")
	.option("-t, --timeout <ms>", "Timeout in milliseconds", "60000")
	.option("-p, --poll <ms>", "Poll interval in milliseconds", "2000")
	.action(
		async (
			target: string,
			messageParts: string[],
			options: { timeout: string; poll: string },
		) => {
			const message = messageParts.join(" ");
			logger.info({ target }, "Asking...");
			try {
				const response = await ipc.sendAndWait(target, message, {
					timeout: parseInt(options.timeout, 10),
					pollInterval: parseInt(options.poll, 10),
				});
				logger.info({ target }, "Response received");
				process.stdout.write(`${response}\n`);
			} catch (err) {
				logger.error(
					{ error: err instanceof Error ? err.message : "Unknown error" },
					"Ask failed",
				);
				process.exit(1);
			}
		},
	);

program
	.command("broadcast")
	.description("Send a message to all other Claude sessions")
	.argument("<message...>", "Message to broadcast")
	.action((messageParts: string[]) => {
		const message = messageParts.join(" ");
		const results = ipc.broadcast(message);
		if (results.size === 0) {
			logger.info("No other Claude sessions to broadcast to");
			return;
		}
		for (const [session, result] of results) {
			if (result.success) {
				logger.info({ session }, "Broadcast sent");
			} else {
				logger.error({ session, error: result.message }, "Broadcast failed");
			}
		}
	});

program
	.command("create")
	.description("Create a new Claude session")
	.action(() => {
		const name = ipc.createSession();
		logger.info({ session: name }, "Session created");
	});

program
	.command("kill")
	.description("Kill a specific Claude session")
	.argument("<target>", "Session to kill")
	.action((target: string) => {
		if (ipc.killSession(target)) {
			logger.info({ target }, "Session killed");
		} else {
			logger.error({ target }, "Failed to kill session");
			process.exit(1);
		}
	});

program
	.command("kill-others")
	.description("Kill all Claude sessions except current")
	.action(() => {
		const count = ipc.killOthers();
		logger.info({ count }, "Sessions killed");
	});

program
	.command("kill-all")
	.description("Kill all Claude sessions")
	.action(() => {
		const count = ipc.killAll();
		logger.info({ count }, "Sessions killed");
	});

program
	.command("current")
	.description("Show current session name")
	.action(() => {
		logger.info({ session: ipc.session }, "Current session");
	});

program
	.command("status")
	.description("Show status of all active IPC sessions with their descriptors")
	.action(() => {
		const sessions = ipc.listSessions();
		const active = SessionLogger.getActiveSessions();

		if (sessions.length === 0) {
			logger.info("No Claude sessions found");
			return;
		}

		logger.info({ count: sessions.length }, "Session status:");
		for (const s of sessions) {
			const activeInfo = active.find((a) => a.session === s.name);
			const descriptor = activeInfo?.descriptor || "no-descriptor";
			const attached = s.attached ? "attached" : "detached";
			const current = s.name === ipc.session ? "current" : "";
			logger.info({
				session: s.name,
				descriptor,
				windows: s.windows,
				attached,
				current: current || undefined,
				started: activeInfo?.startedAt,
			});
		}
	});

program
	.command("ping")
	.description("Send a heartbeat to check if a session is responsive")
	.argument("<target>", "Target session name")
	.option("-t, --timeout <ms>", "Timeout in milliseconds", "10000")
	.action(async (target: string, options: { timeout: string }) => {
		if (!ipc.sessionExists(target)) {
			logger.error({ target }, "Session not found");
			process.exit(1);
		}

		logger.info({ target }, "Pinging...");

		// Capture initial state
		const before = ipc.read(target, 30) || "";

		// Send heartbeat directly to target (not broadcast)
		const result = ipc.send(
			target,
			`[PROTOCOL:HEARTBEAT] from ${ipc.session} at ${new Date().toISOString()} seq=0\nStatus: alive\nTask: ping check`,
		);
		if (!result.success) {
			logger.error({ target, error: result.message }, "Failed to send ping");
			process.exit(1);
		}

		// Wait for response
		const timeout = parseInt(options.timeout, 10);
		const startTime = Date.now();
		const pollInterval = 1000;

		while (Date.now() - startTime < timeout) {
			await new Promise((r) => setTimeout(r, pollInterval));
			const after = ipc.read(target, 50) || "";

			// Check if there's new content that looks like a response
			if (after !== before && after.length > before.length) {
				// Look for protocol messages in the new content
				const messages = extractProtocolMessages(after);
				const recentMessages = messages.filter(
					(m) =>
						m.from === target &&
						Date.now() - new Date(m.timestamp).getTime() < timeout,
				);

				if (recentMessages.length > 0) {
					logger.info(
						{ target, latency: Date.now() - startTime },
						"Session is responsive",
					);
					process.exit(0);
				}
			}
		}

		logger.warn(
			{ target, timeout },
			"No response - session may be busy or unresponsive",
		);
		process.exit(1);
	});

program
	.command("parse")
	.description("Parse protocol messages from stdin or a file")
	.option("-f, --file <path>", "File to read from (default: stdin)")
	.action(async (options: { file?: string }) => {
		let input: string;

		if (options.file) {
			const fs = await import("node:fs");
			input = fs.readFileSync(options.file, "utf-8");
		} else {
			// Read from stdin
			const chunks: Buffer[] = [];
			for await (const chunk of process.stdin) {
				chunks.push(chunk);
			}
			input = Buffer.concat(chunks).toString("utf-8");
		}

		const messages = extractProtocolMessages(input);

		if (messages.length === 0) {
			logger.info("No protocol messages found");
			return;
		}

		logger.info({ count: messages.length }, "Protocol messages found:");
		for (const msg of messages) {
			console.log(JSON.stringify(msg, null, 2));
		}
	});

program.parse();
