// In-memory store: used by tests (STORAGE=memory). Not durable.
// Every store implements the same async interface; see storage.contract.test.js.
function createMemoryStore() {
  const users = new Map(); const sessions = new Map(); const profiles = new Map(); let feedback = []; let fbSeq = 0;
  const clone = (o) => (o ? JSON.parse(JSON.stringify(o)) : o);
  return {
    kind: 'memory',
    async init() {},
    async close() {},
    async deleteExpiredSessions(now) { for (const [id, s] of sessions) if (s.expires_at < now) sessions.delete(id); },
    async getSession(id) { return clone(sessions.get(id)) || null; },
    async createSession(s) { sessions.set(s.id, clone(s)); },
    async deleteSession(id) { sessions.delete(id); },
    async getUserById(id) { return clone(users.get(id)) || null; },
    async getUserByEmail(email) { return clone([...users.values()].find((u) => u.email === email)) || null; },
    // Returns false when the email is already registered.
    async createUser(u) {
      if ([...users.values()].some((x) => x.email === u.email)) return false;
      users.set(u.id, clone(u)); return true;
    },
    async hasDemoProfiles() { return [...profiles.values()].some((p) => p.is_demo); },
    async listProfiles(userId) { return [...profiles.values()].filter((p) => p.user_id === userId).map(clone); },
    async listDemoProfiles() { return [...profiles.values()].filter((p) => p.is_demo).map(clone); },
    async countProfiles(userId) { return [...profiles.values()].filter((p) => p.user_id === userId).length; },
    async createProfile(p) { profiles.set(p.id, clone(p)); },
    async getOwnProfile(userId, pid) { const p = profiles.get(pid); return p && p.user_id === userId ? clone(p) : null; },
    async updateProfile(pid, config, title) { const p = profiles.get(pid); if (p) { p.config = clone(config); p.title = title; } },
    async deleteProfile(userId, pid) {
      const p = profiles.get(pid); if (p && p.user_id === userId) profiles.delete(pid);
      feedback = feedback.filter((f) => !(f.profile_id === pid && f.user_id === userId));
    },
    async addFeedback(f) { const id = ++fbSeq; feedback.push(Object.assign({ id }, clone(f))); return id; },
    async listFeedback(userId) { return feedback.filter((f) => f.user_id === userId).map(clone); },
    async listFeedbackForProfile(userId, pid) { return feedback.filter((f) => f.user_id === userId && f.profile_id === pid).map(clone); },
  };
}
module.exports = { createMemoryStore };
