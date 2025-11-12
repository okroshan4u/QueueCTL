// src/Config.js
const fs = require("fs");
const path = require("path");

class Config {
  constructor() {
    this.filePath = path.join(__dirname, "../config.json");
    this.defaultConfig = { "max-retries": 3, "backoff-base": 2 };

    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify(this.defaultConfig, null, 2));
    }
  }

  getAll() {
    return JSON.parse(fs.readFileSync(this.filePath, "utf8"));
  }

  get(key) {
    const data = this.getAll();
    return data[key] ?? null;
  }

  set(key, value) {
    const data = this.getAll();
    data[key] = isNaN(value) ? value : Number(value);
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
  }
}

module.exports = Config;
