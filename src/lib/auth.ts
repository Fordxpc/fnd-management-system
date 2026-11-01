import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import * as schema from "../db/schema";

// This tells TypeScript to ignore the red line for process.env in Cloudflare Workers
declare const process: any; 

// Fallbacks are provided just in case, but these should be set in wrangler.toml or Cloudflare Secrets
const APP_URL = process.env.BETTER_AUTH_URL || "https://management.funadhooairport.com";
const AUTH_SECRET = process.env.BETTER_AUTH_SECRET || "lvbme4++789LX827t+nxsRmpjbzfEEpTI4BMtvQr304=";

export const auth = betterAuth({
  baseURL: APP_URL,
  secret: AUTH_SECRET, // <-- This is the critical fix for the 500 error
  trustedOrigins: [APP_URL],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
      },
      department: {
        type: "string",
        required: false,
      },
    },
  },
});