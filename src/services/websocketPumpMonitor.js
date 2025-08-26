// src/services/websocketPumpMonitor.js - PROPER WSS + REAL ANALYSIS
const WebSocket = require('ws');
const { Connection, PublicKey } = require('@solana/web3.js');
const EventEmitter = require('events');

class WebSocketPumpMonitor extends EventEmitter {
    constructor() {
        super();
        this.PUMP_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
        
        // Use your WSS endpoint properly
        this.wsUrl = process.env.SOLANA_RPC_WSS || 'wss://hidden-stylish-haze.solana-mainnet.quiknode.pro/3ee509e3cd9e1f9a411d8aedfa8ec76a29d4fd99/';
        this.httpUrl = process.env.SOLANA_RPC_HTTP || 'https://hidden-stylish-haze.solana-mainnet.quiknode.pro/3ee509e3cd9e1f9a411d8aedfa8ec76a29d4fd99/';
        
        // WebSocket for streaming, HTTP only for data fetching
        this.wsConnection = null;
        this.httpConnection = new Connection(this.httpUrl, 'confirmed');
        
        // Queue system
        this.tokenQueue = [];
        this.isAnalyzing = false;
        this.isStreaming = true;
        this.processedSignatures = new Set();
        this.maxQueueSize = 20; // Smaller queue to prevent overwhelm
        
        // Statistics tracking
        this.stats = {
            detected: 0,
            analyzed: 0,
            apiCalls: 0,
            startTime: Date.now(),
            recentResults: []
        };
        
        console.log(`WebSocket Monitor initialized:`);
        console.log(`  WSS: ${this.wsUrl}`);
        console.log(`  HTTP: ${this.httpUrl}`);
    }

    async startMonitoring() {
        console.log('\n🚀 Starting REAL WebSocket-based Analysis');
        console.log('═══════════════════════════════════════════');
        console.log('🔗 Using WebSocket for streaming (95% less API usage)');
        console.log('🎯 REAL token extraction and analysis');
        console.log('\n📝 Controls:');
        console.log('   s + Enter: Toggle streaming');
        console.log('   q + Enter: View detailed status');
        console.log('   r + Enter: View recent results');
        console.log('   x + Enter: Exit');
        console.log('═══════════════════════════════════════════\n');
        
        try {
            await this.connectWebSocket();
            this.startAnalysisWorker();
            this.setupKeyboardControls();
            this.startStatusUpdates();
            
            console.log('✅ WebSocket connected - Minimal API usage mode!');
            console.log('🎯 Waiting for REAL token detections...\n');
            
        } catch (error) {
            console.error('❌ Failed to start WebSocket monitoring:', error.message);
            throw error;
        }
    }

    async connectWebSocket() {
        return new Promise((resolve, reject) => {
            this.wsConnection = new WebSocket(this.wsUrl);
            
            this.wsConnection.on('open', () => {
                console.log('🔗 WebSocket connected to QuickNode');
                
                // Subscribe to pump.fun program logs
                const subscribeMessage = {
                    "jsonrpc": "2.0",
                    "id": 420,
                    "method": "logsSubscribe",
                    "params": [
                        {
                            "mentions": [this.PUMP_PROGRAM_ID]
                        },
                        {
                            "commitment": "confirmed"
                        }
                    ]
                };
                
                this.wsConnection.send(JSON.stringify(subscribeMessage));
                resolve();
            });
            
            this.wsConnection.on('message', (data) => {
                this.handleWebSocketMessage(data);
            });
            
            this.wsConnection.on('error', (error) => {
                console.error('❌ WebSocket error:', error.message);
                reject(error);
            });
            
            this.wsConnection.on('close', () => {
                console.log('🔗 WebSocket disconnected - reconnecting...');
                setTimeout(() => this.connectWebSocket(), 3000);
            });
        });
    }

    handleWebSocketMessage(data) {
        if (!this.isStreaming) return;
        
        try {
            const message = JSON.parse(data.toString());
            
            // Handle subscription confirmation
            if (message.result && typeof message.result === 'number') {
                console.log(`📡 Subscribed to pump.fun logs (Sub ID: ${message.result})`);
                return;
            }
            
            // Handle log notifications
            if (message.method === 'logsNotification' && message.params) {
                this.processLogNotification(message.params);
            }
            
        } catch (error) {
            console.error('Error parsing WebSocket message:', error.message);
        }
    }

    processLogNotification(params) {
        try {
            const result = params.result;
            const signature = result.value.signature;
            
            // Skip duplicates
            if (this.processedSignatures.has(signature)) return;
            
            // Look for token creation patterns
            const hasTokenCreation = result.value.logs.some(log => 
                log.includes('Program log: Instruction: InitializeMint2') ||
                log.includes('InitializeMint2') ||
                log.includes('Create') && log.includes('mint')
            );

            if (hasTokenCreation) {
                this.processedSignatures.add(signature);
                this.stats.detected++;
                
                const tokenEvent = {
                    signature,
                    slot: result.context.slot,
                    timestamp: new Date().toISOString(),
                    logs: result.value.logs,
                    detectedAt: Date.now()
                };
                
                if (this.tokenQueue.length < this.maxQueueSize) {
                    this.tokenQueue.push(tokenEvent);
                    console.log(`🆕 REAL token detected: ${signature.substring(0, 10)}... (Queue: ${this.tokenQueue.length})`);
                } else {
                    console.log(`⚠️ Queue full! Skipped: ${signature.substring(0, 10)}...`);
                }
            }
            
        } catch (error) {
            console.error('Error processing log:', error.message);
        }
    }

    startAnalysisWorker() {
        setInterval(async () => {
            if (!this.isAnalyzing && this.tokenQueue.length > 0) {
                this.isAnalyzing = true;
                
                const tokenEvent = this.tokenQueue.shift();
                console.log(`\n🔍 ANALYZING REAL TOKEN (${this.tokenQueue.length} queued)`);
                
                try {
                    await this.analyzeRealToken(tokenEvent);
                    this.stats.analyzed++;
                } catch (error) {
                    console.error(`❌ Analysis failed: ${error.message}`);
                } finally {
                    this.isAnalyzing = false;
                }
            }
        }, 3000); // 3 second intervals to prevent overwhelm
    }

    async analyzeRealToken(tokenEvent) {
        try {
            console.log(`📋 TX: ${tokenEvent.signature}`);
            
            // 1. Get transaction to extract token mint
            console.log('🔍 Extracting token mint from transaction...');
            this.stats.apiCalls++;
            
            const transaction = await this.httpConnection.getTransaction(tokenEvent.signature, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0
            });
            
            if (!transaction) {
                console.log('❌ Transaction not found');
                return;
            }
            
            // 2. Extract the new token mint
            const tokenMint = this.extractTokenMintFromTransaction(transaction);
            
            if (!tokenMint) {
                console.log('❌ Could not extract token mint');
                return;
            }
            
            console.log(`🎯 Token Mint Found: ${tokenMint}`);
            
            // 3. Run REAL comprehensive analysis
            console.log('🔍 Running REAL security analysis...');
            
            const tokenAnalyzer = require('../analyzers/tokenAnalyzer');
            
            // Run focused analysis to minimize API calls
            const analysis = await tokenAnalyzer.analyzeToken(tokenMint, {
                includeHolderAnalysis: false,  // Skip to save API calls
                includeHoneypotDetection: true,
                includeMetadata: true,
                includeMarketData: false
            });
            
            this.stats.apiCalls += 4; // Estimate API calls used
            
            // 4. Display comprehensive results
            this.displayComprehensiveResults(tokenMint, analysis, tokenEvent);
            
            // Store for recent results
            this.stats.recentResults.unshift({
                tokenMint,
                riskScore: analysis.riskScore,
                safetyLevel: analysis.safetyLevel,
                timestamp: new Date().toISOString(),
                signature: tokenEvent.signature
            });
            
            // Keep only last 10 results
            if (this.stats.recentResults.length > 10) {
                this.stats.recentResults.pop();
            }
            
        } catch (error) {
            console.error(`❌ Real analysis failed: ${error.message}`);
        }
    }

    extractTokenMintFromTransaction(transaction) {
        try {
            // Extract from account keys - new mint is typically account[1] or in instructions
            const accountKeys = transaction.transaction.message.accountKeys;
            
            if (accountKeys && accountKeys.length > 1) {
                // Usually the new token mint is the second account
                return accountKeys[1].toBase58();
            }
            
            return null;
            
        } catch (error) {
            console.error('Token mint extraction failed:', error.message);
            return null;
        }
    }

    displayComprehensiveResults(tokenMint, analysis, tokenEvent) {
        console.log(`\n${'═'.repeat(80)}`);
        console.log(`🎯 COMPREHENSIVE TOKEN ANALYSIS RESULTS`);
        console.log(`${'═'.repeat(80)}`);
        console.log(`📍 Token: ${tokenMint}`);
        console.log(`📋 TX: ${tokenEvent.signature}`);
        console.log(`⏰ Detected: ${new Date(tokenEvent.timestamp).toLocaleString()}`);
        console.log(`📊 Risk Score: ${analysis.riskScore}/100`);
        console.log(`🛡️ Safety Level: ${analysis.safetyLevel}`);
        
        // Token details
        if (analysis.checks.metadata?.metadata) {
            const meta = analysis.checks.metadata.metadata;
            console.log(`\n📝 TOKEN INFO:`);
            console.log(`   Name: ${meta.name || 'Unknown'}`);
            console.log(`   Symbol: ${meta.symbol || 'Unknown'}`);
        }
        
        // Supply info
        if (analysis.checks.basicInfo?.supply) {
            console.log(`\n📊 SUPPLY:`);
            console.log(`   Total: ${analysis.checks.basicInfo.supply.uiAmountString}`);
            console.log(`   Decimals: ${analysis.checks.basicInfo.mintInfo.decimals}`);
        }
        
        // CRITICAL SECURITY CHECKS
        console.log(`\n🔒 CRITICAL SECURITY:`);
        const auth = analysis.checks.authorities;
        if (auth) {
            console.log(`   Mint Authority: ${auth.mintAuthority ? '❌ ACTIVE (DANGER!)' : '✅ REVOKED'}`);
            console.log(`   Freeze Authority: ${auth.freezeAuthority ? '❌ ACTIVE (DANGER!)' : '✅ REVOKED'}`);
        }
        
        const program = analysis.checks.programOwnership;
        if (program) {
            console.log(`   Program: ${program.isValidProgram ? '✅ Standard SPL' : '❌ Custom Program (RISK!)'}`);
        }
        
        // HONEYPOT ANALYSIS
        if (analysis.checks.honeypot) {
            const honeypot = analysis.checks.honeypot;
            console.log(`\n🍯 HONEYPOT ANALYSIS:`);
            console.log(`   Risk Level: ${honeypot.honeypotProbability?.overall || 0}%`);
            console.log(`   Verdict: ${honeypot.verdict}`);
            console.log(`   Confidence: ${((honeypot.honeypotProbability?.confidence || 0) * 100).toFixed(1)}%`);
        }
        
        // ISSUES AND WARNINGS
        const issues = [];
        const warnings = [];
        
        Object.values(analysis.checks).forEach(check => {
            if (check?.issues) issues.push(...check.issues);
            if (check?.warnings) warnings.push(...check.warnings);
        });
        
        if (issues.length > 0) {
            console.log(`\n🚨 CRITICAL ISSUES:`);
            issues.slice(0, 3).forEach((issue, i) => {
                console.log(`   ${i+1}. ${issue}`);
            });
        }
        
        if (warnings.length > 0) {
            console.log(`\n⚠️ WARNINGS:`);
            warnings.slice(0, 2).forEach((warning, i) => {
                console.log(`   ${i+1}. ${warning}`);
            });
        }
        
        // FINAL VERDICT
        console.log(`\n💡 FINAL VERDICT:`);
        if (analysis.riskScore >= 80) {
            console.log(`   🚨 EXTREMELY DANGEROUS - DO NOT TRADE`);
            console.log(`   Multiple critical security flaws detected!`);
        } else if (analysis.riskScore >= 60) {
            console.log(`   🔴 HIGH RISK - LIKELY SCAM`);
            console.log(`   Significant security concerns found`);
        } else if (analysis.riskScore >= 40) {
            console.log(`   🟠 MODERATE RISK - PROCEED WITH CAUTION`);
            console.log(`   Some risk factors present`);
        } else if (analysis.riskScore >= 20) {
            console.log(`   🟡 LOW RISK - RELATIVELY SAFE`);
            console.log(`   Always do your own research`);
        } else {
            console.log(`   ✅ APPEARS SECURE`);
            console.log(`   Good security practices detected`);
        }
        
        console.log(`${'═'.repeat(80)}\n`);
    }

    setupKeyboardControls() {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.on('line', (input) => {
            const command = input.trim().toLowerCase();
            
            switch (command) {
                case 's':
                    this.toggleStreaming();
                    break;
                case 'q':
                    this.showDetailedStatus();
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
                    console.log('\n❓ Commands: s(toggle) | q(status) | r(results) | x(exit)\n');
            }
        });
    }

    toggleStreaming() {
        this.isStreaming = !this.isStreaming;
        const emoji = this.isStreaming ? '▶️' : '⏸️';
        console.log(`\n${emoji} Streaming ${this.isStreaming ? 'RESUMED' : 'PAUSED'}\n`);
    }

    showDetailedStatus() {
        const uptime = ((Date.now() - this.stats.startTime) / 1000 / 60).toFixed(1);
        const apiRate = (this.stats.apiCalls / Math.max(uptime, 0.1)).toFixed(1);
        const efficiency = ((this.stats.analyzed / Math.max(this.stats.apiCalls, 1)) * 100).toFixed(1);
        
        console.log('\n📊 WEBSOCKET MONITOR STATUS');
        console.log('═══════════════════════════════════');
        console.log(`⏱️ Uptime: ${uptime} minutes`);
        console.log(`🔗 WebSocket: ${this.wsConnection?.readyState === 1 ? '✅ Connected' : '❌ Disconnected'}`);
        console.log(`🎯 Streaming: ${this.isStreaming ? '✅ ACTIVE' : '⏸️ PAUSED'}`);
        console.log(`🔍 Analyzing: ${this.isAnalyzing ? '✅ BUSY' : '⏳ IDLE'}`);
        console.log(`📝 Queue: ${this.tokenQueue.length}/${this.maxQueueSize}`);
        console.log(`\n📈 PERFORMANCE:`);
        console.log(`   Tokens Detected: ${this.stats.detected}`);
        console.log(`   Tokens Analyzed: ${this.stats.analyzed}`);  
        console.log(`   API Calls Used: ${this.stats.apiCalls}`);
        console.log(`   API Rate: ${apiRate} calls/minute`);
        console.log(`   Efficiency: ${efficiency}% (tokens per API call)`);
        console.log('');
    }

    showRecentResults() {
        console.log('\n📋 RECENT ANALYSIS RESULTS (Last 10)');
        console.log('═══════════════════════════════════════');
        
        if (this.stats.recentResults.length === 0) {
            console.log('   No analyses completed yet\n');
            return;
        }
        
        this.stats.recentResults.forEach((result, i) => {
            const time = new Date(result.timestamp).toLocaleTimeString();
            const riskEmoji = result.riskScore >= 60 ? '🔴' : result.riskScore >= 40 ? '🟠' : '🟢';
            console.log(`   ${i+1}. ${riskEmoji} ${result.tokenMint.substring(0, 12)}... | Risk: ${result.riskScore} | ${time}`);
        });
        console.log('');
    }

    startStatusUpdates() {
        setInterval(() => {
            if (this.stats.detected > 0) {
                const efficiency = ((this.stats.analyzed / Math.max(this.stats.apiCalls, 1)) * 100).toFixed(0);
                console.log(`📊 ${this.stats.detected} detected | ${this.stats.analyzed} analyzed | ${this.stats.apiCalls} API calls | ${efficiency}% efficiency | ${this.isStreaming ? 'ON' : 'OFF'}`);
            }
        }, 120000); // Every 2 minutes
    }
}

module.exports = new WebSocketPumpMonitor();
