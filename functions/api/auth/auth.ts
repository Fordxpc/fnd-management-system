import { auth } from "../../../src/lib/auth.js";

export const onRequest = async (ctx: any) => {
  return auth.handler(ctx.request);
};