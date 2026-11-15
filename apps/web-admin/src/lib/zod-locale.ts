import { z } from "zod";

// zod's built-in messages (e.g. "Invalid URL") in Thai; custom messages are translated by lib/messages-th.ts
z.config(z.locales.th());
