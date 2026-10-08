CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  severity TEXT,
  status TEXT NOT NULL,
  scenario_key TEXT,
  created_at INTEGER NOT NULL,
  resolved_at INTEGER
);

CREATE TABLE IF NOT EXISTS incident_events (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL,
  run_id TEXT,
  seq INTEGER NOT NULL,
  type TEXT NOT NULL,
  stage TEXT,
  agent_role TEXT,
  payload_json TEXT NOT NULL,
  ts INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL,
  status TEXT NOT NULL,
  mode TEXT NOT NULL,
  llm_provider TEXT,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tool_executions (
  id TEXT PRIMARY KEY,
  run_id TEXT,
  incident_id TEXT,
  tool TEXT NOT NULL,
  args_json TEXT NOT NULL,
  status TEXT NOT NULL,
  duration_ms INTEGER,
  result_json TEXT,
  safety TEXT,
  why TEXT,
  ts INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS remediation_actions (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL,
  run_id TEXT,
  tool TEXT NOT NULL,
  args_json TEXT NOT NULL,
  args_hash TEXT NOT NULL,
  title TEXT,
  rationale TEXT,
  risk TEXT,
  status TEXT NOT NULL,
  decided_at INTEGER,
  executed_at INTEGER
);

CREATE TABLE IF NOT EXISTS verification_results (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL,
  run_id TEXT,
  before_json TEXT NOT NULL,
  after_json TEXT NOT NULL,
  verdict TEXT NOT NULL,
  ts INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  incident_id TEXT PRIMARY KEY,
  markdown TEXT NOT NULL,
  json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS discovered_problems (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT,
  confidence INTEGER,
  type TEXT NOT NULL,
  affected_services_json TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  causes_json TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS incident_evidence (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_incident_seq ON incident_events(incident_id, seq);
CREATE INDEX IF NOT EXISTS idx_runs_incident ON agent_runs(incident_id);
CREATE INDEX IF NOT EXISTS idx_tools_name ON tool_executions(tool);
CREATE INDEX IF NOT EXISTS idx_problems_incident ON discovered_problems(incident_id);
