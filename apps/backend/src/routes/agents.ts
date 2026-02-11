import { Hono } from "hono";
import {
  getAgentController,
  listAgentsController,
} from "../controllers/agents.controller";

export const agentsRoutes = new Hono()
  .get("/", listAgentsController)
  .get("/:id", getAgentController);

export type AgentsRouteType = typeof agentsRoutes;
