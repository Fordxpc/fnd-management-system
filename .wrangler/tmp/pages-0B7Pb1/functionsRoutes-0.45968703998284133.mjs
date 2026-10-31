import { onRequest as __api_auth_auth_disabled_ts_onRequest } from "D:\\PROJECTS\\fnd-management-system\\functions\\api\\auth\\auth.disabled.ts"
import { onRequest as __api___path___ts_onRequest } from "D:\\PROJECTS\\fnd-management-system\\functions\\api\\[[path]].ts"

export const routes = [
    {
      routePath: "/api/auth/auth.disabled",
      mountPath: "/api/auth",
      method: "",
      middlewares: [],
      modules: [__api_auth_auth_disabled_ts_onRequest],
    },
  {
      routePath: "/api/:path*",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api___path___ts_onRequest],
    },
  ]