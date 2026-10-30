import { auth } from "../../../src/lib/auth.ts";

export const onRequest = async (ctx: any) => {
  return auth.handler(ctx.request);
};