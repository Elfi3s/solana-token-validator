// src/test.js
const SolanaTokenValidator = require('./index');
const logger = require('./utils/logger');

async function runTests() {
  const validator = new SolanaTokenValidator();

  logger.info('Starting test suite...');

  // Test with USDC (known safe token)
  const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

  try {
    logger.info('Testing USDC analysis...');
    const result = await validator.analyzeToken(USDC_MINT, {
      includeHolderAnalysis: false, // Skip to save API credits
      includeHoneypotDetection: false
    });

    logger.info(`USDC Analysis completed - Safety: ${result.overallAssessment.safetyLevel}`);
    logger.info('✅ Basic analysis test passed');

  } catch (error) {
    logger.error('❌ Test failed:', error.message);
    process.exit(1);
  }

  // Test batch processing with small batch
  try {
    logger.info('Testing batch processing...');
    const tokens = [USDC_MINT];

    const batchResult = await validator.analyzeBatch(tokens, {
      includeHolderAnalysis: false,
      includeHoneypotDetection: false,
      batchSize: 1
    });

    logger.info(`Batch processing completed - ${batchResult.successful.length} successful`);
    logger.info('✅ Batch processing test passed');

  } catch (error) {
    logger.error('❌ Batch test failed:', error.message);
    process.exit(1);
  }

  logger.info('🎉 All tests passed!');
  logger.info('You can now run the full analysis with:');
  logger.info(`node src/index.js analyze ${USDC_MINT}`);
}

if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };
