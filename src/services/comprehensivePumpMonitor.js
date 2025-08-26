// src/services/comprehensivePumpMonitor.js - FULL ANALYSIS LIKE SINGLE TOKEN MODE
const WebSocket = require('ws');
const { Connection, PublicKey } = require('@solana/web3.js');
const EventEmitter = require('events');

class ComprehensivePumpMonitor extends EventEmitter {
    constructor() {
        super();
        this.PUMP_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
        
        this.wsUrl = process.env.SOLANA_RPC_WSS;
        this.httpUrl = process.env.SOLANA_RPC_HTTP;
        
        this.wsConnection = null;
        this.httpConnection = new Connection(this.httpUrl, 'confirmed');
        
        // Conservative settings for full analysis
        this.tokenQueue = [];
        this.isAnalyzing = false;
        this.isStreaming = true;
        this.processedSignatures = new Set();
        this.maxQueueSize = 6; // Smaller queue for full analysis
        this.analysisDelay = 25000; // 25 seconds for complete initialization
        
        this.stats = {
            detected: 0,
            analyzed: 0,
            apiCalls: 0,
            startTime: Date.now(),
            recentResults: []
        };
    }

    async startMonitoring() {
        console.log('\n🚀 COMPREHENSIVE Real-Time Token Analyzer');
        console.log('═══════════════════════════════════════════════');
        console.log('🔍 FULL security analysis (same as single token mode)');
        console.log('💧 Liquidity lock detection & security assessment');
        console.log('🍯 Complete honeypot detection');
        console.log('👥 Holder distribution analysis');
        console.log('📊 All security checks included');
        console.log('⏳ 25-second delay for complete analysis');
        console.log('\n📝 Commands: s(toggle) | q(status) | r(recent) | x(exit)');
        console.log('═══════════════════════════════════════════════\n');
        
        try {
            await this.connectWebSocket();
            this.startComprehensiveWorker();
            this.setupControls();
            
            console.log('✅ Comprehensive monitoring active!');
            console.log('🎯 Full analysis for each detected token...\n');
            
        } catch (error) {
            console.error('❌ Failed to start monitoring:', error.message);
            throw error;
        }
    }

    async connectWebSocket() {
        return new Promise((resolve, reject) => {
            this.wsConnection = new WebSocket(this.wsUrl);
            
            this.wsConnection.on('open', () => {
                console.log('🔗 WebSocket connected for comprehensive analysis');
                
                const subscribeMessage = {
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "logsSubscribe",
                    "params": [
                        {
                            "mentions": [this.PUMP_PROGRAM_ID]
                        },
                        {
                            "commitment": "finalized"
                        }
                    ]
                };
                
                this.wsConnection.send(JSON.stringify(subscribeMessage));
                resolve();
            });
            
            this.wsConnection.on('message', (data) => this.handleMessage(data));
            this.wsConnection.on('error', reject);
            this.wsConnection.on('close', () => {
                console.log('🔗 Reconnecting...');
                setTimeout(() => this.connectWebSocket(), 5000);
            });
        });
    }

    handleMessage(data) {
        if (!this.isStreaming) return;
        
        try {
            const message = JSON.parse(data.toString());
            
            if (message.result && typeof message.result === 'number') {
                console.log(`📡 Subscribed for comprehensive analysis (ID: ${message.result})`);
                return;
            }
            
            if (message.method === 'logsNotification' && message.params) {
                this.processTokenCreation(message.params);
            }
            
        } catch (error) {
            console.error('WebSocket error:', error.message);
        }
    }

    processTokenCreation(params) {
        try {
            const result = params.result;
            const signature = result.value.signature;
            const logs = result.value.logs;
            
            if (this.processedSignatures.has(signature)) return;
            
            // Filter for actual token creation
            if (!this.isRealTokenCreation(logs)) return;
            
            this.processedSignatures.add(signature);
            this.stats.detected++;
            
            const tokenEvent = {
                signature,
                slot: result.context.slot,
                timestamp: new Date().toISOString(),
                logs,
                detectedAt: Date.now()
            };
            
            if (this.tokenQueue.length < this.maxQueueSize) {
                this.tokenQueue.push(tokenEvent);
                console.log(`🆕 Token queued for COMPREHENSIVE analysis (${this.tokenQueue.length}): ${signature.substring(0, 10)}...`);
            }
            
        } catch (error) {
            console.error('Processing error:', error.message);
        }
    }

    isRealTokenCreation(logs) {
        const creationIndicators = [
            'Program log: Instruction: InitializeMint2',
            'Program log: Instruction: Create'
        ];
        
        return creationIndicators.some(indicator => 
            logs.some(log => log.includes(indicator))
        );
    }

    startComprehensiveWorker() {
        setInterval(async () => {
            if (!this.isAnalyzing && this.tokenQueue.length > 0) {
                this.isAnalyzing = true;
                
                const tokenEvent = this.tokenQueue.shift();
                
                // Wait for token to be fully ready
                const tokenAge = Date.now() - tokenEvent.detectedAt;
                if (tokenAge < this.analysisDelay) {
                    this.tokenQueue.unshift(tokenEvent);
                    this.isAnalyzing = false;
                    return;
                }
                
                console.log(`\n🔍 STARTING COMPREHENSIVE ANALYSIS (${this.tokenQueue.length} queued)`);
                console.log(`${'═'.repeat(90)}`);
                
                try {
                    await this.runFullAnalysis(tokenEvent);
                    this.stats.analyzed++;
                } catch (error) {
                    console.error(`❌ Analysis failed: ${error.message}`);
                } finally {
                    this.isAnalyzing = false;
                }
            }
        }, 8000); // Check every 8 seconds
    }

    async runFullAnalysis(tokenEvent) {
        try {
            // 1. Extract token mint
            const tokenMint = await this.extractTokenMint(tokenEvent);
            if (!tokenMint) {
                console.log('❌ Could not extract token mint');
                return;
            }
            
            console.log(`🎯 Token: ${tokenMint}`);
            console.log(`⏰ Age: ${((Date.now() - tokenEvent.detectedAt) / 1000).toFixed(1)}s`);
            console.log('🔄 Running COMPREHENSIVE analysis...\n');
            
            // 2. Run FULL analysis (same as single token command)
            const tokenAnalyzer = require('../analyzers/tokenAnalyzer');
            const liquidityAnalyzer = require('../analyzers/liquidityAnalyzer');
            
            // **COMPLETE ANALYSIS WITH ALL FEATURES**
            const analysis = await tokenAnalyzer.analyzeToken(tokenMint, {
                includeHolderAnalysis: true,    // ✅ Include holder analysis
                includeHoneypotDetection: true, // ✅ Include honeypot detection  
                includeMetadata: true,          // ✅ Include metadata
                includeMarketData: false        // Skip for speed
            });
            
            // **ADD LIQUIDITY ANALYSIS**
            console.log('💧 Analyzing liquidity locks...');
            const liquidityAnalysis = await liquidityAnalyzer.analyzeLiquidity(tokenMint);
            analysis.liquidity = liquidityAnalysis;
            
            this.stats.apiCalls += 12; // Estimate for full analysis
            
            // 3. Display FULL results (same as single token analysis)
            this.displayFullResults(tokenMint, analysis, tokenEvent);
            
            // 4. Store comprehensive result
            this.storeResult(tokenMint, analysis, tokenEvent);
            
        } catch (error) {
            console.error(`Full analysis error: ${error.message}`);
        }
    }

    async extractTokenMint(tokenEvent) {
        try {
            this.stats.apiCalls++;
            const transaction = await this.httpConnection.getTransaction(tokenEvent.signature, {
                commitment: 'finalized',
                maxSupportedTransactionVersion: 0
            });
            
            if (!transaction) return null;
            
            // Extract from postTokenBalances (most reliable)
            if (transaction.meta?.postTokenBalances) {
                for (const balance of transaction.meta.postTokenBalances) {
                    if (balance.mint && balance.uiTokenAmount) {
                        return balance.mint;
                    }
                }
            }
            
            return null;
            
        } catch (error) {
            return null;
        }
    }

    displayFullResults(tokenMint, analysis, tokenEvent) {
        console.log(`\n${'═'.repeat(90)}`);
        console.log(`🎯 COMPREHENSIVE TOKEN SECURITY ANALYSIS RESULTS`);
        console.log(`${'═'.repeat(90)}`);
        console.log(`📍 Token: ${tokenMint}`);
        console.log(`📋 Transaction: ${tokenEvent.signature}`);
        console.log(`⏰ Detected: ${new Date(tokenEvent.timestamp).toLocaleString()}`);
        console.log(`📊 Risk Score: ${analysis.riskScore}/100`);
        console.log(`🛡️ Safety Level: ${analysis.safetyLevel}`);

        // **TOKEN INFORMATION** (same as single analysis)
        if (analysis.checks.metadata?.metadata) {
            const meta = analysis.checks.metadata.metadata;
            console.log(`\n📝 TOKEN INFORMATION:`);
            console.log(`   Name: ${meta.name || 'Unknown'}`);
            console.log(`   Symbol: ${meta.symbol || 'Unknown'}`);
        }

        if (analysis.checks.basicInfo?.supply) {
            console.log(`\n📊 TOKEN SUPPLY:`);
            console.log(`   Total Supply: ${analysis.checks.basicInfo.supply.uiAmountString}`);
            console.log(`   Decimals: ${analysis.checks.basicInfo.mintInfo.decimals}`);
        }

        // **CRITICAL SECURITY CHECKS** (same as single analysis)
        console.log(`\n🔒 CRITICAL SECURITY CHECKS:`);
        
        const auth = analysis.checks.authorities;
        if (auth) {
            console.log(`   Mint Authority: ${auth.mintAuthority ? '❌ ACTIVE (CRITICAL RISK)' : '✅ REVOKED'}`);
            console.log(`   Freeze Authority: ${auth.freezeAuthority ? '❌ ACTIVE (CRITICAL RISK)' : '✅ REVOKED'}`);
        }

        const program = analysis.checks.programOwnership;
        if (program) {
            console.log(`   Program Owner: ${program.isValidProgram ? '✅ Standard SPL Token' : '❌ Non-standard Program (HIGH RISK)'}`);
        }

        // **HONEYPOT ANALYSIS** (same as single analysis)
        if (analysis.checks.honeypot) {
            const honeypot = analysis.checks.honeypot;
            console.log(`\n🍯 HONEYPOT ANALYSIS:`);
            console.log(`   Risk Level: ${honeypot.honeypotProbability?.overall || 0}%`);
            console.log(`   Verdict: ${honeypot.verdict || 'UNKNOWN'}`);
            console.log(`   Analysis Method: ${honeypot.honeypotProbability?.method || 'ON_CHAIN_ANALYSIS'}`);
            console.log(`   Confidence: ${((honeypot.honeypotProbability?.confidence || 0) * 100).toFixed(1)}%`);
        }

        // **HOLDER DISTRIBUTION** (same as single analysis)
        if (analysis.checks.holders && !analysis.checks.holders.skipped) {
            const holders = analysis.checks.holders;
            console.log(`\n👥 HOLDER DISTRIBUTION:`);
            console.log(`   Holders Analyzed: ${holders.holderCount}`);
            if (holders.concentration) {
                console.log(`   Top Holder: ${holders.concentration.top1Percentage?.toFixed(1)}%`);
                console.log(`   Top 5 Holders: ${holders.concentration.top5Percentage?.toFixed(1)}%`);
                console.log(`   Top 10 Holders: ${holders.concentration.top10Percentage?.toFixed(1)}%`);
                
                if (holders.concentration.top1Percentage > 50) {
                    console.log(`   🚨 WARNING: Single holder owns majority!`);
                }
                if (holders.concentration.top10Percentage > 90) {
                    console.log(`   🚨 CRITICAL: Top 10 holders control ${holders.concentration.top10Percentage.toFixed(1)}%!`);
                }
            }
        }

        // **COMPREHENSIVE LIQUIDITY ANALYSIS** 
        console.log(`\n💧 LIQUIDITY SECURITY ANALYSIS:`);
        if (analysis.liquidity) {
            const liq = analysis.liquidity;
            const statusEmoji = this.getLiquidityEmoji(liq.overallStatus);
            
            console.log(`   Overall Status: ${statusEmoji} ${liq.overallStatus}`);
            console.log(`   Secured Liquidity: ${liq.securedPercentage?.toFixed(1) || 0}% locked/burned`);
            console.log(`   LP Providers: ${liq.lpProviders || 0}`);
            console.log(`   Pools Detected: ${liq.pools?.length || 0}`);
            
            if (liq.pools && liq.pools.length > 0) {
                console.log(`   Active on DEXs:`);
                const dexes = [...new Set(liq.pools.map(p => p.dex))];
                dexes.forEach(dex => {
                    console.log(`     • ${dex}`);
                });
            }
            
            // **LIQUIDITY RISK ASSESSMENT**
            if (liq.securedPercentage < 30) {
                console.log(`   🚨 LIQUIDITY RISK: Only ${liq.securedPercentage?.toFixed(1) || 0}% secured - HIGH RUG PULL RISK!`);
            } else if (liq.securedPercentage < 60) {
                console.log(`   ⚠️ MODERATE LIQUIDITY RISK: ${liq.securedPercentage.toFixed(1)}% secured`);
            } else if (liq.securedPercentage >= 80) {
                console.log(`   ✅ EXCELLENT LIQUIDITY SECURITY: ${liq.securedPercentage.toFixed(1)}% secured`);
            } else {
                console.log(`   🟢 GOOD LIQUIDITY SECURITY: ${liq.securedPercentage.toFixed(1)}% secured`);
            }
        }

        // **CRITICAL ISSUES** (same as single analysis)
        const allIssues = this.collectIssues(analysis);
        const allWarnings = this.collectWarnings(analysis);
        
        if (allIssues.length > 0) {
            console.log('\n🚨 CRITICAL ISSUES:');
            allIssues.slice(0, 5).forEach((issue, i) => {
                console.log(`   ${i+1}. ${issue}`);
            });
        }
        
        if (allWarnings.length > 0) {
            console.log('\n⚠️ WARNINGS:');
            allWarnings.slice(0, 3).forEach((warning, i) => {
                console.log(`   ${i+1}. ${warning}`);
            });
        }

        // **FINAL RECOMMENDATION** (same as single analysis)
        console.log(`\n💡 FINAL RECOMMENDATION:`);
        const recommendation = this.getFinalRecommendation(analysis);
        console.log(`   ${recommendation.verdict}`);
        if (recommendation.reasons && recommendation.reasons.length > 0) {
            recommendation.reasons.forEach(reason => {
                console.log(`   • ${reason}`);
            });
        }

        console.log(`\n${'═'.repeat(90)}\n`);
    }

    getLiquidityEmoji(status) {
        const emojis = {
            'EXCELLENT': '🟢',
            'GOOD': '🟡', 
            'MODERATE': '🟠',
            'POOR': '🔴',
            'DANGEROUS': '💀',
            'NO_LIQUIDITY': '❌',
            'ERROR': '❓'
        };
        return emojis[status] || '❓';
    }

    collectIssues(analysis) {
        const issues = [];
        
        Object.values(analysis.checks).forEach(check => {
            if (check?.issues) issues.push(...check.issues);
        });
        
        if (analysis.liquidity?.riskFactors) {
            issues.push(...analysis.liquidity.riskFactors);
        }
        
        return [...new Set(issues)];
    }

    collectWarnings(analysis) {
        const warnings = [];
        
        Object.values(analysis.checks).forEach(check => {
            if (check?.warnings) warnings.push(...check.warnings);
        });
        
        if (analysis.liquidity?.warnings) {
            warnings.push(...analysis.liquidity.warnings);
        }
        
        return [...new Set(warnings)];
    }

    getFinalRecommendation(analysis) {
        const reasons = [];
        let verdict = '';
        
        // Check authorities
        const auth = analysis.checks.authorities;
        if (auth?.mintAuthority || auth?.freezeAuthority) {
            reasons.push('Token authorities not revoked - dev can manipulate');
        }
        
        // Check holder concentration
        if (analysis.checks.holders?.concentration?.top1Percentage > 50) {
            reasons.push(`Single holder owns majority - extreme rug pull risk`);
        }
        
        // Check liquidity security
        if (analysis.liquidity?.securedPercentage < 30) {
            reasons.push(`Only ${analysis.liquidity.securedPercentage.toFixed(1)}% liquidity secured - high rug pull risk`);
        }
        
        // Generate verdict
        if (analysis.riskScore >= 80) {
            verdict = '🚨 DO NOT TRADE - Multiple critical security flaws';
        } else if (analysis.riskScore >= 60) {
            verdict = '⚠️ AVOID - High risk of rug pull or scam';
        } else if (analysis.riskScore >= 40) {
            verdict = '⚠️ PROCEED WITH EXTREME CAUTION';
        } else if (analysis.riskScore >= 20) {
            verdict = '✅ RELATIVELY SAFE - Always DYOR';
        } else {
            verdict = '✅ APPEARS SECURE - Good security practices';
        }
        
        return { verdict, reasons };
    }

    storeResult(tokenMint, analysis, tokenEvent) {
        this.stats.recentResults.unshift({
            tokenMint,
            riskScore: analysis.riskScore,
            safetyLevel: analysis.safetyLevel,
            liquiditySecured: analysis.liquidity?.securedPercentage || 0,
            timestamp: new Date().toISOString(),
            signature: tokenEvent.signature
        });
        
        if (this.stats.recentResults.length > 15) {
            this.stats.recentResults.pop();
        }
    }

    setupControls() {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.on('line', (input) => {
            switch (input.trim().toLowerCase()) {
                case 's':
                    this.isStreaming = !this.isStreaming;
                    console.log(`\n${this.isStreaming ? '▶️' : '⏸️'} Streaming ${this.isStreaming ? 'ON' : 'OFF'}\n`);
                    break;
                case 'q':
                    this.showStatus();
                    break;
                case 'r':
                    this.showRecentResults();
                    break;
                case 'x':
                    console.log('\n👋 Shutting down...');
                    if (this.wsConnection) this.wsConnection.close();
                    process.exit(0);
                    break;
                default:
                    console.log('\n📝 s(toggle) | q(status) | r(recent) | x(exit)\n');
            }
        });
    }

    showStatus() {
        const uptime = ((Date.now() - this.stats.startTime) / 1000 / 60).toFixed(1);
        
        console.log('\n📊 COMPREHENSIVE MONITOR STATUS');
        console.log('═══════════════════════════════════════');
        console.log(`⏱️ Uptime: ${uptime} minutes`);
        console.log(`🎯 Streaming: ${this.isStreaming ? '✅ ON' : '⏸️ OFF'}`);
        console.log(`🔍 Status: ${this.isAnalyzing ? 'Analyzing token' : 'Waiting'}`);
        console.log(`📝 Queue: ${this.tokenQueue.length}/${this.maxQueueSize}`);
        console.log(`📊 Detected: ${this.stats.detected} | Analyzed: ${this.stats.analyzed}`);
        console.log(`📡 API Calls: ${this.stats.apiCalls}`);
        console.log('\n🎯 FULL ANALYSIS FEATURES:');
        console.log('   ✅ Authority checks (mint/freeze)');
        console.log('   ✅ Honeypot detection');
        console.log('   ✅ Holder distribution');
        console.log('   ✅ Liquidity lock detection');
        console.log('   ✅ Metadata verification');
        console.log('');
    }

    showRecentResults() {
        console.log('\n📋 RECENT COMPREHENSIVE ANALYSES');
        console.log('═══════════════════════════════════');
        
        if (this.stats.recentResults.length === 0) {
            console.log('   No analyses completed yet\n');
            return;
        }
        
        this.stats.recentResults.slice(0, 8).forEach((result, i) => {
            const time = new Date(result.timestamp).toLocaleTimeString();
            const riskColor = result.riskScore >= 60 ? '🔴' : result.riskScore >= 40 ? '🟠' : '🟢';
            const liqColor = result.liquiditySecured >= 60 ? '🟢' : result.liquiditySecured >= 30 ? '🟠' : '🔴';
            
            console.log(`   ${i+1}. ${riskColor} ${result.tokenMint.substring(0, 10)}... | Risk: ${result.riskScore} | Liq: ${liqColor} ${result.liquiditySecured.toFixed(0)}% | ${time}`);
        });
        console.log('');
    }
}

module.exports = new ComprehensivePumpMonitor();
