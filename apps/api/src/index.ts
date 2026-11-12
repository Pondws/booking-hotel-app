import { app } from "./app";
import { env } from "./env";

app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
  console.log(`CORS web origins: ${env.WEB_ORIGINS.join(", ")}`);
  console.log(`CORS admin origins: ${env.ADMIN_ORIGINS.join(", ")}`);
});
