// src/utils/logger.js
const chalk = require("chalk");

class Logger {
  static timestamp() {
    return new Date().toISOString().replace("T", " ").split(".")[0];
  }

  static info(message) {
    console.log(`${chalk.cyan("[INFO]")} ${chalk.gray(this.timestamp())} → ${message}`);
  }

  static success(message) {
    console.log(`${chalk.green("[SUCCESS]")} ${chalk.gray(this.timestamp())} → ${message}`);
  }

  static warn(message) {
    console.log(`${chalk.yellow("[WARN]")} ${chalk.gray(this.timestamp())} → ${message}`);
  }

  static error(message) {
    console.error(`${chalk.red("[ERROR]")} ${chalk.gray(this.timestamp())} → ${message}`);
  }

  static worker(id, message) {
    console.log(`${chalk.magenta(`[WORKER ${id}]`)} ${chalk.gray(this.timestamp())} → ${message}`);
  }
}

module.exports = Logger;
