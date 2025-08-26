// src/services/pumpFunMonitor.js - FIXED VERSION
const { Connection, PublicKey } = require('@solana/web3.js');

class PumpFunMonitor {
    constructor() {
        this.PUMP_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
        
        // Use HTTP endpoint - Connection handles WebSocket internally  
        const rpcUrl = process.env.SOLANA_RPC_HTTP && process.env.SOLANA_RPC_HTTP !== 'undefined' 
            ? process.env.SOLANA_RPC_HTTP 
            : 'https://api.mainnet-beta.solana.com';
            
        console.log(`PumpFun Monitor using RPC: ${rpcUrl}`);
        this.connection = new Connection(rpcUrl, 'confirmed');
        this.subscribers = new Set();
        this.isMonitoring = false;
    }

    async startMonitoring() {
        console.log('🚀 Starting pump.fun monitoring...');
        
        try {
            const subscriptionId = this.connection.onLogs(
                new PublicKey(this.PUMP_PROGRAM_ID),
                (logs, context) => {
                    this.handlePumpFunLog(logs, context);
                },
                'confirmed'
            );
            
            this.isMonitoring = true;
            console.log(`✅ Monitoring active with subscription ID: ${subscriptionId}`);
            return subscriptionId;
            
        } catch (error) {
            console.error('❌ Failed to start pump.fun monitoring:', error.message);
            throw error;
        }
    }

    handlePumpFunLog(logs, context) {
        try {
            const hasTokenCreation = logs.logs.some(log => 
                log.includes('Program log: Instruction: InitializeMint2') ||
                log.includes('InitializeMint2') ||
                log.includes('CreateToken')
            );

            if (hasTokenCreation) {
                const event = {
                    type: 'NEW_PUMP_TOKEN',
                    signature: logs.signature,
                    slot: context.slot,
                    accountKeys: logs.accounts || [],
                    timestamp: new Date().toISOString()
                };
                
                console.log(`🆕 New pump.fun token detected: ${event.signature}`);
                this.notifySubscribers(event);
            }
        } catch (error) {
            console.error('Error handling pump.fun log:', error.message);
        }
    }

    subscribe(callback) {
        this.subscribers.add(callback);
    }

    notifySubscribers(event) {
        this.subscribers.forEach(callback => {
            try {
                callback(event);
            } catch (error) {
                console.error('Subscriber callback error:', error.message);
            }
        });
    }
}

module.exports = new PumpFunMonitor();
