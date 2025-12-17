#!/usr/bin/env node
import { Command } from "commander";
import { ClaudeIPC } from "./claude-ipc.js";
import logger from "./logger.js";

const ipc = new ClaudeIPC();

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
    process.stdout.write(output + "\n");
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
      options: { timeout: string; poll: string }
    ) => {
      const message = messageParts.join(" ");
      logger.info({ target }, "Asking...");
      try {
        const response = await ipc.sendAndWait(target, message, {
          timeout: parseInt(options.timeout, 10),
          pollInterval: parseInt(options.poll, 10),
        });
        logger.info({ target }, "Response received");
        process.stdout.write(response + "\n");
      } catch (err) {
        logger.error({ error: err instanceof Error ? err.message : "Unknown error" }, "Ask failed");
        process.exit(1);
      }
    }
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

program.parse();
