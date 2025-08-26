// src/index.js - SIMPLE VERSION
require('dotenv').config();
const tokenAnalyzer = require('./analyzers/tokenAnalyzer');
const solanaService = require('./services/solanaService');

class SolanaTokenValidator {
  async analyzeToken(mintAddress) {
    try {
      // Validate address
      if (!solanaService.isValidPublicKey(mintAddress)) {
        throw new Error(`Invalid token address: ${mintAddress}`);
      }

      const analysis = await tokenAnalyzer.analyzeToken(mintAddress);
      return analysis;
      
    } catch (error) {
      console.error(`❌ Analysis failed: ${error.message}`);
      throw error;
    }
  }

  printResults(analysis) {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 SOLANA TOKEN ANALYSIS RESULTS');
    console.log('='.repeat(60));
    
    console.log(`\n📍 Token: ${analysis.mintAddress}`);
    console.log(`⏰ Analyzed: ${new Date(analysis.timestamp).toLocaleString()}`);
    console.log(`📊 Risk Score: ${analysis.riskScore}/100`);
    console.log(`🛡️  Safety Level: ${analysis.safetyLevel}`);
    
    // Show all issues
    const allIssues = [];
    const allWarnings = [];
    
    Object.values(analysis.checks).forEach(check => {
      if (check.issues) allIssues.push(...check.issues);
      if (check.warnings) allWarnings.push(...check.warnings);
    });
    
    if (allIssues.length > 0) {
      console.log('\n🚨 CRITICAL ISSUES:');
      allIssues.forEach(issue => console.log(`  ${issue}`));
    }
    
    if (allWarnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      allWarnings.forEach(warning => console.log(`  ${warning}`));
    }
    
    if (allIssues.length === 0 && allWarnings.length === 0) {
      console.log('\n✅ No major issues detected');
    }
    
    console.log('\n' + '='.repeat(60));
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node src/index.js analyze <TOKEN_ADDRESS>');
    return;
  }
  
  if (args[0] !== 'analyze' || !args[1]) {
    console.log('Usage: node src/index.js analyze <TOKEN_ADDRESS>');
    return;
  }
  
  const validator = new SolanaTokenValidator();
  
  try {
    const result = await validator.analyzeToken(args[1]);
    validator.printResults(result);
  } catch (error) {
    console.error(`\n❌ ANALYSIS FAILED: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
