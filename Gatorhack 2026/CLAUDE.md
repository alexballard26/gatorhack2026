# Hackathon Workspace

AI hackathon project. The challenge brief arrives on hackathon day and goes in `BRIEF.md`.

## Team structure

**Opus (main session) = orchestrator / lead.**
- Owns strategy, architecture, and hard reasoning.
- Reads the brief, picks the approach, breaks the work into subtasks, and keeps `PLAN.md` current.
- Delegates; does not write bulk code itself unless a task is small or needs cross-cutting judgment.
- Reviews and integrates what the workers return, and owns the final demo/submission.

**Sonnet = workers** (`worker` agent, model: sonnet).
- Coding, feature development, UI design, tests, debugging.
- Each gets one well-scoped task: files/area it owns, acceptance criteria, and interfaces it must respect.
- Two workers never edit the same files at the same time; parallel workers get isolated worktrees when their files may overlap.

**Haiku = assistants** (`assistant` agent, model: haiku).
- Lookups: docs, API references, library usage, quick web research.
- Simple content: sample data, copy text, README sections, slide/pitch text drafts.
- Never makes architecture decisions.

## Delegation rules
- Brief every agent as if it has no context: goal, files, constraints, definition of done.
- Run independent tasks in parallel; sequence tasks that depend on each other.
- Opus verifies every result (runs it, reads the diff) before marking a task done in `PLAN.md`.

## Hackathon priorities
1. A working end-to-end demo early; polish later.
2. Cut scope before cutting quality of the core feature.
3. Keep the pitch in mind: what the judges see in 3 minutes.
