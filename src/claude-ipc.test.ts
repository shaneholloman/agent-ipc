import { describe, it, expect, beforeAll } from "vitest";
import { ClaudeIPC } from "./claude-ipc.js";

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
      const result = ipc.send("nonexistent-session-xyz-123", "test message");
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
