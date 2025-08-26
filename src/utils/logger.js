
// src/utils/logger.js
const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.logDir = 'logs';

    // Create logs directory if it doesn't exist
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir);
    }

    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
  }

  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...(data && { data })
    };

    return JSON.stringify(logEntry);
  }

  shouldLog(level) {
    return this.levels[level] <= this.levels[this.logLevel];
  }

  writeToFile(level, message, data = null) {
    if (!this.shouldLog(level)) return;

    const logFile = path.join(this.logDir, `${level}.log`);
    const logMessage = this.formatMessage(level, message, data);

    fs.appendFileSync(logFile, logMessage + '\n');
  }

  error(message, data = null) {
    if (this.shouldLog('error')) {
      console.error(`[ERROR] ${message}`, data || '');
      this.writeToFile('error', message, data);
    }
  }

  warn(message, data = null) {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN] ${message}`, data || '');
      this.writeToFile('warn', message, data);
    }
  }

  info(message, data = null) {
    if (this.shouldLog('info')) {
      console.info(`[INFO] ${message}`, data || '');
      this.writeToFile('info', message, data);
    }
  }

  debug(message, data = null) {
    if (this.shouldLog('debug')) {
      console.debug(`[DEBUG] ${message}`, data || '');
      this.writeToFile('debug', message, data);
    }
  }

  logAnalysisResult(tokenAddress, result) {
    const logData = {
      token: tokenAddress,
      timestamp: new Date().toISOString(),
      riskScore: result.overallRiskScore,
      safetyLevel: result.safetyLevel,
      criticalIssues: result.analysis.filter(a => a.severity === 'CRITICAL').length
    };

    this.info('Token analysis completed', logData);

    // Also write to analysis results file
    const resultsFile = path.join(this.logDir, 'analysis_results.jsonl');
    fs.appendFileSync(resultsFile, JSON.stringify(logData) + '\n');
  }
}

module.exports = new Logger();
