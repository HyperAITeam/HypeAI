import { describe, it, expect } from "vitest";
import askSlash from "../src/slashCommands/askSlash.js";
import sessionSlash from "../src/slashCommands/sessionSlash.js";
import execSlash from "../src/slashCommands/execSlash.js";
import taskSlash from "../src/slashCommands/taskSlash.js";
import statusSlash from "../src/slashCommands/statusSlash.js";
import helpSlash from "../src/slashCommands/helpSlash.js";

const allCommands = [
  { cmd: askSlash, name: "ask" },
  { cmd: sessionSlash, name: "session" },
  { cmd: execSlash, name: "exec" },
  { cmd: taskSlash, name: "task" },
  { cmd: statusSlash, name: "status" },
  { cmd: helpSlash, name: "help" },
];

describe("SlashCommands", () => {
  for (const { cmd, name } of allCommands) {
    describe(`/${name}`, () => {
      it("should have correct name", () => {
        expect(cmd.data.name).toBe(name);
      });

      it("should have a description", () => {
        const json = cmd.data.toJSON() as { description: string };
        expect(json.description).toBeTruthy();
        expect(typeof json.description).toBe("string");
      });

      it("should have an execute function", () => {
        expect(typeof cmd.execute).toBe("function");
      });

      it("should produce valid JSON structure from toJSON()", () => {
        const json = cmd.data.toJSON();
        expect(json).toBeDefined();
        expect(typeof json).toBe("object");
      });
    });
  }

  it("should have unique command names", () => {
    const names = allCommands.map((c) => c.cmd.data.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });
});
