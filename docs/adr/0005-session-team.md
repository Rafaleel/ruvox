# ADR 0005 — Coordinate the session agents in code, not with an Agno Team

Accepted for P2-6.

`SessionTeam` (`backend/app/agents/team.py`) runs the planner agent, then the
generator agent, and falls back to the seed planner and generator at each step.
The agents are Agno agents; the coordination between them is plain Python.

Why not `agno.team.Team`: a Team adds a coordinator model call to every session,
which costs time and money and makes the order of steps depend on the model. Here
the order is fixed, every step is validated, and every step has a deterministic
fallback (D11, D12). One session costs two model calls at most.

Rules: no key means no model call at all. If the planner call fails or its plan is
unusable twice, the generator step is skipped. If planning took more than 10 s of the
25 s budget, the generator step is skipped too. `source` is `ai` when either agent
contributed. After each finished session `update_profile` refreshes `UserProfile`
(level and the most-missed items) from our own tables, which the planner reads (D13).

Revisit if a step needs a model-decided delegation that code cannot express.
