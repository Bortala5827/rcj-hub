import { onRequestGet as __api_admin_data_js_onRequestGet } from "C:\\Users\\小样儿\\Desktop\\products\\_repos\\rcj-hub\\functions\\api\\admin\\data.js"
import { onRequestGet as __api_admin_health_js_onRequestGet } from "C:\\Users\\小样儿\\Desktop\\products\\_repos\\rcj-hub\\functions\\api\\admin\\health.js"
import { onRequestPost as __api_admin_login_js_onRequestPost } from "C:\\Users\\小样儿\\Desktop\\products\\_repos\\rcj-hub\\functions\\api\\admin\\login.js"
import { onRequestPost as __api_admin_logout_js_onRequestPost } from "C:\\Users\\小样儿\\Desktop\\products\\_repos\\rcj-hub\\functions\\api\\admin\\logout.js"
import { onRequestGet as __api_admin_migrate_js_onRequestGet } from "C:\\Users\\小样儿\\Desktop\\products\\_repos\\rcj-hub\\functions\\api\\admin\\migrate.js"
import { onRequest as __api_admin_commute_chat_js_onRequest } from "C:\\Users\\小样儿\\Desktop\\products\\_repos\\rcj-hub\\functions\\api\\admin\\commute-chat.js"
import { onRequest as __api_admin_wall_js_onRequest } from "C:\\Users\\小样儿\\Desktop\\products\\_repos\\rcj-hub\\functions\\api\\admin\\wall.js"
import { onRequestGet as __api_ai_chat_js_onRequestGet } from "C:\\Users\\小样儿\\Desktop\\products\\_repos\\rcj-hub\\functions\\api\\ai-chat.js"
import { onRequestOptions as __api_ai_chat_js_onRequestOptions } from "C:\\Users\\小样儿\\Desktop\\products\\_repos\\rcj-hub\\functions\\api\\ai-chat.js"
import { onRequestPost as __api_ai_chat_js_onRequestPost } from "C:\\Users\\小样儿\\Desktop\\products\\_repos\\rcj-hub\\functions\\api\\ai-chat.js"
import { onRequestOptions as __api_ai_track_js_onRequestOptions } from "C:\\Users\\小样儿\\Desktop\\products\\_repos\\rcj-hub\\functions\\api\\ai-track.js"
import { onRequestPost as __api_ai_track_js_onRequestPost } from "C:\\Users\\小样儿\\Desktop\\products\\_repos\\rcj-hub\\functions\\api\\ai-track.js"
import { onRequestGet as __api_commute_chat_js_onRequestGet } from "C:\\Users\\小样儿\\Desktop\\products\\_repos\\rcj-hub\\functions\\api\\commute-chat.js"
import { onRequestOptions as __api_commute_chat_js_onRequestOptions } from "C:\\Users\\小样儿\\Desktop\\products\\_repos\\rcj-hub\\functions\\api\\commute-chat.js"
import { onRequestPost as __api_commute_chat_js_onRequestPost } from "C:\\Users\\小样儿\\Desktop\\products\\_repos\\rcj-hub\\functions\\api\\commute-chat.js"
import { onRequestGet as __api_moment_js_onRequestGet } from "C:\\Users\\小样儿\\Desktop\\products\\_repos\\rcj-hub\\functions\\api\\moment.js"
import { onRequestOptions as __api_moment_js_onRequestOptions } from "C:\\Users\\小样儿\\Desktop\\products\\_repos\\rcj-hub\\functions\\api\\moment.js"
import { onRequestPost as __api_moment_js_onRequestPost } from "C:\\Users\\小样儿\\Desktop\\products\\_repos\\rcj-hub\\functions\\api\\moment.js"
import { onRequestDelete as __api_notes_js_onRequestDelete } from "C:\\Users\\小样儿\\Desktop\\products\\_repos\\rcj-hub\\functions\\api\\notes.js"
import { onRequestGet as __api_notes_js_onRequestGet } from "C:\\Users\\小样儿\\Desktop\\products\\_repos\\rcj-hub\\functions\\api\\notes.js"
import { onRequestPost as __api_notes_js_onRequestPost } from "C:\\Users\\小样儿\\Desktop\\products\\_repos\\rcj-hub\\functions\\api\\notes.js"
import { onRequestOptions as __api_probe_js_onRequestOptions } from "C:\\Users\\小样儿\\Desktop\\products\\_repos\\rcj-hub\\functions\\api\\probe.js"
import { onRequestPost as __api_probe_js_onRequestPost } from "C:\\Users\\小样儿\\Desktop\\products\\_repos\\rcj-hub\\functions\\api\\probe.js"
import { onRequestOptions as __api_track_js_onRequestOptions } from "C:\\Users\\小样儿\\Desktop\\products\\_repos\\rcj-hub\\functions\\api\\track.js"
import { onRequest as __api_track_js_onRequest } from "C:\\Users\\小样儿\\Desktop\\products\\_repos\\rcj-hub\\functions\\api\\track.js"

export const routes = [
    {
      routePath: "/api/admin/data",
      mountPath: "/api/admin",
      method: "GET",
      middlewares: [],
      modules: [__api_admin_data_js_onRequestGet],
    },
  {
      routePath: "/api/admin/health",
      mountPath: "/api/admin",
      method: "GET",
      middlewares: [],
      modules: [__api_admin_health_js_onRequestGet],
    },
  {
      routePath: "/api/admin/login",
      mountPath: "/api/admin",
      method: "POST",
      middlewares: [],
      modules: [__api_admin_login_js_onRequestPost],
    },
  {
      routePath: "/api/admin/logout",
      mountPath: "/api/admin",
      method: "POST",
      middlewares: [],
      modules: [__api_admin_logout_js_onRequestPost],
    },
  {
      routePath: "/api/admin/migrate",
      mountPath: "/api/admin",
      method: "GET",
      middlewares: [],
      modules: [__api_admin_migrate_js_onRequestGet],
    },
  {
      routePath: "/api/admin/commute-chat",
      mountPath: "/api/admin",
      method: "",
      middlewares: [],
      modules: [__api_admin_commute_chat_js_onRequest],
    },
  {
      routePath: "/api/admin/wall",
      mountPath: "/api/admin",
      method: "",
      middlewares: [],
      modules: [__api_admin_wall_js_onRequest],
    },
  {
      routePath: "/api/ai-chat",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_ai_chat_js_onRequestGet],
    },
  {
      routePath: "/api/ai-chat",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_ai_chat_js_onRequestOptions],
    },
  {
      routePath: "/api/ai-chat",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_ai_chat_js_onRequestPost],
    },
  {
      routePath: "/api/ai-track",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_ai_track_js_onRequestOptions],
    },
  {
      routePath: "/api/ai-track",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_ai_track_js_onRequestPost],
    },
  {
      routePath: "/api/commute-chat",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_commute_chat_js_onRequestGet],
    },
  {
      routePath: "/api/commute-chat",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_commute_chat_js_onRequestOptions],
    },
  {
      routePath: "/api/commute-chat",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_commute_chat_js_onRequestPost],
    },
  {
      routePath: "/api/moment",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_moment_js_onRequestGet],
    },
  {
      routePath: "/api/moment",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_moment_js_onRequestOptions],
    },
  {
      routePath: "/api/moment",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_moment_js_onRequestPost],
    },
  {
      routePath: "/api/notes",
      mountPath: "/api",
      method: "DELETE",
      middlewares: [],
      modules: [__api_notes_js_onRequestDelete],
    },
  {
      routePath: "/api/notes",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_notes_js_onRequestGet],
    },
  {
      routePath: "/api/notes",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_notes_js_onRequestPost],
    },
  {
      routePath: "/api/probe",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_probe_js_onRequestOptions],
    },
  {
      routePath: "/api/probe",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_probe_js_onRequestPost],
    },
  {
      routePath: "/api/track",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_track_js_onRequestOptions],
    },
  {
      routePath: "/api/track",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_track_js_onRequest],
    },
  ]