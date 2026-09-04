import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

export type SourcePosition = { feed: number; radar: number };
export type Follow = { projectId: string; followedAt: string; feed: number; radar: number };
function validPosition(p: SourcePosition) {
  if (![p.feed, p.radar].every(n => Number.isSafeInteger(n) && n >= 0)) throw new Error("Invalid source position.");
}
export class FollowStore {
  private db: DatabaseSync;
  constructor(path = process.env.ARCMAP_MISSIONS_DB || resolve(".data/missions.sqlite")) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS workspace_follows(owner TEXT NOT NULL,project_id TEXT NOT NULL,followed_at TEXT NOT NULL,feed INTEGER NOT NULL,radar INTEGER NOT NULL,PRIMARY KEY(owner,project_id));
      CREATE TABLE IF NOT EXISTS workspace_reviews(owner TEXT PRIMARY KEY,reviewed_at TEXT,feed INTEGER NOT NULL,radar INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS workspace_review_tickets(id TEXT PRIMARY KEY,owner TEXT NOT NULL,created_at INTEGER NOT NULL,feed INTEGER NOT NULL,radar INTEGER NOT NULL);`);
  }
  close() { this.db.close(); }
  list(owner: string): Follow[] {
    return this.db.prepare("SELECT project_id,followed_at,feed,radar FROM workspace_follows WHERE owner=? ORDER BY followed_at DESC,project_id").all(owner)
      .map(r => ({ projectId: String(r.project_id), followedAt: String(r.followed_at), feed: Number(r.feed), radar: Number(r.radar) }));
  }
  position(owner: string) {
    const r=this.db.prepare("SELECT reviewed_at,feed,radar FROM workspace_reviews WHERE owner=?").get(owner);
    return r ? { reviewedAt: r.reviewed_at ? String(r.reviewed_at) : null, feed: Number(r.feed), radar: Number(r.radar) } : null;
  }
  follow(owner: string, projectId: string, position: SourcePosition, now=Date.now()) {
    validPosition(position);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const existing=this.list(owner);
      if(existing.length>=100 && !existing.some(f=>f.projectId===projectId)) throw new Error("Follow up to 100 projects.");
      const at=new Date(now).toISOString();
      this.db.prepare("INSERT OR IGNORE INTO workspace_reviews VALUES(?,?,?,?)").run(owner,at,position.feed,position.radar);
      this.db.prepare("INSERT OR IGNORE INTO workspace_follows VALUES(?,?,?,?,?)").run(owner,projectId,at,position.feed,position.radar);
      this.db.exec("COMMIT");
    } catch(e) { this.db.exec("ROLLBACK"); throw e; }
    return this.list(owner);
  }
  unfollow(owner: string, projectId: string) {
    this.db.prepare("DELETE FROM workspace_follows WHERE owner=? AND project_id=?").run(owner,projectId);
    return this.list(owner);
  }
  ticket(owner: string, through: SourcePosition, now=Date.now()) {
    validPosition(through);
    this.db.prepare("DELETE FROM workspace_review_tickets WHERE created_at<?").run(now-3600000);
    const id=randomUUID();
    this.db.prepare("INSERT INTO workspace_review_tickets VALUES(?,?,?,?,?)").run(id,owner,now,through.feed,through.radar);
    // Keep a bounded number of open tabs/windows per owner.
    this.db.prepare("DELETE FROM workspace_review_tickets WHERE owner=? AND id NOT IN (SELECT id FROM workspace_review_tickets WHERE owner=? ORDER BY created_at DESC,rowid DESC LIMIT 20)").run(owner,owner);
    return id;
  }
  acknowledge(owner: string, id: string, now=Date.now()) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const ticket=this.db.prepare("SELECT * FROM workspace_review_tickets WHERE id=? AND owner=?").get(id,owner);
      if(!ticket || Number(ticket.created_at)<now-3600000) throw new Error("Review window expired. Refresh the changes first.");
      this.db.prepare(`INSERT INTO workspace_reviews VALUES(?,?,?,?) ON CONFLICT(owner) DO UPDATE SET
        reviewed_at=MAX(COALESCE(reviewed_at,''),excluded.reviewed_at),feed=MAX(feed,excluded.feed),radar=MAX(radar,excluded.radar)`)
        .run(owner,new Date(Number(ticket.created_at)).toISOString(),ticket.feed,ticket.radar);
      this.db.prepare("DELETE FROM workspace_review_tickets WHERE id=?").run(id);
      this.db.exec("COMMIT");
    } catch(e) { this.db.exec("ROLLBACK"); throw e; }
  }
}
