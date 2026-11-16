import { Router } from "express";
import { changePasswordSchema, loginSchema, registerSchema, updateProfileSchema } from "@booking/shared";
import {
  changePassword,
  login,
  logout,
  me,
  register,
  updateProfile,
} from "../controllers/auth.controller";
import { loadSession } from "../middleware/load-session";
import { accountLimiter, authLimiter } from "../middleware/rate-limit";
import { requireAuth } from "../middleware/require-auth";
import { requireRole } from "../middleware/require-role";
import { validate } from "../middleware/validate";

export const authRouter = Router();

const webAuth = [loadSession("WEB"), requireAuth];
const adminAuth = [loadSession("ADMIN"), requireAuth, requireRole("ADMIN", "STAFF")];

authRouter.post("/register", authLimiter, validate({ body: registerSchema }), register);
authRouter.post("/login", authLimiter, accountLimiter, validate({ body: loginSchema }), login("WEB"));
authRouter.post("/logout", loadSession("WEB"), logout("WEB"));
authRouter.get("/me", ...webAuth, me);
authRouter.patch("/me", ...webAuth, validate({ body: updateProfileSchema }), updateProfile);
// Rate-limited like login: a stolen session must not be able to brute-force the current password.
authRouter.post(
  "/me/password",
  authLimiter,
  ...webAuth,
  validate({ body: changePasswordSchema }),
  changePassword,
);

authRouter.post("/admin/login", authLimiter, accountLimiter, validate({ body: loginSchema }), login("ADMIN"));
authRouter.post("/admin/logout", loadSession("ADMIN"), logout("ADMIN"));
authRouter.get("/admin/me", ...adminAuth, me);
authRouter.patch("/admin/me", ...adminAuth, validate({ body: updateProfileSchema }), updateProfile);
authRouter.post(
  "/admin/me/password",
  authLimiter,
  ...adminAuth,
  validate({ body: changePasswordSchema }),
  changePassword,
);
