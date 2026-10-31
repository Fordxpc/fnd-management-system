import { onRequest } from "./functions/api/[[path]]";

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);

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