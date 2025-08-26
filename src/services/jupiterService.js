// src/services/jupiterService.js - UPDATED FOR FREE API
const axios = require('axios');
const logger = require('../utils/logger');

class JupiterService {
    constructor() {
        // Jupiter Lite API (Free - 1 RPS)
        this.baseURL = 'https://lite-api.jup.ag';
        this.priceURL = 'https://api.jup.ag/price/v2';
        this.quoteURL = 'https://lite-api.jup.ag/v6/quote';
        
        this.apiAvailable = true;
        this.lastRequestTime = 0;
        this.rateLimit = 1100; // 1.1 seconds between requests (slightly over 1 RPS limit)
        
        logger.info('Jupiter Service initialized with FREE API (1 RPS limit)');
    }

    async rateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < this.rateLimit) {
            const waitTime = this.rateLimit - timeSinceLastRequest;
            logger.debug(`Rate limiting: waiting ${waitTime}ms`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        this.lastRequestTime = Date.now();
    }

    async testConnectivity() {
        try {
            await this.rateLimit();
            const response = await axios.get(`${this.priceURL}?ids=So11111111111111111111111111111111111111112`, {
                timeout: 5000
            });
            
            logger.info('Jupiter API connectivity: ✅ OK');
            return true;
        } catch (error) {
            logger.warn('Jupiter API connectivity: ❌ FAILED -', error.message);
            return false;
        }
    }

    async getPrice(tokenMint, vsCurrency = 'USDC') {
        try {
            await this.rateLimit();
            
            const response = await axios.get(`${this.priceURL}`, {
                params: {
                    ids: tokenMint,
                    vsToken: vsCurrency
                },
                timeout: 10000
            });
            
            if (response.data.data && response.data.data[tokenMint]) {
                const priceData = response.data.data[tokenMint];
                return {
                    id: tokenMint,
                    price: priceData.price,
                    vsToken: vsCurrency,
                    source: 'JUPITER_FREE_API'
                };
            }
            
            return null;
        } catch (error) {
            logger.error(`Failed to get price for ${tokenMint}:`, error.message);
            return null;
        }
    }

    async getSwapQuote(inputMint, outputMint, amount, slippageBps = 50) {
        try {
            await this.rateLimit();
            
            const response = await axios.get(this.quoteURL, {
                params: {
                    inputMint,
                    outputMint,
                    amount,
                    slippageBps
                },
                timeout: 15000
            });
            
            return response.data;
        } catch (error) {
            logger.error(`Failed to get swap quote:`, error.message);
            throw error;
        }
    }

    async simulateSwap(tokenMint, testAmount = 1000000) {
        try {
            logger.info(`🔄 Simulating swap for honeypot detection: ${tokenMint}`);
            
            const SOL_MINT = 'So11111111111111111111111111111111111111112';
            
            // Test buying tokens with SOL
            logger.debug('Testing BUY transaction...');
            const buyQuote = await this.getSwapQuote(SOL_MINT, tokenMint, testAmount);
            
            if (!buyQuote || !buyQuote.outAmount) {
                return {
                    canBuy: false,
                    canSell: false,
                    buyQuote: null,
                    sellQuote: null,
                    honeypotAnalysis: {
                        isHoneypot: true,
                        confidence: 0.8,
                        indicators: ['NO_BUY_ROUTE'],
                        severity: 'CRITICAL'
                    }
                };
            }

            // Test selling tokens back to SOL
            logger.debug('Testing SELL transaction...');
            const sellQuote = await this.getSwapQuote(tokenMint, SOL_MINT, buyQuote.outAmount);
            
            const canSell = !!sellQuote;
            
            // Calculate honeypot probability
            let honeypotProbability = 0;
            const indicators = [];
            
            if (!canSell) {
                honeypotProbability = 95;
                indicators.push('CANNOT_SELL');
            } else {
                // Check for suspicious price impact
                const buyImpact = parseFloat(buyQuote.priceImpactPct || 0);
                const sellImpact = parseFloat(sellQuote.priceImpactPct || 0);
                
                if (buyImpact > 10) {
                    honeypotProbability += 20;
                    indicators.push('HIGH_BUY_IMPACT');
                }
                
                if (sellImpact > 15) {
                    honeypotProbability += 30;
                    indicators.push('HIGH_SELL_IMPACT');
                }
                
                // Check route count (fewer routes = more suspicious)
                if (buyQuote.routePlan && buyQuote.routePlan.length === 1) {
                    honeypotProbability += 10;
                    indicators.push('LIMITED_ROUTES');
                }
            }
            
            return {
                canBuy: true,
                canSell,
                buyQuote,
                sellQuote,
                honeypotAnalysis: {
                    isHoneypot: honeypotProbability > 50,
                    confidence: Math.min(0.9, honeypotProbability / 100),
                    probability: honeypotProbability,
                    indicators,
                    severity: honeypotProbability > 80 ? 'CRITICAL' : 
                             honeypotProbability > 50 ? 'HIGH' : 'LOW'
                },
                timestamp: Date.now()
            };
            
        } catch (error) {
            logger.error(`Swap simulation failed for ${tokenMint}:`, error.message);
            return {
                canBuy: false,
                canSell: false,
                buyQuote: null,
                sellQuote: null,
                honeypotAnalysis: {
                    isHoneypot: false,
                    confidence: 0.3,
                    probability: 30,
                    indicators: ['SIMULATION_FAILED'],
                    severity: 'MEDIUM'
                },
                error: error.message
            };
        }
    }
}

module.exports = new JupiterService();
