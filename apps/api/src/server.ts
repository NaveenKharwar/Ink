import Fastify from "fastify";
import { registerHealthRoutes } from "./routes/health.js";

const app = Fastify({ logger: true });

registerHealthRoutes(app);

const port = Number(process.env.PORT ?? 3001);

app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
