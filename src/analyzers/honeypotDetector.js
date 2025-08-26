// src/analyzers/honeypotDetector.js - FIXED VERSION
const solanaService = require('../services/solanaService');
const jupiterService = require('../services/jupiterService');
const logger = require('../utils/logger');

class HoneypotDetector {
    constructor() {
        logger.info('Enhanced honeypot detector initialized');
    }

    async detectHoneypot(mintAddress) {
        try {
            logger.info(`Starting comprehensive honeypot detection for: ${mintAddress}`);
            
            const analysis = {
                mintAddress,
                timestamp: new Date().toISOString(),
                tests: {},
                honeypotProbability: { overall: 0, confidence: 0 }
            };

            // 1. Authority-based detection
            console.log('   🔍 Checking authorities...');
            analysis.tests.authorityAnalysis = await this.analyzeAuthorities(mintAddress);
            
            // 2. Program analysis
            console.log('   🔍 Analyzing program...');
            analysis.tests.programAnalysis = await this.analyzeProgram(mintAddress);
            
            // 3. Supply analysis  
            console.log('   🔍 Checking supply mechanics...');
            analysis.tests.supplyAnalysis = await this.analyzeSupplyMetrics(mintAddress);
            
            // 4. Trading simulation (Jupiter)
            console.log('   🔍 Running trading simulation...');
            analysis.tests.tradingSimulation = await this.runTradingSimulation(mintAddress);
            
            // 5. Calculate final probability
            analysis.honeypotProbability = this.calculateHoneypotProbability(analysis.tests);
            analysis.verdict = this.generateVerdict(analysis.honeypotProbability);
            analysis.recommendations = this.generateRecommendations(analysis.tests);

            logger.info(`Honeypot detection completed - Risk: ${analysis.honeypotProbability.overall}%`);
            return analysis;

        } catch (error) {
            logger.error(`Honeypot detection failed for ${mintAddress}:`, error.message);
            return {
                mintAddress,
                timestamp: new Date().toISOString(),
                tests: {},
                honeypotProbability: { overall: 50, confidence: 0.3, method: 'ERROR' },
                verdict: 'ANALYSIS_FAILED',
                error: error.message
            };
        }
    }

    async analyzeAuthorities(mintAddress) {
        try {
            const mintInfo = await solanaService.getTokenMintInfo(mintAddress);
            
            const issues = [];
            let riskScore = 0;

            if (mintInfo.mintAuthority) {
                issues.push('MINT_AUTHORITY_ACTIVE');
                riskScore += 40;
            }

            if (mintInfo.freezeAuthority) {
                issues.push('FREEZE_AUTHORITY_ACTIVE');
                riskScore += 50;
            }

            return {
                mintAuthority: mintInfo.mintAuthority,
                freezeAuthority: mintInfo.freezeAuthority,
                issues,
                riskScore,
                severity: riskScore > 70 ? 'CRITICAL' : riskScore > 30 ? 'HIGH' : 'LOW'
            };
        } catch (error) {
            return { issues: ['AUTHORITY_ANALYSIS_FAILED'], riskScore: 30, severity: 'MEDIUM' };
        }
    }

    async analyzeProgram(mintAddress) {
        try {
            const accountInfo = await solanaService.getAccountInfo(mintAddress);
            
            if (!accountInfo) {
                return { issues: ['ACCOUNT_NOT_FOUND'], riskScore: 90, severity: 'CRITICAL' };
            }

            const standardPrograms = [
                'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
                'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
            ];

            const isStandard = standardPrograms.includes(accountInfo.owner);
            
            return {
                owner: accountInfo.owner,
                isStandardProgram: isStandard,
                issues: isStandard ? [] : ['NON_STANDARD_PROGRAM'],
                riskScore: isStandard ? 0 : 60,
                severity: isStandard ? 'LOW' : 'HIGH'
            };
        } catch (error) {
            return { issues: ['PROGRAM_ANALYSIS_FAILED'], riskScore: 40, severity: 'MEDIUM' };
        }
    }

    async analyzeSupplyMetrics(mintAddress) {
        try {
            const supply = await solanaService.getTokenSupply(mintAddress);
            const mintInfo = await solanaService.getTokenMintInfo(mintAddress);
            
            const totalSupply = parseFloat(supply.uiAmountString || '0');
            let riskScore = 0;
            const issues = [];

            if (totalSupply === 0) {
                issues.push('ZERO_SUPPLY');
                riskScore += 80;
            } else if (totalSupply > 1e12) {
                issues.push('EXTREMELY_HIGH_SUPPLY');
                riskScore += 15;
            }

            if (mintInfo.decimals > 18 || mintInfo.decimals === 0) {
                issues.push('UNUSUAL_DECIMALS');
                riskScore += 10;
            }

            return {
                totalSupply,
                decimals: mintInfo.decimals,
                issues,
                riskScore,
                severity: riskScore > 60 ? 'CRITICAL' : riskScore > 20 ? 'MEDIUM' : 'LOW'
            };
        } catch (error) {
            return { issues: ['SUPPLY_ANALYSIS_FAILED'], riskScore: 30, severity: 'MEDIUM' };
        }
    }

    async runTradingSimulation(mintAddress) {
        try {
            // Check if Jupiter API is available
            const isAvailable = await jupiterService.testConnectivity();
            
            if (!isAvailable) {
                return {
                    simulation: 'SKIPPED',
                    reason: 'JUPITER_API_UNAVAILABLE',
                    riskScore: 20,
                    severity: 'LOW'
                };
            }

            const result = await jupiterService.simulateSwap(mintAddress);
            
            let riskScore = 0;
            const issues = [];

            if (!result.canBuy) {
                issues.push('CANNOT_BUY_TOKEN');
                riskScore += 80;
            }

            if (!result.canSell) {
                issues.push('CANNOT_SELL_TOKEN');
                riskScore += 90;
            }

            if (result.honeypotAnalysis) {
                riskScore = Math.max(riskScore, result.honeypotAnalysis.probability || 0);
                if (result.honeypotAnalysis.indicators) {
                    issues.push(...result.honeypotAnalysis.indicators);
                }
            }

            return {
                simulation: 'COMPLETED',
                canBuy: result.canBuy,
                canSell: result.canSell,
                honeypotAnalysis: result.honeypotAnalysis,
                issues,
                riskScore,
                severity: riskScore > 80 ? 'CRITICAL' : riskScore > 50 ? 'HIGH' : 'LOW'
            };

        } catch (error) {
            return {
                simulation: 'FAILED',
                issues: ['TRADING_SIMULATION_ERROR'],
                riskScore: 40,
                severity: 'MEDIUM',
                error: error.message
            };
        }
    }

    calculateHoneypotProbability(tests) {
        const weights = {
            authorityAnalysis: 0.3,
            programAnalysis: 0.2,
            supplyAnalysis: 0.15,
            tradingSimulation: 0.35
        };

        let totalRisk = 0;
        let totalWeight = 0;

        Object.entries(tests).forEach(([testName, result]) => {
            if (result && typeof result.riskScore === 'number') {
                const weight = weights[testName] || 0.1;
                totalRisk += result.riskScore * weight;
                totalWeight += weight;
            }
        });

        const overall = totalWeight > 0 ? Math.round(totalRisk / totalWeight) : 30;
        const confidence = Math.min(0.9, totalWeight);

        return {
            overall: Math.max(0, Math.min(100, overall)),
            confidence,
            method: 'COMPREHENSIVE_ANALYSIS',
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
                    severity: result.severity || 'UNKNOWN'
                };
            }
        });
        return breakdown;
    }

    generateVerdict(probability) {
        if (probability.overall >= 80) return 'CONFIRMED_HONEYPOT';
        if (probability.overall >= 60) return 'LIKELY_HONEYPOT';
        if (probability.overall >= 40) return 'SUSPICIOUS';
        if (probability.overall >= 20) return 'CAUTION_ADVISED';
        return 'LOW_RISK';
    }

    generateRecommendations(tests) {
        const recommendations = [];
        
        Object.values(tests).forEach(test => {
            if (test.issues) {
                test.issues.forEach(issue => {
                    switch (issue) {
                        case 'MINT_AUTHORITY_ACTIVE':
                            recommendations.push('⚠️ Mint authority not revoked - supply can be manipulated');
                            break;
                        case 'FREEZE_AUTHORITY_ACTIVE':
                            recommendations.push('⚠️ Freeze authority not revoked - accounts can be frozen');
                            break;
                        case 'CANNOT_SELL_TOKEN':
                            recommendations.push('🚨 CRITICAL: Cannot sell tokens - confirmed honeypot');
                            break;
                        case 'NON_STANDARD_PROGRAM':
                            recommendations.push('⚠️ Uses non-standard token program - higher risk');
                            break;
                    }
                });
            }
        });
        
        return [...new Set(recommendations)];
    }
}

module.exports = new HoneypotDetector();
