import { onRequest as __api_auth___all___ts_onRequest } from "D:\\PROJECTS\\fnd-management-system\\functions\\api\\auth\\[[all]].ts"
import { onRequestPost as __api_import_firebase_users_ts_onRequestPost } from "D:\\PROJECTS\\fnd-management-system\\functions\\api\\import-firebase-users.ts"
import { onRequestPost as __api_import_staff_users_ts_onRequestPost } from "D:\\PROJECTS\\fnd-management-system\\functions\\api\\import-staff-users.ts"
import { onRequest as __api___path___ts_onRequest } from "D:\\PROJECTS\\fnd-management-system\\functions\\api\\[[path]].ts"

export const routes = [
    {
      routePath: "/api/auth/:all*",
      mountPath: "/api/auth",
      method: "",
      middlewares: [],
      modules: [__api_auth___all___ts_onRequest],
    },
  {
      routePath: "/api/import-firebase-users",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_import_firebase_users_ts_onRequestPost],
    },
  {
      routePath: "/api/import-staff-users",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_import_staff_users_ts_onRequestPost],
    },
  {
      routePath: "/api/:path*",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api___path___ts_onRequest],
    },
  ]