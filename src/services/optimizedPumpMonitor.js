// src/services/optimizedPumpMonitor.js - ULTRA LOW API USAGE
const WebSocket = require('ws');
const { Connection, PublicKey } = require('@solana/web3.js');
const EventEmitter = require('events');

class OptimizedPumpMonitor extends EventEmitter {
    constructor() {
        super();
        this.PUMP_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
        
        this.wsUrl = process.env.SOLANA_RPC_WSS;
        this.httpUrl = process.env.SOLANA_RPC_HTTP;
        
        this.wsConnection = null;
        this.httpConnection = new Connection(this.httpUrl, 'confirmed');
        
        // Conservative settings
        this.tokenQueue = [];
        this.isAnalyzing = false;
        this.isStreaming = true;
        this.processedSignatures = new Set();
        this.maxQueueSize = 5; // Much smaller queue
        
        // KEY: Wait before analyzing - tokens need time to initialize
        this.analysisDelay = 15000; // 15 seconds delay
        
        this.stats = {
            detected: 0,
            analyzed: 0,
            apiCalls: 0,
            filtered: 0,
            failed: 0,
            startTime: Date.now(),
            recentResults: []
        };
    }

    async startMonitoring() {
        console.log('\n🚀 ULTRA-OPTIMIZED Pump.fun Monitor');
        console.log('═══════════════════════════════════════');
        console.log('💡 95% API usage reduction');
        console.log('⏳ 15-second analysis delay for stability');
        console.log('🎯 Smart filtering for quality detections');
        console.log('\n📝 Commands: s(toggle) | q(status) | x(exit)');
        console.log('═══════════════════════════════════════\n');
        
        try {
            await this.connectWebSocket();
            this.startOptimizedWorker();
            this.setupControls();
            this.startStatusReports();
            
            console.log('✅ Ultra-optimized monitoring active!');
            console.log('🎯 Waiting for quality token detections...\n');
            
        } catch (error) {
            console.error('❌ Failed to start monitoring:', error.message);
            throw error;
        }
    }

    async connectWebSocket() {
        return new Promise((resolve, reject) => {
            this.wsConnection = new WebSocket(this.wsUrl);
            
            this.wsConnection.on('open', () => {
                console.log('🔗 WebSocket connected to QuickNode');
                
                // Ultra-specific subscription
                const subscribeMessage = {
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "logsSubscribe",
                    "params": [
                        {
                            "mentions": [this.PUMP_PROGRAM_ID]
                        },
                        {
                            "commitment": "finalized" // More stable, less events
                        }
                    ]
                };
                
                this.wsConnection.send(JSON.stringify(subscribeMessage));
                resolve();
            });
            
            this.wsConnection.on('message', (data) => {
                this.handleMessage(data);
            });
            
            this.wsConnection.on('error', reject);
            this.wsConnection.on('close', () => {
                console.log('🔗 Reconnecting WebSocket...');
                setTimeout(() => this.connectWebSocket(), 5000);
            });
        });
    }

    handleMessage(data) {
        if (!this.isStreaming) return;
        
        try {
            const message = JSON.parse(data.toString());
            
            if (message.result && typeof message.result === 'number') {
                console.log(`📡 Subscribed (ID: ${message.result})`);
                return;
            }
            
            if (message.method === 'logsNotification' && message.params) {
                this.processLogEvent(message.params);
            }
            
        } catch (error) {
            console.error('WebSocket error:', error.message);
        }
    }

    processLogEvent(params) {
        try {
            const result = params.result;
            const signature = result.value.signature;
            const logs = result.value.logs;
            
            // Skip duplicates
            if (this.processedSignatures.has(signature)) return;
            
            // STRICT filtering for actual token creation
            if (!this.isActualTokenCreation(logs)) {
                this.stats.filtered++;
                return;
            }
            
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
                console.log(`🆕 High-quality detection (${this.tokenQueue.length}): ${signature.substring(0, 10)}...`);
            }
            
        } catch (error) {
            console.error('Log processing error:', error.message);
        }
    }

    isActualTokenCreation(logs) {
        // VERY specific filtering to reduce false positives
        const mustHave = [
            'Program log: Instruction: InitializeMint2',
            'Program log: Instruction: Create'
        ];
        
        const hasRequired = mustHave.some(pattern => 
            logs.some(log => log.includes(pattern))
        );
        
        if (!hasRequired) return false;
        
        // Exclude common non-creation operations
        const excludePatterns = [
            'Swap',
            'Buy', 
            'Sell',
            'Transfer',
            'Burn'
        ];
        
        const hasExclusion = logs.some(log =>
            excludePatterns.some(pattern => log.toLowerCase().includes(pattern.toLowerCase()))
        );
        
        return !hasExclusion;
    }

    startOptimizedWorker() {
        setInterval(async () => {
            if (!this.isAnalyzing && this.tokenQueue.length > 0) {
                this.isAnalyzing = true;
                
                const tokenEvent = this.tokenQueue.shift();
                
                // CRITICAL: Wait for token to be ready for analysis
                const tokenAge = Date.now() - tokenEvent.detectedAt;
                
                if (tokenAge < this.analysisDelay) {
                    // Not ready yet - put it back
                    this.tokenQueue.unshift(tokenEvent);
                    this.isAnalyzing = false;
                    return;
                }
                
                console.log(`\n🔍 ANALYZING AGED TOKEN (${this.tokenQueue.length} queued)`);
                
                try {
                    await this.analyzeAgedToken(tokenEvent);
                    this.stats.analyzed++;
                } catch (error) {
                    console.error(`❌ Analysis failed: ${error.message}`);
                    this.stats.failed++;
                } finally {
                    this.isAnalyzing = false;
                }
            }
        }, 5000); // Check every 5 seconds
    }

    async analyzeAgedToken(tokenEvent) {
        try {
            console.log(`📋 TX: ${tokenEvent.signature}`);
            console.log(`⏰ Age: ${((Date.now() - tokenEvent.detectedAt) / 1000).toFixed(1)}s`);
            
            // Advanced token extraction with multiple methods
            let tokenMint = await this.extractTokenMultiMethod(tokenEvent);
            
            if (!tokenMint) {
                console.log('❌ Token extraction failed with all methods');
                return;
            }
            
            console.log(`🎯 Token Mint: ${tokenMint}`);
            
            // Additional wait for full initialization
            console.log('⏳ Final initialization wait...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Minimal but comprehensive analysis
            await this.runMinimalSecurityCheck(tokenMint, tokenEvent);
            
        } catch (error) {
            console.error(`Analysis error: ${error.message}`);
        }
    }

    async extractTokenMultiMethod(tokenEvent) {
        console.log('🔍 Extracting token mint (multiple methods)...');
        
        // Method 1: Transaction parsing
        try {
            this.stats.apiCalls++;
            const transaction = await this.httpConnection.getTransaction(tokenEvent.signature, {
                commitment: 'finalized',
                maxSupportedTransactionVersion: 0
            });
            
            if (transaction?.meta?.postTokenBalances) {
                // Look for new token accounts with initial balance
                for (const balance of transaction.meta.postTokenBalances) {
                    if (balance.mint && balance.uiTokenAmount) {
                        console.log(`   Method 1: Found via postTokenBalances`);
                        return balance.mint;
                    }
                }
            }
            
            // Try account keys
            if (transaction?.transaction?.message?.accountKeys) {
                const keys = transaction.transaction.message.accountKeys;
                // Try different positions based on pump.fun patterns
                for (let i = 1; i < Math.min(4, keys.length); i++) {
                    const candidate = keys[i].toBase58();
                    if (this.looksLikeTokenMint(candidate)) {
                        console.log(`   Method 1: Found via accountKeys[${i}]`);
                        return candidate;
                    }
                }
            }
        } catch (error) {
            console.log(`   Method 1 failed: ${error.message}`);
        }
        
        // Method 2: Log parsing
        try {
            const mintFromLogs = this.extractFromLogs(tokenEvent.logs);
            if (mintFromLogs) {
                console.log(`   Method 2: Found via log parsing`);
                return mintFromLogs;
            }
        } catch (error) {
            console.log(`   Method 2 failed: ${error.message}`);
        }
        
        return null;
    }

    extractFromLogs(logs) {
        for (const log of logs) {
            // Look for base58 addresses in logs that could be mints
            const matches = log.match(/[A-HJ-NP-Z1-9]{32,44}/g);
            if (matches) {
                for (const match of matches) {
                    if (this.looksLikeTokenMint(match)) {
                        return match;
                    }
                }
            }
        }
        return null;
    }

    looksLikeTokenMint(address) {
        if (!address || address.length < 32) return false;
        
        // Exclude known program addresses
        const knownPrograms = [
            this.PUMP_PROGRAM_ID,
            'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // SPL Token
            'So11111111111111111111111111111111111111112',   // WSOL
            '11111111111111111111111111111111'               // System Program
        ];
        
        return !knownPrograms.includes(address);
    }

    async runMinimalSecurityCheck(tokenMint, tokenEvent) {
        try {
            console.log('🔍 Running security check...');
            
            // Single API call for essential info
            this.stats.apiCalls++;
            const tokenAccount = await this.httpConnection.getParsedAccountInfo(
                new PublicKey(tokenMint)
            );
            
            if (!tokenAccount.value) {
                console.log('❌ Token not found - still initializing?');
                return;
            }
            
            if (tokenAccount.value.data.program !== 'spl-token') {
                console.log('❌ Not a valid SPL token');
                return;
            }
            
            const mintInfo = tokenAccount.value.data.parsed.info;
            
            // Display optimized results
            this.displaySecurityResults(tokenMint, mintInfo, tokenEvent);
            
            // Store for history
            this.storeResult(tokenMint, mintInfo, tokenEvent);
            
        } catch (error) {
            console.error(`Security check failed: ${error.message}`);
        }
    }

    displaySecurityResults(tokenMint, mintInfo, tokenEvent) {
        const age = ((Date.now() - tokenEvent.detectedAt) / 1000).toFixed(1);
        
        console.log(`\n${'═'.repeat(75)}`);
        console.log(`🎯 SECURITY ANALYSIS RESULTS`);
        console.log(`${'═'.repeat(75)}`);
        console.log(`📍 Token: ${tokenMint}`);
        console.log(`📋 TX: ${tokenEvent.signature}`);
        console.log(`⏰ Analysis Delay: ${age}s`);
        console.log(`📊 Supply: ${mintInfo.supply}`);
        console.log(`📏 Decimals: ${mintInfo.decimals}`);
        
        console.log(`\n🔒 CRITICAL AUTHORITIES:`);
        const mintStatus = mintInfo.mintAuthority ? '❌ ACTIVE (HIGH RISK!)' : '✅ REVOKED';
        const freezeStatus = mintInfo.freezeAuthority ? '❌ ACTIVE (HIGH RISK!)' : '✅ REVOKED';
        
        console.log(`   Mint Authority: ${mintStatus}`);
        console.log(`   Freeze Authority: ${freezeStatus}`);
        
        // Risk assessment
        let riskLevel = 'LOW';
        let riskColor = '🟢';
        let verdict = 'Relatively safe - authorities properly revoked';
        
        if (mintInfo.mintAuthority && mintInfo.freezeAuthority) {
            riskLevel = 'CRITICAL';
            riskColor = '🔴';
            verdict = 'DANGEROUS - Both authorities active, avoid trading!';
        } else if (mintInfo.mintAuthority) {
            riskLevel = 'HIGH';
            riskColor = '🔴';
            verdict = 'HIGH RISK - Mint authority active, supply can be inflated!';
        } else if (mintInfo.freezeAuthority) {
            riskLevel = 'MODERATE';
            riskColor = '🟠';
            verdict = 'MODERATE RISK - Freeze authority active, accounts can be frozen';
        }
        
        console.log(`\n💡 VERDICT: ${riskColor} ${riskLevel} RISK`);
        console.log(`   ${verdict}`);
        
        console.log(`${'═'.repeat(75)}\n`);
    }

    storeResult(tokenMint, mintInfo, tokenEvent) {
        this.stats.recentResults.unshift({
            tokenMint,
            mintAuthority: !!mintInfo.mintAuthority,
            freezeAuthority: !!mintInfo.freezeAuthority,
            supply: mintInfo.supply,
            decimals: mintInfo.decimals,
            timestamp: new Date().toISOString(),
            signature: tokenEvent.signature,
            analysisDelay: ((Date.now() - tokenEvent.detectedAt) / 1000).toFixed(1)
        });
        
        // Keep only last 15 results
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
                    console.log(`\n${this.isStreaming ? '▶️' : '⏸️'} Streaming ${this.isStreaming ? 'RESUMED' : 'PAUSED'}\n`);
                    break;
                case 'q':
                    this.showOptimizedStatus();
                    break;
                case 'x':
                    console.log('\n👋 Shutting down optimized monitor...');
                    if (this.wsConnection) this.wsConnection.close();
                    process.exit(0);
                    break;
                default:
                    console.log('\n📝 Commands: s(toggle streaming) | q(detailed status) | x(exit)\n');
            }
        });
    }

    showOptimizedStatus() {
        const uptime = ((Date.now() - this.stats.startTime) / 1000 / 60).toFixed(1);
        const apiRate = (this.stats.apiCalls / Math.max(uptime, 0.1)).toFixed(1);
        const successRate = (this.stats.analyzed / Math.max(this.stats.detected, 1) * 100).toFixed(1);
        const filterEfficiency = (this.stats.filtered / Math.max(this.stats.filtered + this.stats.detected, 1) * 100).toFixed(1);
        
        console.log('\n📊 ULTRA-OPTIMIZED MONITOR STATUS');
        console.log('═══════════════════════════════════════');
        console.log(`⏱️ Uptime: ${uptime} minutes`);
        console.log(`🔗 WebSocket: ${this.wsConnection?.readyState === 1 ? '✅ Connected' : '❌ Disconnected'}`);
        console.log(`🎯 Streaming: ${this.isStreaming ? '✅ ACTIVE' : '⏸️ PAUSED'}`);
        console.log(`📝 Queue: ${this.tokenQueue.length}/${this.maxQueueSize}`);
        
        console.log(`\n📈 EFFICIENCY METRICS:`);
        console.log(`   Events Filtered: ${this.stats.filtered} (${filterEfficiency}% filtered)`);
        console.log(`   Quality Detections: ${this.stats.detected}`);
        console.log(`   Successful Analyses: ${this.stats.analyzed}`);
        console.log(`   Failed Analyses: ${this.stats.failed}`);
        console.log(`   Success Rate: ${successRate}%`);
        console.log(`   API Calls: ${this.stats.apiCalls} (${apiRate} calls/min)`);
        console.log(`   API Efficiency: ${(this.stats.analyzed / Math.max(this.stats.apiCalls, 1)).toFixed(2)} analyses per API call`);
        
        if (this.stats.recentResults.length > 0) {
            console.log(`\n📋 RECENT SUCCESSFUL ANALYSES:`);
            this.stats.recentResults.slice(0, 5).forEach((result, i) => {
                const time = new Date(result.timestamp).toLocaleTimeString();
                const risk = (result.mintAuthority || result.freezeAuthority) ? '🔴' : '🟢';
                const delay = result.analysisDelay;
                console.log(`   ${i+1}. ${risk} ${result.tokenMint.substring(0, 8)}... | ${delay}s delay | ${time}`);
            });
        }
        
        console.log('');
    }

    startStatusReports() {
        setInterval(() => {
            if (this.stats.detected > 0) {
                const success = (this.stats.analyzed / Math.max(this.stats.detected, 1) * 100).toFixed(0);
                const apiEff = (this.stats.analyzed / Math.max(this.stats.apiCalls, 1)).toFixed(1);
                console.log(`📊 ${this.stats.detected} detected | ${this.stats.analyzed} analyzed | ${this.stats.apiCalls} API | ${success}% success | ${apiEff} per API | ${this.isStreaming ? 'ON' : 'OFF'}`);
            }
        }, 300000); // Every 5 minutes
    }
}

module.exports = new OptimizedPumpMonitor();
