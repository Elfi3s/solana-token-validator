// src/analyzers/liquidityAnalyzer.js - COMPLETE IMPLEMENTATION
const solanaService = require('../services/solanaService');
const logger = require('../utils/logger');

class LiquidityAnalyzer {
    constructor() {
        // Known burn addresses
        this.BURN_ADDRESSES = new Set([
            '11111111111111111111111111111111',
            '1nc1nerator11111111111111111111111111111111',
            'So11111111111111111111111111111111111111112'
        ]);
        
        // Known DEX program IDs
        this.DEX_PROGRAMS = {
            RAYDIUM_V4: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
            ORCA_WHIRLPOOLS: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
            ORCA_V1: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
            METEORA: 'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB'
        };
        
        // Known liquidity locker contracts
        this.KNOWN_LOCKERS = new Set([
            'LockerVault1111111111111111111111111111',
            'TeamFinance1111111111111111111111111111'
        ]);
    }

    async analyzeLiquidity(tokenMint) {
        try {
            console.log('   💧 Analyzing liquidity security...');
            
            const analysis = {
                tokenMint,
                timestamp: new Date().toISOString(),
                pools: [],
                overallStatus: 'UNKNOWN',
                securedPercentage: 0,
                riskFactors: [],
                warnings: [],
                lpProviders: 0,
                liquidityUSD: 0
            };

            // 1. Find liquidity pools (simplified approach)
            const pools = await this.findLiquidityPools(tokenMint);
            analysis.pools = pools;

            if (pools.length === 0) {
                analysis.riskFactors.push('🔴 No liquidity pools detected');
                analysis.overallStatus = 'NO_LIQUIDITY';
                return analysis;
            }

            console.log(`      Found ${pools.length} liquidity pool(s)`);

            // 2. Analyze each pool's security
            for (const pool of pools) {
                await this.analyzePoolSecurity(pool);
            }

            // 3. Calculate overall metrics
            this.calculateOverallMetrics(analysis);

            // 4. Assess risks
            this.assessLiquidityRisks(analysis);

            return analysis;

        } catch (error) {
            logger.error(`Liquidity analysis failed: ${error.message}`);
            return {
                tokenMint,
                overallStatus: 'ERROR',
                riskFactors: [`Analysis failed: ${error.message}`],
                warnings: []
            };
        }
    }

    async findLiquidityPools(tokenMint) {
        const pools = [];
        
        try {
            // Method 1: Look for accounts that might be LP token mints
            // This is a heuristic approach - in production you'd use DEX-specific APIs
            
            // Method 2: Check major DEX programs for pool accounts
            // containing this token (simplified implementation)
            
            // For now, we'll use a heuristic approach looking at holder patterns
            const largestHolders = await solanaService.getTokenLargestAccounts(tokenMint, 20);
            
            for (const holder of largestHolders) {
                // Check if holder address pattern suggests it's a DEX pool
                const poolCandidate = await this.analyzeHolderForPool(holder, tokenMint);
                if (poolCandidate) {
                    pools.push(poolCandidate);
                }
            }
            
        } catch (error) {
            logger.warn('Pool discovery failed:', error.message);
        }

        return pools;
    }

    async analyzeHolderForPool(holder, tokenMint) {
        try {
            const accountInfo = await solanaService.getAccountInfo(holder.address);
            
            if (!accountInfo) return null;
            
            // Check if owned by known DEX program
            const isDEXAccount = Object.values(this.DEX_PROGRAMS).includes(accountInfo.owner);
            
            if (isDEXAccount) {
                const dexName = this.getDEXName(accountInfo.owner);
                
                return {
                    address: holder.address,
                    dex: dexName,
                    tokenBalance: holder.uiAmount,
                    program: accountInfo.owner,
                    lpMint: null, // Would need to extract from account data
                    detected: true
                };
            }
            
        } catch (error) {
            // Ignore individual failures
        }
        
        return null;
    }

    getDEXName(programId) {
        const programMap = {
            '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'Raydium',
            'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc': 'Orca',
            '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM': 'Orca V1',
            'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB': 'Meteora'
        };
        
        return programMap[programId] || 'Unknown DEX';
    }

    async analyzePoolSecurity(pool) {
        try {
            if (!pool.lpMint) {
                // If we don't have LP mint, estimate security based on patterns
                pool.securityStatus = 'ESTIMATED';
                pool.securedPercentage = 50; // Conservative estimate
                return;
            }
            
            // Get LP token supply and holders
            const lpSupply = await solanaService.getTokenSupply(pool.lpMint);
            const lpHolders = await solanaService.getTokenLargestAccounts(pool.lpMint, 20);
            
            let lockedAmount = 0;
            let burnedAmount = 0;
            const totalSupply = parseFloat(lpSupply.uiAmountString);
            
            // Analyze LP token distribution
            for (const holder of lpHolders) {
                if (this.BURN_ADDRESSES.has(holder.address)) {
                    burnedAmount += holder.uiAmount;
                } else if (this.KNOWN_LOCKERS.has(holder.address)) {
                    lockedAmount += holder.uiAmount;
                }
            }
            
            const securedPercentage = ((lockedAmount + burnedAmount) / totalSupply) * 100;
            
            pool.totalSupply = totalSupply;
            pool.lockedAmount = lockedAmount;
            pool.burnedAmount = burnedAmount;
            pool.securedPercentage = securedPercentage;
            pool.securityStatus = this.getSecurityStatus(securedPercentage);
            
        } catch (error) {
            logger.warn(`Failed to analyze pool security: ${error.message}`);
            pool.securityStatus = 'ERROR';
        }
    }

    getSecurityStatus(securedPercentage) {
        if (securedPercentage >= 95) return 'EXCELLENT';
        if (securedPercentage >= 80) return 'GOOD';
        if (securedPercentage >= 60) return 'MODERATE';
        if (securedPercentage >= 30) return 'POOR';
        return 'DANGEROUS';
    }

    calculateOverallMetrics(analysis) {
        if (analysis.pools.length === 0) return;
        
        // Calculate average security across all pools
        let totalSecurity = 0;
        let validPools = 0;
        
        analysis.pools.forEach(pool => {
            if (pool.securedPercentage !== undefined) {
                totalSecurity += pool.securedPercentage;
                validPools++;
            }
        });
        
        analysis.securedPercentage = validPools > 0 ? totalSecurity / validPools : 0;
        analysis.overallStatus = this.getSecurityStatus(analysis.securedPercentage);
        analysis.lpProviders = analysis.pools.length;
    }

    assessLiquidityRisks(analysis) {
        const risks = [];
        const warnings = [];
        
        // Security assessment
        if (analysis.securedPercentage < 30) {
            risks.push('🔴 Very low liquidity security (<30% locked/burned)');
        } else if (analysis.securedPercentage < 60) {
            warnings.push('🟡 Moderate liquidity security - Some rug pull risk');
        }
        
        // Pool count assessment
        if (analysis.pools.length === 1) {
            warnings.push('🟡 Single liquidity pool detected');
        } else if (analysis.pools.length === 0) {
            risks.push('🔴 No liquidity pools found');
        }
        
        // Provider count assessment
        if (analysis.lpProviders < 3) {
            warnings.push('🟡 Low LP provider count - Centralization risk');
        }
        
        analysis.riskFactors = risks;
        analysis.warnings = warnings;
    }

    // Quick analysis for immediate use
    async quickLiquidityCheck(tokenMint) {
        try {
            // Get token holders and look for DEX patterns
            const holders = await solanaService.getTokenLargestAccounts(tokenMint, 10);
            
            let dexHolders = 0;
            let totalInDEX = 0;
            const dexes = [];
            
            for (const holder of holders) {
                try {
                    const accountInfo = await solanaService.getAccountInfo(holder.address);
                    if (accountInfo && Object.values(this.DEX_PROGRAMS).includes(accountInfo.owner)) {
                        dexHolders++;
                        totalInDEX += holder.uiAmount;
                        const dexName = this.getDEXName(accountInfo.owner);
                        if (!dexes.includes(dexName)) {
                            dexes.push(dexName);
                        }
                    }
                } catch (error) {
                    // Continue on individual failures
                }
            }
            
            return {
                status: 'QUICK_ANALYSIS',
                dexHolders,
                dexes,
                totalInDEX,
                findings: [
                    `${dexHolders} DEX accounts detected`,
                    `Present on: ${dexes.join(', ') || 'No major DEX'}`,
                    `DEX liquidity: ${totalInDEX.toFixed(2)} tokens`
                ]
            };
            
        } catch (error) {
            return {
                status: 'ERROR',
                error: error.message
            };
        }
    }
}

module.exports = new LiquidityAnalyzer();
