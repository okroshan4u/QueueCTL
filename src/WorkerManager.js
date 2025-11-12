// src/WorkerManager.js

const { fork } = require("child_process");
const path = require("path");

class WorkerManager {
  constructor(jobQueue) {
    this.jobQueue = jobQueue;
    this.workers = [];
    this.startTime = null;
  }

  async startWorkers(count = 1) {
    this.startTime = Date.now();
    const workerPath = path.join(__dirname, "workers", "Worker.js");

    for (let i = 0; i < count; i++) {
      const worker = fork(workerPath);
      this.workers.push(worker);

      worker.on("message", (msg) => {
        if (msg.type === "log") {
          console.log(`[Worker ${worker.pid}] ${msg.message}`);
        } else if (msg.type === "error") {
          console.error(`[Worker ${worker.pid}] Error: ${msg.message}`);
        }
      });

      worker.on("exit", (code) => {
        console.log(`⚠️  Worker ${worker.pid} exited with code ${code}`);
        this.workers = this.workers.filter((w) => w.pid !== worker.pid);
      });
    }
  }

  async stopWorkers() {
    for (const worker of this.workers) {
      worker.send({ type: "shutdown" });
      await new Promise((res) => setTimeout(res, 100)); // let them finish
    }
    this.workers = [];
  }

  getWorkerStatus() {
    return {
      total: this.workers.length,
      active: this.workers.length,
      uptime: this.startTime ? Date.now() - this.startTime : 0,
    };
  }
}

module.exports = WorkerManager;
