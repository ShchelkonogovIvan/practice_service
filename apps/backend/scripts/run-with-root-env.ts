import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const [command, ...rawArgs] = process.argv.slice(2);
const args = rawArgs.filter((arg) => arg !== "--");

if (!command) {
  console.error("Usage: tsx scripts/run-with-root-env.ts <command> [...args]");
  process.exit(1);
}

const child = spawn(command, args, {
  env: process.env,
  shell: true,
  stdio: "inherit"
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
