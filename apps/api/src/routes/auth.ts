import { Router } from "express";
import { loginSchema, registerSchema } from "@booking/shared";
import { login, logout, me, register } from "../controllers/auth.controller";
import { loadSession } from "../middleware/load-session";
import { authLimiter } from "../middleware/rate-limit";
import { requireAuth } from "../middleware/require-auth";
import { requireRole } from "../middleware/require-role";
import { validate } from "../middleware/validate";

export const authRouter = Router();

authRouter.post("/register", authLimiter, validate({ body: registerSchema }), register);
authRouter.post("/login", authLimiter, validate({ body: loginSchema }), login("WEB"));
authRouter.post("/logout", loadSession("WEB"), logout("WEB"));
authRouter.get("/me", loadSession("WEB"), requireAuth, me);

authRouter.post("/admin/login", authLimiter, validate({ body: loginSchema }), login("ADMIN"));
authRouter.post("/admin/logout", loadSession("ADMIN"), logout("ADMIN"));
authRouter.get(
  "/admin/me",
  loadSession("ADMIN"),
  requireAuth,
  requireRole("ADMIN", "STAFF"),
  me,
);
