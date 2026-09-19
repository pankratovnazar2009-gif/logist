import express from "express";
import cors from "cors";
import { env } from "./lib/env";
import { authRouter } from "./routes/auth";
import { usersRouter } from "./routes/users";
import { nipRouter } from "./routes/nip";
import { loadsRouter } from "./routes/loads";
import { internalRouter } from "./routes/internal";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/nip", nipRouter);
app.use("/api/loads", loadsRouter);
app.use("/api/internal", internalRouter);

app.listen(env.PORT, () => {
  console.log(`Logist Matchmaker backend listening on :${env.PORT}`);
});
