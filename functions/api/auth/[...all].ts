import { auth } from "../../../src/lib/auth";

export const onRequest = async (ctx: any) => {
  return auth.handler(ctx.request);
};