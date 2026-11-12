// Set when the user explicitly clicks "Log out", so RequireAuth does not race the
// navigation to "/" with its own redirect to /login. Session loss by any other
// means (expiry, 401) never sets it, so RequireAuth still redirects then.
let explicitLogout = false;

export function markExplicitLogout(): void {
  explicitLogout = true;
}

export function resetExplicitLogout(): void {
  explicitLogout = false;
}

export function isExplicitLogout(): boolean {
  return explicitLogout;
}
