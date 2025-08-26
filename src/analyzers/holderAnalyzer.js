// src/analyzers/holderAnalyzer.js - WITH PROPER RATE LIMITING
const solanaService = require('../services/solanaService');
const rateLimiter = require('../config/rateLimit'); // Import rate limiter
const { SECURITY } = require('../config/constants');
const logger = require('../utils/logger');

class HolderAnalyzer {
  constructor() {
    this.knownBurnAddresses = new Set([
      '11111111111111111111111111111111',
      'So11111111111111111111111111111111111111112',
      '1nc1nerator11111111111111111111111111111111',
    ]);
  }

  async analyzeHolderDistribution(mintAddress) {
    try {
      logger.info(`Analyzing holder distribution for token: ${mintAddress}`);
      
      // Get largest token accounts
      const largestAccounts = await rateLimiter.executeRequest(async () => {
        return await solanaService.getTokenLargestAccounts(mintAddress, 10); // Reduced from 20 to 10
      }, 1);
      
      if (!largestAccounts || largestAccounts.length === 0) {
        return {
          holders: [],
          concentration: null,
          issues: ['No holder data available'],
          warnings: [],
          score: 0,
          severity: 'CRITICAL',
          holderCount: 0
        };
      }

      logger.info(`Retrieved ${largestAccounts.length} holder accounts`);

      // Get token supply
      const supply = await rateLimiter.executeRequest(async () => {
        return await solanaService.getTokenSupply(mintAddress);
      }, 1);

      const totalSupply = parseFloat(supply.uiAmountString || '0');

      if (totalSupply === 0) {
        return {
          holders: [],
          concentration: null,
          issues: ['Token has zero supply'],
          warnings: [],
          score: 0,
          severity: 'CRITICAL',
          holderCount: 0
        };
      }

      // Process holders with rate limiting - SEQUENTIAL PROCESSING
      const validHolders = [];
      let processedCount = 0;

      console.log('   📊 Processing holders (rate limited to 15/sec)...');

      for (const account of largestAccounts) {
        if (!account.uiAmount || account.uiAmount === 0) continue;
        if (!this.isValidBase58Address(account.address)) continue;
        if (this.knownBurnAddresses.has(account.address)) continue;

        const percentage = (account.uiAmount / totalSupply) * 100;
        
        // Basic holder info without detailed account analysis to save API calls
        const holder = {
          address: account.address,
          amount: account.uiAmount,
          percentage,
          type: 'HOLDER', // Simplified - avoid extra API calls
          analyzed: false
        };

        // Only do detailed analysis for top 3 holders to save API calls
        if (processedCount < 3) {
          try {
            const holderDetails = await rateLimiter.executeRequest(async () => {
              return await this.getBasicHolderInfo(account.address);
            }, 1);
            
            holder.type = holderDetails.type;
            holder.lamports = holderDetails.lamports;
            holder.analyzed = true;
            
            console.log(`   ✅ Analyzed holder ${processedCount + 1}: ${percentage.toFixed(2)}% (${holderDetails.type})`);
          } catch (error) {
            console.log(`   ⚠️  Holder ${processedCount + 1}: ${percentage.toFixed(2)}% (analysis skipped)`);
          }
        } else {
          console.log(`   📍 Holder ${processedCount + 1}: ${percentage.toFixed(2)}% (basic info only)`);
        }

        validHolders.push(holder);
        processedCount++;
      }

      // Calculate concentration metrics
      const concentration = this.calculateConcentration(validHolders, totalSupply);
      
      // Generate risk assessment
      const riskAssessment = this.assessHolderRisks(concentration, validHolders);

      const result = {
        holders: validHolders.sort((a, b) => b.percentage - a.percentage),
        totalSupply,
        concentration,
        issues: riskAssessment.issues,
        warnings: riskAssessment.warnings,
        score: riskAssessment.score,
        severity: riskAssessment.severity,
        holderCount: validHolders.length,
        detailedAnalysisCount: validHolders.filter(h => h.analyzed).length
      };

      logger.info(`Holder analysis completed - ${result.holderCount} holders, ${result.detailedAnalysisCount} detailed`);
      return result;

    } catch (error) {
      logger.error(`Failed to analyze holder distribution for ${mintAddress}:`, error.message);
      return {
        holders: [],
        concentration: null,
        issues: ['Failed to analyze holder distribution: ' + error.message],
        warnings: [],
        score: 0,
        severity: 'CRITICAL',
        holderCount: 0
      };
    }
  }

  async getBasicHolderInfo(address) {
    try {
      const accountInfo = await solanaService.getAccountInfo(address);
      
      if (!accountInfo) {
        return {
          type: 'NOT_FOUND',
          lamports: 0
        };
      }

      let type = 'WALLET';
      if (accountInfo.executable) {
        type = 'PROGRAM';
      } else if (accountInfo.owner !== '11111111111111111111111111111111') {
        type = 'TOKEN_ACCOUNT';
      }

      return {
        type,
        lamports: accountInfo.lamports,
        owner: accountInfo.owner
      };

    } catch (error) {
      return {
        type: 'ERROR',
        lamports: 0,
        error: error.message
      };
    }
  }

  isValidBase58Address(address) {
    if (!address || typeof address !== 'string') return false;
    if (address.length < 32 || address.length > 44) return false;
    
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
    if (!base58Regex.test(address)) return false;
    
    try {
      return solanaService.isValidPublicKey(address);
    } catch {
      return false;
    }
  }

  calculateConcentration(holders, totalSupply) {
    if (!holders || holders.length === 0) {
      return {
        top1Percentage: 0,
        top5Percentage: 0,
        top10Percentage: 0,
        herfindahlIndex: 0
      };
    }

    const top1 = holders[0]?.percentage || 0;
    const top5 = holders.slice(0, 5).reduce((sum, h) => sum + h.percentage, 0);
    const top10 = holders.slice(0, 10).reduce((sum, h) => sum + h.percentage, 0);

    const hhi = holders.reduce((sum, holder) => {
      const marketShare = holder.percentage / 100;
      return sum + (marketShare * marketShare);
    }, 0);

    return {
      top1Percentage: top1,
      top5Percentage: top5,
      top10Percentage: top10,
      herfindahlIndex: hhi
    };
  }

  assessHolderRisks(concentration, holders) {
    const issues = [];
    const warnings = [];
    let score = 100;

    // Concentration risk assessment
    if (concentration.top1Percentage > 50) {
      issues.push(`🔴 Single holder controls ${concentration.top1Percentage.toFixed(2)}% of supply`);
      score -= 40;
    } else if (concentration.top1Percentage > 30) {
      warnings.push(`🟡 Top holder controls ${concentration.top1Percentage.toFixed(2)}% of supply`);
      score -= 20;
    }

    if (concentration.top10Percentage > 80) {
      issues.push(`🔴 Top 10 holders control ${concentration.top10Percentage.toFixed(2)}% of supply`);
      score -= 30;
    } else if (concentration.top10Percentage > 60) {
      warnings.push(`🟡 Top 10 holders control ${concentration.top10Percentage.toFixed(2)}% of supply`);
      score -= 15;
    }

    // Herfindahl Index assessment
    if (concentration.herfindahlIndex > 0.25) {
      issues.push('🔴 Extremely concentrated holder distribution');
      score -= 25;
    } else if (concentration.herfindahlIndex > 0.15) {
      warnings.push('🟡 Highly concentrated holder distribution');
      score -= 15;
    }

    // Check for program-controlled holders
    const programHolders = holders.filter(h => h.type === 'PROGRAM').length;
    if (programHolders > 0) {
      warnings.push(`🟡 ${programHolders} program-controlled holder accounts detected`);
      score -= 10;
    }

    const severity = issues.length > 0 ? 'CRITICAL' : 
                    warnings.length > 2 ? 'HIGH' :
                    warnings.length > 0 ? 'MEDIUM' : 'LOW';

    return {
      issues,
      warnings,
      score: Math.max(0, score),
      severity
    };
  }
}

module.exports = new HolderAnalyzer();
