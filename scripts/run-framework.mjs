import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readExecutionProfile } from "./execution-profile.mjs";

const [command, ...args] = process.argv.slice(2);
if (!["dev", "build"].includes(command)) throw new Error("Expected dev or build.");
// Vercel's Next.js adapter requires the real .next build artifacts.
if(process.env.VERCEL==='1'||process.env.RITUAL_DEPLOY_TARGET==='vercel'){
 const cli=new URL('../node_modules/next/dist/bin/next',import.meta.url);
 const result=spawnSync(process.execPath,[fileURLToPath(cli),command,...(command==='build'?['--webpack']:[]),...args],{stdio:'inherit',env:process.env});
 if(result.error)throw result.error;
 process.exit(result.status??1);
}
const managedLinux = readExecutionProfile() === "managed-linux";

if (managedLinux && command === "build") {
  const result = spawnSync("bash", [
    fileURLToPath(new URL("./build-verified.sh", import.meta.url)), ...args,
  ], { stdio: "inherit" });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

// Import in this process so the preview owner retains its PID and signals.
const cli = new URL(managedLinux
  ? "../node_modules/vite/bin/vite.js"
  : "../node_modules/vinext/dist/cli.js", import.meta.url);
process.argv = [process.execPath, fileURLToPath(cli), command,
  ...(!managedLinux && command === "dev" ? ["--port", "5173"] : []), ...args];
await import(cli.href);
