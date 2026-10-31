import { auth } from "../../../src/lib/auth.ts";

export const onRequest = async (context: any) => {
  return auth.handler(context.request);
};