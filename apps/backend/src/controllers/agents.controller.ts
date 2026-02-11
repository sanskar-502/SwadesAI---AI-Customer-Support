import type { Context } from "hono";
import { agentsService } from "../services/agents.service";

export const listAgentsController = (c: Context) => {
  const agents = agentsService.listAgents();
  return c.json(agents);
};

export const getAgentController = (c: Context) => {
  const id = c.req.param("id");
  if (!id) {
    return c.json({ error: "Agent id is required" }, 400);
  }

  const agent = agentsService.getAgent(id);
  if (!agent) {
    return c.json({ error: "Agent not found" }, 404);
  }

  return c.json(agent);
};
