// src/analyzers/tokenAnalyzer.js - COMPLETE VERSION WITH ALL CHECKS
const solanaService = require('../services/solanaService');
const jupiterService = require('../services/jupiterService');
const metadataService = require('../services/metadataService');
const holderAnalyzer = require('./holderAnalyzer');
const honeypotDetector = require('./honeypotDetector');
const logger = require('../utils/logger');

class TokenAnalyzer {
  async analyzeToken(mintAddress, options = {}) {
    try {
      console.log(`\n=== COMPREHENSIVE TOKEN ANALYSIS: ${mintAddress} ===`);
      
      const analysis = {
        mintAddress,
        timestamp: new Date().toISOString(),
        checks: {},
        options
      };

      // 1. Basic Token Information (Fast)
      console.log('1. 🔍 Getting basic token information...');
      analysis.checks.basicInfo = await this.analyzeBasicInfo(mintAddress);
      
      // 2. Authority Analysis (Fast)  
      console.log('2. 🔒 Analyzing authorities...');
      analysis.checks.authorities = await this.analyzeAuthorities(mintAddress);
      
      // 3. Program Ownership (Fast)
      console.log('3. 🏗️  Checking program ownership...');
      analysis.checks.programOwnership = await this.analyzeProgramOwnership(mintAddress);

      // 4. Metadata Analysis (Medium speed)
      if (options.includeMetadata !== false) {
        console.log('4. 📝 Analyzing token metadata...');
        analysis.checks.metadata = await this.analyzeMetadataWithTimeout(mintAddress, 5000);
      }

      // 5. Holder Distribution (Slow - can timeout)
      if (options.includeHolderAnalysis !== false) {
        console.log('5. 👥 Analyzing holder distribution...');
        analysis.checks.holders = await this.analyzeHoldersWithTimeout(mintAddress, 10000);
      }

      // 6. Honeypot Detection (Slow - Jupiter API dependent)
      if (options.includeHoneypotDetection !== false) {
        console.log('6. 🍯 Running honeypot detection...');
        analysis.checks.honeypot = await this.runHoneypotDetection(mintAddress, 15000);
      }

      // 7. Market Data (Medium speed)
      if (options.includeMarketData !== false) {
        console.log('7. 📊 Fetching market data...');
        analysis.checks.marketData = await this.analyzeMarketData(mintAddress, 5000);
      }

      // Calculate overall risk assessment
      analysis.riskScore = this.calculateRiskScore(analysis.checks);
      analysis.safetyLevel = this.getSafetyLevel(analysis.riskScore);
      analysis.recommendations = this.generateRecommendations(analysis.checks);
      
      console.log('✅ Analysis complete!');
      return analysis;
      
    } catch (error) {
      logger.error(`Failed to analyze token ${mintAddress}:`, error.message);
      throw error;
    }
  }

  async analyzeBasicInfo(mintAddress) {
    try {
      const mintInfo = await solanaService.getTokenMintInfo(mintAddress);
      const supply = await solanaService.getTokenSupply(mintAddress);
      
      console.log(`   ✅ Token found - Supply: ${supply.uiAmountString}, Decimals: ${mintInfo.decimals}`);
      
      return {
        mintInfo,
        supply,
        issues: [],
        warnings: [],
        score: 100
      };
      
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
      return {
        mintInfo: null,
        supply: null,
        issues: [error.message],
        warnings: [],
        score: 0
      };
    }
  }

  async analyzeAuthorities(mintAddress) {
    try {
      const mintInfo = await solanaService.getTokenMintInfo(mintAddress);
      
      const issues = [];
      const warnings = [];
      
      if (mintInfo.mintAuthority) {
        issues.push('🔴 MINT AUTHORITY NOT REVOKED - Supply can be inflated!');
        console.log(`   ❌ Mint Authority: ${mintInfo.mintAuthority}`);
      } else {
        console.log('   ✅ Mint Authority: REVOKED');
      }
      
      if (mintInfo.freezeAuthority) {
        issues.push('🔴 FREEZE AUTHORITY NOT REVOKED - Accounts can be frozen!');
        console.log(`   ❌ Freeze Authority: ${mintInfo.freezeAuthority}`);
      } else {
        console.log('   ✅ Freeze Authority: REVOKED');
      }
      
      const score = 100 - (issues.length * 40) - (warnings.length * 10);
      
      return {
        mintAuthority: mintInfo.mintAuthority,
        freezeAuthority: mintInfo.freezeAuthority,
        issues,
        warnings,
        score: Math.max(0, score)
      };
      
    } catch (error) {
      return {
        mintAuthority: null,
        freezeAuthority: null,
        issues: [error.message],
        warnings: [],
        score: 0
      };
    }
  }

  async analyzeProgramOwnership(mintAddress) {
    try {
      const accountInfo = await solanaService.getAccountInfo(mintAddress);
      
      if (!accountInfo) {
        return {
          owner: null,
          isValidProgram: false,
          issues: ['Token account not found'],
          warnings: [],
          score: 0
        };
      }

      const owner = accountInfo.owner;
      const issues = [];
      const warnings = [];

      // Check if owned by standard token program
      const standardPrograms = [
        'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // SPL Token
        'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'  // SPL Token 2022
      ];
      
      const isStandardProgram = standardPrograms.includes(owner);
      
      if (!isStandardProgram) {
        issues.push(`🔴 Non-standard program owner: ${owner}`);
        console.log(`   ❌ Program Owner: ${owner} (NON-STANDARD)`);
      } else {
        console.log(`   ✅ Program Owner: Standard SPL Token Program`);
      }

      const score = isStandardProgram ? 100 : 20;

      return {
        owner,
        isValidProgram: isStandardProgram,
        issues,
        warnings,
        score
      };
      
    } catch (error) {
      return {
        owner: null,
        isValidProgram: false,
        issues: [error.message],
        warnings: [],
        score: 0
      };
    }
  }

  async analyzeMetadataWithTimeout(mintAddress, timeoutMs = 5000) {
    return new Promise(async (resolve) => {
      const timeout = setTimeout(() => {
        console.log('   ⏰ Metadata analysis timed out');
        resolve({
          metadata: null,
          issues: [],
          warnings: ['Metadata analysis timed out'],
          score: 70,
          skipped: true
        });
      }, timeoutMs);

      try {
        const metadata = await metadataService.getTokenMetadata(mintAddress);
        clearTimeout(timeout);
        
        const issues = [];
        const warnings = [];
        
        if (!metadata || !metadata.name) {
          warnings.push('🟡 No token name found');
        }
        
        if (!metadata || !metadata.symbol) {
          warnings.push('🟡 No token symbol found');
        }
        
        if (metadata && metadata.source === 'BASIC') {
          warnings.push('🟡 No Metaplex metadata found');
        }
        
        console.log(`   📝 Name: ${metadata?.name || 'Unknown'}`);
        console.log(`   🏷️  Symbol: ${metadata?.symbol || 'Unknown'}`);
        
        const score = 100 - (issues.length * 20) - (warnings.length * 5);
        
        resolve({
          metadata,
          issues,
          warnings,
          score: Math.max(0, score)
        });
        
      } catch (error) {
        clearTimeout(timeout);
        resolve({
          metadata: null,
          issues: [error.message],
          warnings: [],
          score: 0
        });
      }
    });
  }

  async analyzeHoldersWithTimeout(mintAddress, timeoutMs = 10000) {
    return new Promise(async (resolve) => {
      const timeout = setTimeout(() => {
        console.log('   ⏰ Holder analysis timed out (token too popular)');
        resolve({
          holders: [],
          issues: [],
          warnings: ['Holder analysis skipped - token too popular or network slow'],
          score: 70,
          skipped: true
        });
      }, timeoutMs);

      try {
        const result = await holderAnalyzer.analyzeHolderDistribution(mintAddress);
        clearTimeout(timeout);
        
        if (result.holderCount > 0) {
          console.log(`   👥 Analyzed ${result.holderCount} holders`);
          if (result.concentration?.top1Percentage) {
            console.log(`   📊 Top holder: ${result.concentration.top1Percentage.toFixed(2)}%`);
          }
        }
        
        resolve(result);
        
      } catch (error) {
        clearTimeout(timeout);
        resolve({
          holders: [],
          issues: [error.message],
          warnings: [],
          score: 0
        });
      }
    });
  }

  async runHoneypotDetection(mintAddress, timeoutMs = 15000) {
    return new Promise(async (resolve) => {
      const timeout = setTimeout(() => {
        console.log('   ⏰ Honeypot detection timed out');
        resolve({
          verdict: 'TIMEOUT',
          honeypotProbability: { overall: 0, confidence: 0 },
          issues: [],
          warnings: ['Honeypot detection timed out - Jupiter API may be unavailable'],
          score: 50,
          skipped: true
        });
      }, timeoutMs);

      try {
        const result = await honeypotDetector.detectHoneypot(mintAddress);
        clearTimeout(timeout);
        
        console.log(`   🍯 Honeypot Probability: ${result.honeypotProbability?.overall || 0}%`);
        console.log(`   🎯 Verdict: ${result.verdict}`);
        
        const issues = [];
        const warnings = [];
        
        if (result.honeypotProbability?.overall > 70) {
          issues.push(`🔴 HIGH HONEYPOT RISK: ${result.honeypotProbability.overall}%`);
        } else if (result.honeypotProbability?.overall > 40) {
          warnings.push(`🟡 Moderate honeypot risk: ${result.honeypotProbability.overall}%`);
        }
        
        if (result.tests?.swapSimulation && !result.tests.swapSimulation.canSell) {
          issues.push('🔴 CANNOT SELL TOKENS - Confirmed honeypot!');
        }
        
        const score = Math.max(0, 100 - (result.honeypotProbability?.overall || 0));
        
        resolve({
          ...result,
          issues,
          warnings,
          score
        });
        
      } catch (error) {
        clearTimeout(timeout);
        resolve({
          verdict: 'ERROR',
          honeypotProbability: { overall: 0, confidence: 0 },
          issues: [error.message],
          warnings: [],
          score: 30
        });
      }
    });
  }

  async analyzeMarketData(mintAddress, timeoutMs = 5000) {
    return new Promise(async (resolve) => {
      const timeout = setTimeout(() => {
        console.log('   ⏰ Market data timed out');
        resolve({
          price: null,
          issues: [],
          warnings: ['Market data unavailable'],
          score: 70,
          skipped: true
        });
      }, timeoutMs);

      try {
        const price = await jupiterService.getPrice(mintAddress);
        clearTimeout(timeout);
        
        if (price && price.price > 0) {
          console.log(`   💰 Price: $${price.price}`);
        } else {
          console.log(`   ⚠️  No price data available`);
        }
        
        resolve({
          price,
          issues: [],
          warnings: price ? [] : ['No price data available'],
          score: price ? 100 : 50
        });
        
      } catch (error) {
        clearTimeout(timeout);
        resolve({
          price: null,
          issues: [],
          warnings: ['Failed to fetch price data'],
          score: 50
        });
      }
    });
  }

  calculateRiskScore(checks) {
    const weights = {
      basicInfo: 10,
      authorities: 40,      // Most important
      programOwnership: 20, // Very important  
      metadata: 5,
      holders: 15,
      honeypot: 30,        // Very important
      marketData: 5
    };

    let totalScore = 0;
    let totalWeight = 0;

    Object.entries(checks).forEach(([checkName, result]) => {
      if (result && typeof result.score === 'number' && !result.skipped) {
        const weight = weights[checkName] || 10;
        totalScore += result.score * weight;
        totalWeight += weight;
      }
    });

    return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 50;
  }

  getSafetyLevel(score) {
    if (score >= 80) return '🟢 SAFE';
    if (score >= 60) return '🟡 CAUTION'; 
    if (score >= 40) return '🟠 RISKY';
    return '🔴 DANGEROUS';
  }

  generateRecommendations(checks) {
    const recommendations = [];
    
    // Authority recommendations
    if (checks.authorities?.mintAuthority) {
      recommendations.push('🚨 AVOID: Mint authority not revoked - infinite supply risk');
    }
    
    if (checks.authorities?.freezeAuthority) {
      recommendations.push('🚨 CAUTION: Freeze authority active - accounts can be frozen');
    }
    
    // Honeypot recommendations
    if (checks.honeypot?.issues?.length > 0) {
      recommendations.push('🚨 HONEYPOT DETECTED: Do not purchase this token');
    }
    
    // Program recommendations
    if (checks.programOwnership && !checks.programOwnership.isValidProgram) {
      recommendations.push('🚨 AVOID: Non-standard token program detected');
    }
    
    // Holder recommendations
    if (checks.holders?.concentration?.top1Percentage > 50) {
      recommendations.push('⚠️ HIGH RISK: Single holder owns majority of supply');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('✅ No critical issues detected - but always DYOR');
    }
    
    return recommendations;
  }
}

module.exports = new TokenAnalyzer();
