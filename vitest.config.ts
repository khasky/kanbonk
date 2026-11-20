import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Time budgets measure wall-clock time, so they run alone after the unit tests: measured while
// dozens of other test files compete for the CPU, they test the machine's load, not the code.
const perf = ["tests/heavyBoard.test.ts"];

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        extends: true,
        test: { name: "unit", exclude: [...configDefaults.exclude, ...perf], sequence: { groupOrder: 0 } },
      },
      { extends: true, test: { name: "perf", include: perf, fileParallelism: false, sequence: { groupOrder: 1 } } },
    ],
  },
});
