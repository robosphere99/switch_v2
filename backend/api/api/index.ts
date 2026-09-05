import { createServer } from "http";
import { app } from "../src/app.js";

const server = createServer(app);

export default (req: any, res: any) => {
  server.emit("request", req, res);
};
