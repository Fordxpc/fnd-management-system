import { onRequest } from "./functions/api/[[path]]";
import { getAuth } from "./src/lib/auth";

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/auth/")) {
      const auth = getAuth(env);
      try {
        return await auth.handler(request);
      } catch (err: any) {
        // This will print the underlying Postgres error
        console.error("BETTER AUTH CRASH:", err.cause || err); 
        return new Response(
          JSON.stringify({ 
            message: "Better Auth crashed", 
            error: err.message, 
            cause: err.cause?.message || String(err.cause)
          }), 
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

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

    return env.ASSETS.fetch(request);
  },
};