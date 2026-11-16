import { Router } from "express";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from "@booking/shared";
import {
  changePassword,
  forgotPassword,
  login,
  logout,
  me,
  register,
  resetPassword,
  updateProfile,
} from "../controllers/auth.controller";
import { loadSession } from "../middleware/load-session";
import { accountLimiter, authLimiter, resetRequestLimiter } from "../middleware/rate-limit";
import { requireAuth } from "../middleware/require-auth";
import { requireRole } from "../middleware/require-role";
import { validate } from "../middleware/validate";

export const authRouter = Router();

const webAuth = [loadSession("WEB"), requireAuth];
const adminAuth = [loadSession("ADMIN"), requireAuth, requireRole("ADMIN", "STAFF")];

authRouter.post("/register", authLimiter, validate({ body: registerSchema }), register);
authRouter.post("/login", authLimiter, accountLimiter, validate({ body: loginSchema }), login("WEB"));
authRouter.post("/logout", loadSession("WEB"), logout("WEB"));
// Forgot password (customers): link by email, then a one-time token. Both rate-limited per IP; requests per email too.
authRouter.post(
  "/forgot-password",
  authLimiter,
  resetRequestLimiter,
  validate({ body: forgotPasswordSchema }),
  forgotPassword,
);
authRouter.post("/reset-password", authLimiter, validate({ body: resetPasswordSchema }), resetPassword);
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
