// src/services/enhancedPumpFunMonitor.js - QUEUE-BASED SYSTEM
const { Connection, PublicKey } = require('@solana/web3.js');
const EventEmitter = require('events');

class EnhancedPumpFunMonitor extends EventEmitter {
    constructor() {
        super();
        this.PUMP_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
        
        const rpcUrl = process.env.SOLANA_RPC_HTTP && process.env.SOLANA_RPC_HTTP !== 'undefined' 
            ? process.env.SOLANA_RPC_HTTP 
            : 'https://api.mainnet-beta.solana.com';
            
        this.connection = new Connection(rpcUrl, 'confirmed');
        
        // Queue system
        this.tokenQueue = [];
        this.isAnalyzing = false;
        this.isStreaming = true;
        this.processedSignatures = new Set(); // Prevent duplicates
        this.maxQueueSize = 100;
        
        // Statistics
        this.stats = {
            detected: 0,
            queued: 0,
            analyzed: 0,
            skipped: 0,
            startTime: Date.now()
        };
        
        console.log(`Enhanced Monitor initialized with RPC: ${rpcUrl}`);
    }

    async startMonitoring() {
        console.log('\n🚀 Starting Enhanced Pump.fun Monitor with Queue System');
        console.log('═══════════════════════════════════════════════════════');
        console.log('📝 Controls:');
        console.log('   Press "s" + Enter: Toggle streaming on/off');
        console.log('   Press "q" + Enter: View queue status');  
        console.log('   Press "x" + Enter: Exit monitor');
        console.log('═══════════════════════════════════════════════════════\n');
        
        try {
            // Start monitoring logs
            const subscriptionId = this.connection.onLogs(
                new PublicKey(this.PUMP_PROGRAM_ID),
                (logs, context) => {
                    this.handlePumpFunLog(logs, context);
                },
                'confirmed'
            );
            
            // Start analysis worker
            this.startAnalysisWorker();
            
            // Setup keyboard controls
            this.setupKeyboardControls();
            
            // Status updates every 30 seconds
            this.startStatusUpdates();
            
            console.log(`✅ Monitoring active with subscription ID: ${subscriptionId}`);
            console.log('🎯 Waiting for new pump.fun tokens...\n');
            
            return subscriptionId;
            
        } catch (error) {
            console.error('❌ Failed to start monitoring:', error.message);
            throw error;
        }
    }

    handlePumpFunLog(logs, context) {
        if (!this.isStreaming) return; // Skip if streaming is paused
        
        try {
            // Prevent duplicate processing
            if (this.processedSignatures.has(logs.signature)) {
                return;
            }
            
            // Look for token creation patterns
            const hasTokenCreation = logs.logs.some(log => 
                log.includes('Program log: Instruction: InitializeMint2') ||
                log.includes('InitializeMint2') ||
                log.includes('CreateToken') ||
                (log.includes('create') && log.includes('mint'))
            );

            if (hasTokenCreation) {
                this.processedSignatures.add(logs.signature);
                this.stats.detected++;
                
                const tokenEvent = {
                    signature: logs.signature,
                    slot: context.slot,
                    timestamp: new Date().toISOString(),
                    accounts: logs.accounts || [],
                    detectedAt: Date.now()
                };
                
                // Add to queue if not full
                if (this.tokenQueue.length < this.maxQueueSize) {
                    this.tokenQueue.push(tokenEvent);
                    this.stats.queued++;
                    
                    console.log(`🆕 Token queued: ${logs.signature.substring(0, 8)}... (Queue: ${this.tokenQueue.length})`);
                } else {
                    this.stats.skipped++;
                    console.log(`⚠️  Queue full! Skipped: ${logs.signature.substring(0, 8)}...`);
                }
            }
        } catch (error) {
            console.error('Error processing pump.fun log:', error.message);
        }
    }

    startAnalysisWorker() {
        setInterval(async () => {
            if (!this.isAnalyzing && this.tokenQueue.length > 0) {
                this.isAnalyzing = true;
                
                const tokenEvent = this.tokenQueue.shift();
                console.log(`\n🔍 Analyzing token from queue... (${this.tokenQueue.length} remaining)`);
                
                try {
                    // Emit event for analysis
                    this.emit('newToken', tokenEvent);
                    this.stats.analyzed++;
                    
                    // Add delay to prevent overwhelming the system
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    
                } catch (error) {
                    console.error(`❌ Analysis failed for ${tokenEvent.signature}:`, error.message);
                } finally {
                    this.isAnalyzing = false;
                }
            }
        }, 1000); // Check queue every second
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
                    this.showQueueStatus();
                    break;
                case 'x':
                    console.log('\n👋 Shutting down monitor...');
                    process.exit(0);
                    break;
                default:
                    console.log('\n❓ Unknown command. Use: s (toggle streaming), q (queue status), x (exit)\n');
            }
        });
    }

    toggleStreaming() {
        this.isStreaming = !this.isStreaming;
        const status = this.isStreaming ? 'RESUMED' : 'PAUSED';
        const emoji = this.isStreaming ? '▶️' : '⏸️';
        
        console.log(`\n${emoji} Streaming ${status}`);
        console.log(`   Analysis will ${this.isStreaming ? 'continue for new detections' : 'continue for queued tokens only'}\n`);
    }

    showQueueStatus() {
        const uptime = ((Date.now() - this.stats.startTime) / 1000 / 60).toFixed(1);
        
        console.log('\n📊 MONITOR STATUS');
        console.log('═════════════════');
        console.log(`⏱️  Uptime: ${uptime} minutes`);
        console.log(`🎯 Streaming: ${this.isStreaming ? '✅ ACTIVE' : '⏸️ PAUSED'}`);
        console.log(`🔍 Analyzing: ${this.isAnalyzing ? '✅ BUSY' : '⏳ IDLE'}`);
        console.log(`📝 Queue Size: ${this.tokenQueue.length}/${this.maxQueueSize}`);
        console.log(`\n📈 STATISTICS:`);
        console.log(`   Detected: ${this.stats.detected}`);
        console.log(`   Queued: ${this.stats.queued}`);
        console.log(`   Analyzed: ${this.stats.analyzed}`);
        console.log(`   Skipped: ${this.stats.skipped}`);
        console.log('');
    }

    startStatusUpdates() {
        setInterval(() => {
            if (this.tokenQueue.length > 0 || this.stats.detected > 0) {
                console.log(`📊 Status: ${this.stats.detected} detected | ${this.tokenQueue.length} queued | ${this.stats.analyzed} analyzed | Streaming: ${this.isStreaming ? 'ON' : 'OFF'}`);
            }
        }, 30000); // Every 30 seconds
    }
}

module.exports = new EnhancedPumpFunMonitor();
