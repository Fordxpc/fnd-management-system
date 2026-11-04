import { onRequest } from "./functions/api/[[path]]";
import { getAuth } from "./src/lib/auth";

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);

    // 1. Route Better Auth requests
    if (url.pathname.startsWith("/api/auth/")) {
      try {
        const auth = getAuth(env);
        return await auth.handler(request);
      } catch (err: any) {
        console.error("Better Auth request failed", err);
        return new Response(
          JSON.stringify({
            message: "Authentication service error"
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // 2. Route all other API requests
    if (url.pathname.startsWith("/api/")) {
      const context = {
        request,
        env,
        waitUntil: (promise: Promise<any>) => ctx.waitUntil(promise),
        passThroughOnException: () => ctx.passThroughOnException(),
        next: () => env.ASSETS.fetch(request),
        params: {},
        data: {},
        functionPath: url.pathname,
      };

      return onRequest(context as any);
    }

    // 3. Serve static React files
    return env.ASSETS.fetch(request);
  },
};