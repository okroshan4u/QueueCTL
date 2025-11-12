#!/usr/bin/env node

const { Command } = require("commander");
const JobQueue = require("./src/JobQueue");
const WorkerManager = require("./src/WorkerManager");
const Config = require("./src/Config");
const { formatTable, formatJson } = require("./src/utils/formatter");
const Logger = require("./src/utils/logger"); // ✅ Added Logger

const program = new Command();
const jobQueue = new JobQueue();
const workerManager = new WorkerManager(jobQueue);
const config = new Config();

program
  .name("queuectl")
  .description("CLI-based background job queue system")
  .version("1.0.0");

// ======================= ENQUEUE ===========================
program
  .command("enqueue <job>")
  .description("Add a new job to the queue")
  .action(async (jobData) => {
    try {
      const job = JSON.parse(jobData);
      const jobId = await jobQueue.enqueue(job);
      Logger.success(`Job enqueued successfully with ID: ${jobId}`);
    } catch (error) {
      Logger.error(`Error enqueuing job: ${error.message}`);
      process.exit(1);
    }
  });

// ======================= WORKERS ===========================
const worker = program.command("worker").description("Manage worker processes");

worker
  .command("start")
  .description("Start worker processes")
  .option("-c, --count <number>", "Number of workers to start", "1")
  .action(async (options) => {
    try {
      const count = parseInt(options.count);
      await workerManager.startWorkers(count);
      Logger.success(`Started ${count} worker(s)`);

      process.on("SIGINT", async () => {
        Logger.warn("Received SIGINT, shutting down gracefully...");
        await workerManager.stopWorkers();
        process.exit(0);
      });

      process.on("SIGTERM", async () => {
        Logger.warn("Received SIGTERM, shutting down gracefully...");
        await workerManager.stopWorkers();
        process.exit(0);
      });
    } catch (error) {
      Logger.error(`Error starting workers: ${error.message}`);
      process.exit(1);
    }
  });

worker
  .command("stop")
  .description("Stop all running workers gracefully")
  .action(async () => {
    try {
      await workerManager.stopWorkers();
      Logger.success("All workers stopped gracefully.");
      process.exit(0);
    } catch (error) {
      Logger.error(`Error stopping workers: ${error.message}`);
      process.exit(1);
    }
  });

// ======================= STATUS ===========================
program
  .command("status")
  .description("Show summary of all job states and active workers")
  .action(async () => {
    try {
      const stats = await jobQueue.getStatistics();
      const workers = workerManager.getWorkerStatus();

      Logger.info("📊 Queue Status\n");
      console.log(
        formatTable([
          ["State", "Count"],
          ["Pending", stats.pending],
          ["Processing", stats.processing],
          ["Completed", stats.completed],
          ["Failed", stats.failed],
          ["Dead (DLQ)", stats.dead],
        ])
      );

      Logger.info(
        `👷 Active Workers: ${workers.active}/${workers.total} | ⏱ Uptime: ${Math.floor(
          workers.uptime / 1000
        )}s\n`
      );
    } catch (error) {
      Logger.error(`Error fetching status: ${error.message}`);
      process.exit(1);
    }
  });

// ======================= LIST JOBS ===========================
program
  .command("list")
  .description("List jobs by state")
  .option(
    "-s, --state <state>",
    "Filter by state (pending|processing|completed|failed|dead)"
  )
  .action(async (options) => {
    try {
      const jobs = await jobQueue.listJobs(options.state);

      if (jobs.length === 0) {
        Logger.info(
          `No jobs found${options.state ? ` with state: ${options.state}` : ""}`
        );
        return;
      }

      const tableData = [["ID", "Command", "State", "Attempts", "Created"]];
      jobs.forEach((job) => {
        tableData.push([
          job.id,
          job.command.substring(0, 30) +
            (job.command.length > 30 ? "..." : ""),
          job.state,
          `${job.attempts}/${job.max_retries}`,
          new Date(job.created_at).toLocaleString(),
        ]);
      });

      console.log("\n" + formatTable(tableData) + "\n");
    } catch (error) {
      Logger.error(`Error listing jobs: ${error.message}`);
      process.exit(1);
    }
  });

// ======================= DLQ ===========================
const dlq = program.command("dlq").description("Manage Dead Letter Queue");

dlq
  .command("list")
  .description("List all jobs in the Dead Letter Queue")
  .action(async () => {
    try {
      const jobs = await jobQueue.listDLQ();

      if (jobs.length === 0) {
        Logger.info("Dead Letter Queue is empty.");
        return;
      }

      const tableData = [
        ["ID", "Command", "Attempts", "Last Error", "Failed At"],
      ];
      jobs.forEach((job) => {
        tableData.push([
          job.id,
          job.command.substring(0, 25) +
            (job.command.length > 25 ? "..." : ""),
          job.attempts,
          (job.error || "Unknown").substring(0, 30),
          new Date(job.updated_at).toLocaleString(),
        ]);
      });

      console.log("\n" + formatTable(tableData) + "\n");
    } catch (error) {
      Logger.error(`Error listing DLQ: ${error.message}`);
      process.exit(1);
    }
  });

dlq
  .command("retry <jobId>")
  .description("Retry a job from the Dead Letter Queue")
  .action(async (jobId) => {
    try {
      await jobQueue.retryDLQJob(jobId);
      Logger.success(`Job ${jobId} moved back to pending queue.`);
    } catch (error) {
      Logger.error(`Error retrying job: ${error.message}`);
      process.exit(1);
    }
  });

// ======================= CONFIG ===========================
const configCmd = program.command("config").description("Manage configuration");

configCmd
  .command("set <key> <value>")
  .description("Set a configuration value (max-retries, backoff-base)")
  .action(async (key, value) => {
    try {
      config.set(key, value);
      Logger.success(`Configuration updated: ${key} = ${value}`);
    } catch (error) {
      Logger.error(`Error setting config: ${error.message}`);
      process.exit(1);
    }
  });

configCmd
  .command("get [key]")
  .description("Get configuration value(s)")
  .action(async (key) => {
    try {
      if (key) {
        const value = config.get(key);
        Logger.info(`${key} = ${value}`);
      } else {
        const allConfig = config.getAll();
        console.log("\n" + formatJson(allConfig) + "\n");
      }
    } catch (error) {
      Logger.error(`Error getting config: ${error.message}`);
      process.exit(1);
    }
  });

// ======================= PARSE & HELP ===========================
program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}

