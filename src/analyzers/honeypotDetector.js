// src/analyzers/honeypotDetector.js - ON-CHAIN HONEYPOT DETECTION
const solanaService = require('../services/solanaService');
const logger = require('../utils/logger');

class HoneypotDetector {
  constructor() {
    logger.info('Honeypot detector initialized - using on-chain analysis');
  }

  async detectHoneypot(mintAddress) {
    try {
      logger.info(`Starting on-chain honeypot detection for token: ${mintAddress}`);
      
      const analysis = {
        mintAddress,
        timestamp: new Date().toISOString(),
        tests: {}
      };

      // 1. Authority-based honeypot detection
      analysis.tests.authorityAnalysis = await this.analyzeAuthorities(mintAddress);
      
      // 2. Program-based detection
      analysis.tests.programAnalysis = await this.analyzeProgram(mintAddress);
      
      // 3. Supply mechanics analysis
      analysis.tests.supplyAnalysis = await this.analyzeSupplyMetrics(mintAddress);
      
      // 4. Holder pattern analysis
      analysis.tests.holderPatterns = await this.analyzeHolderPatterns(mintAddress);

      // Calculate honeypot probability based on on-chain data
      analysis.honeypotProbability = this.calculateOnChainHoneypotProbability(analysis.tests);
      analysis.verdict = this.generateVerdict(analysis.honeypotProbability);
      analysis.recommendations = this.generateRecommendations(analysis.tests, analysis.honeypotProbability);

      logger.info(`On-chain honeypot detection completed - Probability: ${analysis.honeypotProbability.overall}%`);
      return analysis;

    } catch (error) {
      logger.error(`Failed to detect honeypot for ${mintAddress}:`, error.message);
      return {
        mintAddress,
        timestamp: new Date().toISOString(),
        tests: {},
        honeypotProbability: { overall: 50, confidence: 0.3 },
        verdict: 'CANNOT_ANALYZE',
        recommendations: ['Unable to analyze token - manual verification recommended'],
        error: error.message
      };
    }
  }

  async analyzeAuthorities(mintAddress) {
    try {
      const mintInfo = await solanaService.getTokenMintInfo(mintAddress);
      
      const issues = [];
      const warnings = [];
      let riskScore = 0;

      // Check mint authority
      if (mintInfo.mintAuthority) {
        issues.push('MINT_AUTHORITY_ACTIVE');
        riskScore += 30;
        logger.debug('⚠️ Mint authority still active');
      }

      // Check freeze authority
      if (mintInfo.freezeAuthority) {
        issues.push('FREEZE_AUTHORITY_ACTIVE');
        riskScore += 40; // Freeze authority is worse for honeypots
        logger.debug('⚠️ Freeze authority still active');
      }

      return {
        mintAuthority: mintInfo.mintAuthority,
        freezeAuthority: mintInfo.freezeAuthority,
        issues,
        warnings,
        riskScore,
        severity: riskScore > 50 ? 'CRITICAL' : riskScore > 20 ? 'HIGH' : 'LOW'
      };

    } catch (error) {
      return {
        issues: ['AUTHORITY_ANALYSIS_FAILED'],
        warnings: [],
        riskScore: 25,
        severity: 'MEDIUM'
      };
    }
  }

  async analyzeProgram(mintAddress) {
    try {
      const accountInfo = await solanaService.getAccountInfo(mintAddress);
      
      if (!accountInfo) {
        return {
          issues: ['ACCOUNT_NOT_FOUND'],
          warnings: [],
          riskScore: 80,
          severity: 'CRITICAL'
        };
      }

      const issues = [];
      const warnings = [];
      let riskScore = 0;

      // Check program owner
      const standardPrograms = [
        'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // SPL Token
        'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'  // SPL Token 2022
      ];

      if (!standardPrograms.includes(accountInfo.owner)) {
        issues.push('NON_STANDARD_PROGRAM');
        riskScore += 50;
        logger.debug(`⚠️ Non-standard program: ${accountInfo.owner}`);
      }

      return {
        owner: accountInfo.owner,
        isStandardProgram: standardPrograms.includes(accountInfo.owner),
        issues,
        warnings,
        riskScore,
        severity: riskScore > 40 ? 'CRITICAL' : 'LOW'
      };

    } catch (error) {
      return {
        issues: ['PROGRAM_ANALYSIS_FAILED'],
        warnings: [],
        riskScore: 30,
        severity: 'MEDIUM'
      };
    }
  }

  async analyzeSupplyMetrics(mintAddress) {
    try {
      const supply = await solanaService.getTokenSupply(mintAddress);
      const mintInfo = await solanaService.getTokenMintInfo(mintAddress);
      
      const issues = [];
      const warnings = [];
      let riskScore = 0;

      const totalSupply = parseFloat(supply.uiAmountString || '0');

      // Check for suspicious supply patterns
      if (totalSupply === 0) {
        issues.push('ZERO_SUPPLY');
        riskScore += 70;
      } else if (totalSupply > 1000000000000) { // 1 trillion+
        warnings.push('EXTREMELY_HIGH_SUPPLY');
        riskScore += 10;
      }

      // Check decimals (most tokens use 6 or 9)
      if (mintInfo.decimals > 18 || mintInfo.decimals === 0) {
        warnings.push('UNUSUAL_DECIMALS');
        riskScore += 5;
      }

      return {
        totalSupply,
        decimals: mintInfo.decimals,
        issues,
        warnings,
        riskScore,
        severity: riskScore > 50 ? 'CRITICAL' : riskScore > 10 ? 'MEDIUM' : 'LOW'
      };

    } catch (error) {
      return {
        issues: ['SUPPLY_ANALYSIS_FAILED'],
        warnings: [],
        riskScore: 20,
        severity: 'MEDIUM'
      };
    }
  }

  async analyzeHolderPatterns(mintAddress) {
    try {
      // Try to get holder data with timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 5000)
      );
      
      const holdersPromise = solanaService.getTokenLargestAccounts(mintAddress, 5);
      
      const holders = await Promise.race([holdersPromise, timeoutPromise]);
      
      if (!holders || holders.length === 0) {
        return {
          issues: [],
          warnings: ['NO_HOLDER_DATA'],
          riskScore: 10,
          severity: 'LOW'
        };
      }

      const supply = await solanaService.getTokenSupply(mintAddress);
      const totalSupply = parseFloat(supply.uiAmountString || '0');
      
      const issues = [];
      const warnings = [];
      let riskScore = 0;

      if (totalSupply > 0) {
        const topHolderPct = (holders[0].uiAmount / totalSupply) * 100;
        
        if (topHolderPct > 80) {
          issues.push('EXTREME_CONCENTRATION');
          riskScore += 60;
        } else if (topHolderPct > 50) {
          issues.push('HIGH_CONCENTRATION');
          riskScore += 30;
        } else if (topHolderPct > 30) {
          warnings.push('MODERATE_CONCENTRATION');
          riskScore += 10;
        }
      }

      return {
        holders,
        topHolderPercentage: totalSupply > 0 ? (holders[0].uiAmount / totalSupply) * 100 : 0,
        issues,
        warnings,
        riskScore,
        severity: riskScore > 50 ? 'CRITICAL' : riskScore > 20 ? 'HIGH' : 'LOW'
      };

    } catch (error) {
      logger.debug(`Holder analysis skipped: ${error.message}`);
      return {
        issues: [],
        warnings: ['HOLDER_ANALYSIS_SKIPPED'],
        riskScore: 15,
        severity: 'LOW'
      };
    }
  }

  calculateOnChainHoneypotProbability(tests) {
    let totalRisk = 0;
    let maxRisk = 0;
    let testCount = 0;

    // Weight different test results
    const weights = {
      authorityAnalysis: 0.4,  // 40% weight - very important
      programAnalysis: 0.3,    // 30% weight - important
      supplyAnalysis: 0.2,     // 20% weight - moderate
      holderPatterns: 0.1      // 10% weight - informational
    };

    Object.entries(tests).forEach(([testName, result]) => {
      if (result && typeof result.riskScore === 'number') {
        const weight = weights[testName] || 0.1;
        totalRisk += result.riskScore * weight;
        maxRisk += 100 * weight;
        testCount++;
      }
    });

    const overall = maxRisk > 0 ? Math.round((totalRisk / maxRisk) * 100) : 50;
    const confidence = testCount > 0 ? Math.min(0.8, testCount * 0.2) : 0.3;

    return {
      overall: Math.min(100, Math.max(0, overall)),
      confidence,
      method: 'ON_CHAIN_ANALYSIS',
      breakdown: this.getScoreBreakdown(tests, weights)
    };
  }

  getScoreBreakdown(tests, weights) {
    const breakdown = {};
    
    Object.entries(tests).forEach(([testName, result]) => {
      if (result) {
        breakdown[testName] = {
          weight: weights[testName] || 0.1,
          riskScore: result.riskScore || 0,
          severity: result.severity || 'UNKNOWN',
          issues: result.issues || []
        };
      }
    });
    
    return breakdown;
  }

  generateVerdict(probability) {
    if (probability.overall >= 80) return 'LIKELY_HONEYPOT';
    if (probability.overall >= 60) return 'HIGH_RISK';
    if (probability.overall >= 40) return 'SUSPICIOUS';
    if (probability.overall >= 20) return 'CAUTION';
    return 'LOW_RISK';
  }

  generateRecommendations(tests, probability) {
    const recommendations = [];
    
    if (probability.overall >= 60) {
      recommendations.push('🚨 HIGH RISK: Avoid this token due to suspicious on-chain patterns');
    } else if (probability.overall >= 40) {
      recommendations.push('⚠️ CAUTION: Multiple risk factors detected - proceed with extreme caution');
    } else if (probability.overall >= 20) {
      recommendations.push('⚠️ MODERATE RISK: Some concerns detected - do additional research');
    } else {
      recommendations.push('✅ ON-CHAIN ANALYSIS: No major red flags detected in on-chain data');
    }
    
    // Add specific recommendations based on test results
    Object.values(tests).forEach(test => {
      if (test.issues) {
        test.issues.forEach(issue => {
          switch (issue) {
            case 'MINT_AUTHORITY_ACTIVE':
              recommendations.push('• Mint authority not revoked - supply can be inflated');
              break;
            case 'FREEZE_AUTHORITY_ACTIVE':
              recommendations.push('• Freeze authority not revoked - accounts can be frozen');
              break;
            case 'NON_STANDARD_PROGRAM':
              recommendations.push('• Token uses non-standard program - higher risk');
              break;
            case 'EXTREME_CONCENTRATION':
              recommendations.push('• Extreme holder concentration detected');
              break;
          }
        });
      }
    });
    
    recommendations.push('📝 NOTE: This analysis is based on on-chain data only (no DEX simulation)');
    
    return [...new Set(recommendations)]; // Remove duplicates
  }
}

module.exports = new HoneypotDetector();
