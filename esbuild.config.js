import { build } from "esbuild";

build({
  entryPoints: ["src/mcp_server/index.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outfile: "dist/mcp_server/index.cjs",
  external: ["onnxruntime-node"],
}).catch((err) => {
  console.error("build fail:", err);
  process.exit(1);
});
