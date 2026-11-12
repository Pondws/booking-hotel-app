import { app } from "./app";
import { env } from "./env";

app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
  console.log(`CORS origins: ${env.CORS_ORIGINS.join(", ")}`);
});
