
// src/utils/apiUtils.js
const axios = require('axios');
const logger = require('./logger');

class ApiUtils {
  constructor() {
    this.defaultTimeout = 15000;
    this.retryAttempts = 3;
    this.retryDelay = 1000;
  }

  async makeRequest(config, retries = this.retryAttempts) {
    try {
      const response = await axios({
        timeout: this.defaultTimeout,
        ...config
      });

      return response.data;
    } catch (error) {
      if (retries > 0 && this.shouldRetry(error)) {
        logger.warn(`API request failed, retrying in ${this.retryDelay}ms. Retries left: ${retries - 1}`);
        await this.delay(this.retryDelay);
        return this.makeRequest(config, retries - 1);
      }

      throw this.formatError(error, config);
    }
  }

  shouldRetry(error) {
    // Retry on network errors or 5xx status codes
    return (
      !error.response ||
      error.code === 'ECONNRESET' ||
      error.code === 'ETIMEDOUT' ||
      (error.response.status >= 500 && error.response.status < 600) ||
      error.response.status === 429 // Rate limit
    );
  }

  formatError(error, config) {
    const baseMessage = `API request failed: ${config.method?.toUpperCase() || 'GET'} ${config.url}`;

    if (error.response) {
      return new Error(`${baseMessage} - ${error.response.status}: ${error.response.statusText}`);
    } else if (error.code) {
      return new Error(`${baseMessage} - ${error.code}: ${error.message}`);
    } else {
      return new Error(`${baseMessage} - ${error.message}`);
    }
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Batch HTTP requests with rate limiting
  async batchRequests(requests, batchSize = 5, delayBetweenBatches = 100) {
    const results = [];
    const batches = [];

    // Split requests into batches
    for (let i = 0; i < requests.length; i += batchSize) {
      batches.push(requests.slice(i, i + batchSize));
    }

    logger.info(`Processing ${requests.length} API requests in ${batches.length} batches`);

    for (const [batchIndex, batch] of batches.entries()) {
      logger.debug(`Processing batch ${batchIndex + 1}/${batches.length}`);

      const batchPromises = batch.map(request => 
        this.makeRequest(request).catch(error => ({ error: error.message }))
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Add delay between batches
      if (batchIndex < batches.length - 1) {
        await this.delay(delayBetweenBatches);
      }
    }

    return results;
  }

  // Helper for JSON-RPC calls
  createJsonRpcRequest(method, params = [], id = 1) {
    return {
      jsonrpc: '2.0',
      method,
      params,
      id
    };
  }

  async makeJsonRpcCall(url, method, params = [], id = 1) {
    const request = this.createJsonRpcRequest(method, params, id);

    const response = await this.makeRequest({
      method: 'POST',
      url,
      data: request,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.error) {
      throw new Error(`JSON-RPC Error: ${response.error.message}`);
    }

    return response.result;
  }

  // URL validation
  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  // Response validation
  validateApiResponse(response, requiredFields = []) {
    if (!response || typeof response !== 'object') {
      throw new Error('Invalid API response: not an object');
    }

    for (const field of requiredFields) {
      if (!(field in response)) {
        throw new Error(`Invalid API response: missing field '${field}'`);
      }
    }

    return true;
  }
}

module.exports = new ApiUtils();
