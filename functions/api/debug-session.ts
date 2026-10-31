import { auth } from "../../src/lib/auth.ts";

export const onRequestGet = async (ctx: any) => {
  const session = await auth.api.getSession({
    headers: ctx.request.headers,
  });

  return Response.json(session);
};
