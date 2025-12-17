import { beforeAll, describe, expect, it } from "vitest";
import { ClaudeIPC } from "../../src/core/ipc.js";
import {
    extractProtocolMessages,
    isProtocolMessage,
    parseProtocolMessage,
} from "../../src/core/protocol.js";

describe("ClaudeIPC", () => {
    let ipc: ClaudeIPC;

    beforeAll(() => {
        ipc = new ClaudeIPC("test-runner");
    });

    describe("read()", () => {
        it("returns null for non-existent session", () => {
            const result = ipc.read("nonexistent-session-xyz-123");
            expect(result).toBeNull();
        });

        it("returns string for existing session", () => {
            const sessions = ipc.listSessions();
            if (sessions.length === 0) {
                return; // Skip if no sessions
            }
            const result = ipc.read(sessions[0].name, 5);
            expect(typeof result).toBe("string");
        });
    });

    describe("sessionExists()", () => {
        it("returns false for non-existent session", () => {
            const result = ipc.sessionExists("nonexistent-session-xyz-123");
            expect(result).toBe(false);
        });

        it("returns true for existing session", () => {
            const sessions = ipc.listSessions();
            if (sessions.length === 0) {
                return; // Skip if no sessions
            }
            const result = ipc.sessionExists(sessions[0].name);
            expect(result).toBe(true);
        });
    });

    describe("send()", () => {
        it("returns failure for non-existent session", () => {
            const result = ipc.send(
                "nonexistent-session-xyz-123",
                "test message",
            );
            expect(result.success).toBe(false);
            expect(result.message).toContain("not found");
        });
    });

    describe("listSessions()", () => {
        it("returns an array", () => {
            const sessions = ipc.listSessions();
            expect(Array.isArray(sessions)).toBe(true);
        });

        it("returns sessions with correct shape", () => {
            const sessions = ipc.listSessions();
            if (sessions.length === 0) {
                return; // Skip if no sessions
            }
            const session = sessions[0];
            expect(session).toHaveProperty("name");
            expect(session).toHaveProperty("windows");
            expect(session).toHaveProperty("attached");
        });
    });

    describe("session property", () => {
        it("returns the session name", () => {
            expect(ipc.session).toBe("test-runner");
        });
    });
});

describe("Protocol Parsing", () => {
    describe("parseProtocolMessage()", () => {
        it("parses a status_update message", () => {
            const text = `[PROTOCOL:STATUS_UPDATE] from claude-dev at 2025-12-17T08:00:00Z seq=1
Status: working
Task: Testing the parser`;
            const msg = parseProtocolMessage(text);
            expect(msg).not.toBeNull();
            expect(msg?.type).toBe("status_update");
            expect(msg?.from).toBe("claude-dev");
            expect(msg?.seq).toBe(1);
            if (msg && "status" in msg) {
                expect(msg.status).toBe("working");
                expect(msg.currentTask).toBe("Testing the parser");
            }
        });

        it("parses a heartbeat message", () => {
            const text = `[PROTOCOL:HEARTBEAT] from claude-tester at 2025-12-17T08:00:00Z seq=5
Status: alive
Task: Monitoring`;
            const msg = parseProtocolMessage(text);
            expect(msg).not.toBeNull();
            expect(msg?.type).toBe("heartbeat");
            expect(msg?.seq).toBe(5);
            if (msg && "status" in msg) {
                expect(msg.status).toBe("alive");
            }
        });

        it("parses a task_handoff message", () => {
            const text = `[PROTOCOL:TASK_HANDOFF] from claude-dev at 2025-12-17T08:00:00Z seq=3
Task: Review the login module
Priority: high
Context: User reported auth issues`;
            const msg = parseProtocolMessage(text);
            expect(msg).not.toBeNull();
            expect(msg?.type).toBe("task_handoff");
            if (msg && "task" in msg) {
                expect(msg.task).toBe("Review the login module");
                expect(msg.priority).toBe("high");
                expect(msg.context).toBe("User reported auth issues");
            }
        });

        it("parses an error_notice message", () => {
            const text = `[PROTOCOL:ERROR_NOTICE] from claude-dev at 2025-12-17T08:00:00Z seq=2
Error: Build failed with 3 errors
Recoverable: true
Needs assistance: false`;
            const msg = parseProtocolMessage(text);
            expect(msg).not.toBeNull();
            expect(msg?.type).toBe("error_notice");
            if (msg && "error" in msg) {
                expect(msg.error).toBe("Build failed with 3 errors");
                expect(msg.recoverable).toBe(true);
                expect(msg.needsAssistance).toBe(false);
            }
        });

        it("parses a context_compaction message", () => {
            const text = `[PROTOCOL:CONTEXT_COMPACTION] from claude-dev at 2025-12-17T08:00:00Z seq=4
Summary: Completed initial setup and tests
Retained: IPC protocol, tmux integration, logging system
Current task: Implementing new features`;
            const msg = parseProtocolMessage(text);
            expect(msg).not.toBeNull();
            expect(msg?.type).toBe("context_compaction");
            expect(msg?.seq).toBe(4);
            if (msg && "summary" in msg) {
                expect(msg.summary).toBe("Completed initial setup and tests");
                expect(msg.retainedKnowledge).toEqual([
                    "IPC protocol",
                    "tmux integration",
                    "logging system",
                ]);
                expect(msg.currentTaskState).toBe("Implementing new features");
            }
        });

        it("parses messages without sequence numbers", () => {
            const text = `[PROTOCOL:HEARTBEAT] from claude-dev at 2025-12-17T08:00:00Z
Status: idle`;
            const msg = parseProtocolMessage(text);
            expect(msg).not.toBeNull();
            expect(msg?.seq).toBeUndefined();
        });

        it("returns null for non-protocol text", () => {
            const msg = parseProtocolMessage(
                "Hello, this is just regular text",
            );
            expect(msg).toBeNull();
        });

        it("returns null for malformed protocol message", () => {
            const msg = parseProtocolMessage(
                "[PROTOCOL:INVALID missing fields",
            );
            expect(msg).toBeNull();
        });
    });

    describe("isProtocolMessage()", () => {
        it("returns true for protocol messages", () => {
            expect(isProtocolMessage("[PROTOCOL:HEARTBEAT] from x at y")).toBe(
                true,
            );
            expect(
                isProtocolMessage("[PROTOCOL:STATUS_UPDATE] from x at y"),
            ).toBe(true);
        });

        it("returns false for regular text", () => {
            expect(isProtocolMessage("Hello world")).toBe(false);
            expect(isProtocolMessage("")).toBe(false);
        });
    });

    describe("extractProtocolMessages()", () => {
        it("extracts multiple messages from text", () => {
            const text = `Some preamble text
[PROTOCOL:HEARTBEAT] from claude-dev at 2025-12-17T08:00:00Z seq=1
Status: alive

[PROTOCOL:STATUS_UPDATE] from claude-dev at 2025-12-17T08:00:01Z seq=2
Status: working
Task: Building`;
            const messages = extractProtocolMessages(text);
            expect(messages.length).toBe(2);
            expect(messages[0].type).toBe("heartbeat");
            expect(messages[1].type).toBe("status_update");
        });

        it("returns empty array for text without messages", () => {
            const messages = extractProtocolMessages("Just regular text here");
            expect(messages.length).toBe(0);
        });
    });
});
