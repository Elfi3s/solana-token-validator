// src/config/rateLimit.js
const Bottleneck = require('bottleneck');
const { RATE_LIMITS } = require('./constants');

class RateLimitManager {
  constructor() {
    // Main API limiter - 15 requests per second
    this.mainLimiter = new Bottleneck({
      reservoir: RATE_LIMITS.MAX_REQUESTS_PER_SECOND,
      reservoirRefreshAmount: RATE_LIMITS.MAX_REQUESTS_PER_SECOND,
      reservoirRefreshInterval: 1000, // 1 second
      maxConcurrent: 5,
      minTime: Math.floor(1000 / RATE_LIMITS.MAX_REQUESTS_PER_SECOND) // ~67ms between requests
    });

    // Batch processor limiter
    this.batchLimiter = new Bottleneck({
      maxConcurrent: 2,
      minTime: 100
    });

    // Credit tracking
    this.creditsUsed = 0;
    this.maxCredits = RATE_LIMITS.MAX_TOTAL_CREDITS;

    // Error handling
    this.setupErrorHandling();
  }

  setupErrorHandling() {
    this.mainLimiter.on('failed', (error, jobInfo) => {
      const retryDelay = RATE_LIMITS.RETRY_DELAY * Math.pow(2, jobInfo.retryCount || 0);
      console.warn(`Rate limiter job failed: ${error.message}. Retrying in ${retryDelay}ms`);
      if ((jobInfo.retryCount || 0) < RATE_LIMITS.RETRY_ATTEMPTS) {
        return retryDelay; // Exponential backoff
      }
    });

    this.mainLimiter.on('retry', (error, jobInfo) => {
      console.log(`Retrying job (attempt ${(jobInfo.retryCount || 0) + 1}/${RATE_LIMITS.RETRY_ATTEMPTS})`);
    });
  }

  async executeRequest(requestFunc, credits = 1) {
    // Check credit limit
    if (this.creditsUsed + credits > this.maxCredits) {
      throw new Error(`Credit limit exceeded. Used: ${this.creditsUsed}, Required: ${credits}, Max: ${this.maxCredits}`);
    }

    try {
      const result = await this.mainLimiter.schedule({ priority: 5, weight: credits }, requestFunc);
      this.creditsUsed += credits;
      return result;
    } catch (error) {
      console.error(`Rate limited request failed: ${error.message}`);
      throw error;
    }
  }

  // ... rest of the file remains the same
  
  async executeBatch(requests, batchSize = RATE_LIMITS.BATCH_SIZE) {
    const results = [];
    const batches = [];

    // Split requests into batches
    for (let i = 0; i < requests.length; i += batchSize) {
      batches.push(requests.slice(i, i + batchSize));
    }

    console.log(`Processing ${requests.length} requests in ${batches.length} batches of ${batchSize}`);

    for (const [batchIndex, batch] of batches.entries()) {
      console.log(`Processing batch ${batchIndex + 1}/${batches.length}`);
      
      const batchPromises = batch.map(request => 
        this.executeRequest(request.func, request.credits || 1)
          .catch(error => ({ error: error.message, request: request.id }))
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Add delay between batches to prevent overwhelming the API
      if (batchIndex < batches.length - 1) {
        await this.delay(200);
      }
    }

    return results;
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getUsageStats() {
    return {
      creditsUsed: this.creditsUsed,
      maxCredits: this.maxCredits,
      remainingCredits: this.maxCredits - this.creditsUsed,
      usagePercentage: ((this.creditsUsed / this.maxCredits) * 100).toFixed(2)
    };
  }

  resetCredits() {
    this.creditsUsed = 0;
    console.log('Credit usage reset');
  }
}

module.exports = new RateLimitManager();
