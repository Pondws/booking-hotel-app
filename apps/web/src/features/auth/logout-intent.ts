// Set when the user explicitly clicks "Log out", so RequireAuth redirects to "/"
// instead of /login?next=... Session loss by any other means (expiry, 401) never
// sets it, so RequireAuth still sends the user to /login with ?next then.
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
