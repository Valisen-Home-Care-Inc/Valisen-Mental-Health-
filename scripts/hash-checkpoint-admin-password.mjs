#!/usr/bin/env node

import { pbkdf2, randomBytes } from "node:crypto";
import { promisify } from "node:util";

const derive = promisify(pbkdf2);
const ITERATIONS = 600_000;
const KEY_BYTES = 32;

function readHidden(prompt) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    throw new Error("Run this command in an interactive terminal so the password can stay hidden.");
  }

  return new Promise((resolve, reject) => {
    let value = "";
    process.stdout.write(prompt);
    process.stdin.setEncoding("utf8");
    process.stdin.setRawMode(true);
    process.stdin.resume();

    function finish(error) {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    }

    function onData(chunk) {
      if (chunk === "\u0003") return finish(new Error("Cancelled."));
      if (chunk === "\r" || chunk === "\n") return finish();
      if (chunk === "\u007f" || chunk === "\b") {
        value = value.slice(0, -1);
        return;
      }
      if (!chunk.startsWith("\u001b")) value += chunk;
    }

    process.stdin.on("data", onData);
  });
}

async function main() {
  const password = await readHidden("New checkpoint admin password: ");
  const confirmation = await readHidden("Confirm checkpoint admin password: ");

  if (password !== confirmation) throw new Error("Passwords did not match.");
  if (password.length < 14) throw new Error("Use at least 14 characters.");
  if (Buffer.byteLength(password, "utf8") > 1_024) {
    throw new Error("Password must be no more than 1,024 UTF-8 bytes.");
  }

  const salt = randomBytes(24);
  const digest = await derive(password, salt, ITERATIONS, KEY_BYTES, "sha256");
  const encodedHash = [
    "pbkdf2_sha256",
    String(ITERATIONS),
    salt.toString("base64url"),
    digest.toString("base64url"),
  ].join("$");
  const sessionSecret = randomBytes(48).toString("base64url");
  const attributionRepairSecret = randomBytes(48).toString("base64url");

  process.stdout.write("\nAdd these values to the production environment (do not commit them):\n\n");
  process.stdout.write(`CHECKPOINT_ADMIN_PASSWORD_HASH=${encodedHash}\n`);
  process.stdout.write(`CHECKPOINT_ADMIN_SESSION_SECRET=${sessionSecret}\n`);
  process.stdout.write(`CHECKPOINT_ATTRIBUTION_REPAIR_SECRET=${attributionRepairSecret}\n`);
  process.stdout.write("\nRedeploy after saving all three values.\n");
}

main().catch((error) => {
  process.stderr.write(`\n${error instanceof Error ? error.message : "Unable to create credentials."}\n`);
  process.exitCode = 1;
});
