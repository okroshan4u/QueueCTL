// src/workers/Worker.js
const { exec } = require("child_process");
const JobQueue = require("../JobQueue");
const Config = require("../Config");

const jobQueue = new JobQueue();
const config = new Config();

let running = true;

process.on("message", (msg) => {
  if (msg.type === "shutdown") {
    running = false;
  }
});

async function processJobs() {
  while (running) {
    const job = jobQueue.getNextPendingJob();
    if (!job) {
      await sleep(2000);
      continue;
    }

    jobQueue.markProcessing(job.id);
    process.send &&
      process.send({
        type: "worker",
        message: `Processing job ${job.id} (${job.command})`,
      });

    exec(job.command, (err, stdout, stderr) => {
      if (err) {
        jobQueue.markFailed(job.id, job.attempts, job.max_retries, err.message);
        process.send &&
          process.send({
            type: "error",
            message: `Job ${job.id} failed. Error: ${err.message}`,
          });

        if (stderr) {
          process.send &&
            process.send({
              type: "warn",
              message: `stderr: ${stderr.trim()}`,
            });
        }

        const backoff =
          Math.pow(config.get("backoff-base") || 2, job.attempts + 1) * 1000;

        if (job.attempts < job.max_retries) {
          process.send &&
            process.send({
              type: "info",
              message: `Retrying job ${job.id} after ${
                backoff / 1000
              }s (attempt ${job.attempts + 1})`,
            });

          // ✅ Schedule next retry asynchronously
          setTimeout(() => {
            jobQueue.markPending(job.id);
          }, backoff);
        } else {
          jobQueue.markDead(job.id, err.message);
          process.send &&
            process.send({
              type: "error",
              message: `Job ${job.id} moved to DLQ after max retries.`,
            });
        }
      } else {
        if (stdout)
          process.send &&
            process.send({
              type: "info",
              message: `stdout: ${stdout.trim()}`,
            });

        jobQueue.markCompleted(job.id);
        process.send &&
          process.send({
            type: "success",
            message: `Job ${job.id} completed successfully.`,
          });
      }
    });

    await sleep(1000);
  }

  process.exit(0);
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

processJobs();
