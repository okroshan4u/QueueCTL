// src/JobQueue.js

const db = require("./DB");
const { nanoid } = require("nanoid");

class JobQueue {
  constructor() {
    this.insertJob = db.prepare(`
      INSERT INTO jobs (id, command, state, attempts, max_retries, created_at, updated_at)
      VALUES (@id, @command, @state, @attempts, @max_retries, @created_at, @updated_at)
    `);

    this.updateState = db.prepare(`
      UPDATE jobs SET state=?, attempts=?, updated_at=?, error=? WHERE id=?
    `);
  }

  async enqueue(job) {
    const now = new Date().toISOString();

    const storedJob = {
      id: job.id || nanoid(),
      command: job.command,
      state: "pending",
      attempts: 0,
      max_retries: job.max_retries || 3,
      created_at: now,
      updated_at: now,
    };

    this.insertJob.run(storedJob);
    return storedJob.id;
  }

  getNextPendingJob() {
    const row = db
      .prepare(
        `SELECT * FROM jobs WHERE state='pending' ORDER BY created_at LIMIT 1`
      )
      .get();

    return row || null;
  }

  markProcessing(id) {
    db.prepare(
      `UPDATE jobs SET state='processing', updated_at=? WHERE id=?`
    ).run(new Date().toISOString(), id);
  }

  markCompleted(id) {
    db.prepare(
      `UPDATE jobs SET state='completed', updated_at=? WHERE id=?`
    ).run(new Date().toISOString(), id);
  }

  markFailed(id, attempts, maxRetries, errorMsg) {
    const now = new Date().toISOString();

    // If this was the final retry, mark as dead
    if (attempts + 1 >= maxRetries) {
      this.updateState.run("dead", attempts + 1, now, errorMsg, id);
    } else {
      this.updateState.run("failed", attempts + 1, now, errorMsg, id);
    }
  }

  // ✅ Added: Allow a failed job to be re-queued for retry
  markPending(jobId) {
    const stmt = db.prepare(
      `UPDATE jobs SET state='pending', updated_at=? WHERE id=?`
    );
    stmt.run(new Date().toISOString(), jobId);
  }

  // ✅ Added: Explicit DLQ helper for clarity
  markDead(jobId, errorMsg) {
    db.prepare(
      `UPDATE jobs SET state='dead', error=?, updated_at=? WHERE id=?`
    ).run(errorMsg, new Date().toISOString(), jobId);
  }

  listJobs(state = null) {
    if (state) {
      return db.prepare(`SELECT * FROM jobs WHERE state=?`).all(state);
    }
    return db.prepare(`SELECT * FROM jobs`).all();
  }

  listDLQ() {
    return db.prepare(`SELECT * FROM jobs WHERE state='dead'`).all();
  }

  retryDLQJob(jobId) {
    return db
      .prepare(
        `UPDATE jobs SET state='pending', attempts=0, updated_at=? WHERE id=?`
      )
      .run(new Date().toISOString(), jobId);
  }

  getStatistics() {
    const stats = {};
    ["pending", "processing", "completed", "failed", "dead"].forEach((state) => {
      const count = db
        .prepare(`SELECT COUNT(*) AS count FROM jobs WHERE state=?`)
        .get(state);
      stats[state] = count.count;
    });
    return stats;
  }
}

module.exports = JobQueue;
