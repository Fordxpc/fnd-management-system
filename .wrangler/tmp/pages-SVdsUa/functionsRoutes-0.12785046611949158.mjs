import { onRequest as __api_auth___all___ts_onRequest } from "D:\\PROJECTS\\fnd-management-system\\functions\\api\\auth\\[[all]].ts"
import { onRequestPost as __api_create_dev_user_ts_onRequestPost } from "D:\\PROJECTS\\fnd-management-system\\functions\\api\\create-dev-user.ts"
import { onRequestGet as __api_debug_session_ts_onRequestGet } from "D:\\PROJECTS\\fnd-management-system\\functions\\api\\debug-session.ts"
import { onRequestPost as __api_import_firebase_users_ts_onRequestPost } from "D:\\PROJECTS\\fnd-management-system\\functions\\api\\import-firebase-users.ts"
import { onRequestPost as __api_import_staff_users_ts_onRequestPost } from "D:\\PROJECTS\\fnd-management-system\\functions\\api\\import-staff-users.ts"
import { onRequestPost as __api_migrate_all_users_ts_onRequestPost } from "D:\\PROJECTS\\fnd-management-system\\functions\\api\\migrate-all-users.ts"
import { onRequestPost as __api_migrate_user_ts_onRequestPost } from "D:\\PROJECTS\\fnd-management-system\\functions\\api\\migrate-user.ts"
import { onRequestPost as __api_reset_developer_ts_onRequestPost } from "D:\\PROJECTS\\fnd-management-system\\functions\\api\\reset-developer.ts"
import { onRequestPost as __api_test_better_auth_ts_onRequestPost } from "D:\\PROJECTS\\fnd-management-system\\functions\\api\\test-better-auth.ts"
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
      routePath: "/api/create-dev-user",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_create_dev_user_ts_onRequestPost],
    },
  {
      routePath: "/api/debug-session",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_debug_session_ts_onRequestGet],
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
      routePath: "/api/migrate-all-users",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_migrate_all_users_ts_onRequestPost],
    },
  {
      routePath: "/api/migrate-user",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_migrate_user_ts_onRequestPost],
    },
  {
      routePath: "/api/reset-developer",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_reset_developer_ts_onRequestPost],
    },
  {
      routePath: "/api/test-better-auth",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_test_better_auth_ts_onRequestPost],
    },
  {
      routePath: "/api/:path*",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api___path___ts_onRequest],
    },
  ]