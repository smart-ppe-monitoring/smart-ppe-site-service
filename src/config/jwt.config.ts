import fs from "fs";
import path from "path";
import { envConfig } from "./env.config";

function resolvePublicKey(): string {
  if (envConfig.jwt.publicKey && envConfig.jwt.publicKey.length > 0) {
    let key = envConfig.jwt.publicKey.trim();
    if (key.startsWith('"') && key.endsWith('"')) {
      key = key.slice(1, -1);
    }
    return key.replace(/\\n/g, "\n");
  }

  const candidatePaths = [
    path.resolve(process.cwd(), "keys", "public.key.pem"),
    path.resolve(process.cwd(), "keys", "public.pem"),
    path.resolve(__dirname, "../../keys", "public.key.pem"),
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        return fs.readFileSync(p, "utf-8").trim();
      } catch {}
    }
  }

  return "";
}

export const jwtConfig = {
  ...envConfig.jwt,
  publicKey: resolvePublicKey(),
};
