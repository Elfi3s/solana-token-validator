
// src/utils/batchProcessor.js
const logger = require('./logger');

class BatchProcessor {
  constructor() {
    this.defaultBatchSize = 10;
    this.defaultConcurrency = 3;
    this.defaultDelay = 100;
  }

  async processBatch(items, processor, options = {}) {
    const {
      batchSize = this.defaultBatchSize,
      concurrency = this.defaultConcurrency,
      delay = this.defaultDelay,
      onProgress = null,
      onBatchComplete = null,
      onError = 'continue' // 'continue', 'stop', 'retry'
    } = options;

    logger.info(`Processing ${items.length} items in batches of ${batchSize} with concurrency ${concurrency}`);

    const results = [];
    const errors = [];
    let processed = 0;

    // Split items into batches
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push({
        items: items.slice(i, i + batchSize),
        batchIndex: Math.floor(i / batchSize),
        startIndex: i
      });
    }

    // Process batches with limited concurrency
    const semaphore = new Semaphore(concurrency);

    const batchPromises = batches.map(batch => 
      semaphore.acquire().then(async (release) => {
        try {
          const batchResults = await this.processSingleBatch(
            batch.items,
            processor,
            { delay, batchIndex: batch.batchIndex, startIndex: batch.startIndex }
          );

          processed += batch.items.length;

          if (onProgress) {
            onProgress({
              processed,
              total: items.length,
              percentage: Math.round((processed / items.length) * 100),
              batchIndex: batch.batchIndex
            });
          }

          if (onBatchComplete) {
            onBatchComplete({
              batchIndex: batch.batchIndex,
              results: batchResults,
              itemsProcessed: batch.items.length
            });
          }

          return batchResults;
        } catch (error) {
          logger.error(`Batch ${batch.batchIndex} failed:`, error.message);

          if (onError === 'stop') {
            throw error;
          } else if (onError === 'retry') {
            // Simple retry logic - in production, you might want more sophisticated retry
            logger.info(`Retrying batch ${batch.batchIndex}`);
            return this.processSingleBatch(batch.items, processor, { 
              delay, 
              batchIndex: batch.batchIndex, 
              startIndex: batch.startIndex 
            });
          } else {
            // Continue with errors
            errors.push({
              batchIndex: batch.batchIndex,
              error: error.message,
              items: batch.items
            });
            return batch.items.map(item => ({ item, error: error.message }));
          }
        } finally {
          release();
        }
      })
    );

    try {
      const allBatchResults = await Promise.all(batchPromises);

      // Flatten results
      for (const batchResult of allBatchResults) {
        results.push(...batchResult);
      }

      logger.info(`Batch processing completed: ${results.length} items processed`);

      return {
        results,
        errors,
        totalProcessed: results.length,
        successCount: results.filter(r => !r.error).length,
        errorCount: results.filter(r => r.error).length
      };

    } catch (error) {
      logger.error('Batch processing failed:', error.message);
      throw error;
    }
  }

  async processSingleBatch(items, processor, options = {}) {
    const { delay = 0, batchIndex = 0, startIndex = 0 } = options;

    logger.debug(`Processing batch ${batchIndex}: ${items.length} items`);

    const results = [];

    for (const [itemIndex, item] of items.entries()) {
      try {
        const result = await processor(item, {
          itemIndex: startIndex + itemIndex,
          batchIndex,
          totalItems: items.length
        });

        results.push({
          item,
          result,
          success: true,
          index: startIndex + itemIndex
        });

      } catch (error) {
        logger.debug(`Item ${startIndex + itemIndex} failed:`, error.message);
        results.push({
          item,
          result: null,
          success: false,
          error: error.message,
          index: startIndex + itemIndex
        });
      }

      // Add delay between items within a batch
      if (delay > 0 && itemIndex < items.length - 1) {
        await this.delay(delay);
      }
    }

    return results;
  }

  // Utility to chunk arrays
  chunk(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // Utility to add delays
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Progress tracking utility
  createProgressTracker(total, updateInterval = 1000) {
    let processed = 0;
    let lastUpdate = 0;

    return {
      increment() {
        processed++;
        const now = Date.now();

        if (now - lastUpdate >= updateInterval || processed === total) {
          const percentage = Math.round((processed / total) * 100);
          logger.info(`Progress: ${processed}/${total} (${percentage}%)`);
          lastUpdate = now;
        }
      },

      getStats() {
        return {
          processed,
          total,
          percentage: Math.round((processed / total) * 100)
        };
      }
    };
  }
}

// Simple semaphore implementation for concurrency control
class Semaphore {
  constructor(permits) {
    this.permits = permits;
    this.waiting = [];
  }

  async acquire() {
    if (this.permits > 0) {
      this.permits--;
      return this.createReleaseFunction();
    }

    return new Promise((resolve) => {
      this.waiting.push(resolve);
    });
  }

  createReleaseFunction() {
    return () => {
      this.permits++;

      if (this.waiting.length > 0) {
        const resolve = this.waiting.shift();
        this.permits--;
        resolve(this.createReleaseFunction());
      }
    };
  }
}

module.exports = new BatchProcessor();
