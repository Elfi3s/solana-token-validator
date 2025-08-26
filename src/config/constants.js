
// src/config/constants.js
require('dotenv').config();

module.exports = {
  // RPC Configuration
  RPC: {
    HTTP_ENDPOINT: process.env.SOLANA_RPC_HTTP,
    WSS_ENDPOINT: process.env.SOLANA_RPC_WSS,
    COMMITMENT: 'confirmed'
  },

  // Rate Limiting
  RATE_LIMITS: {
    MAX_REQUESTS_PER_SECOND: parseInt(process.env.MAX_REQUESTS_PER_SECOND) || 15,
    MAX_TOTAL_CREDITS: parseInt(process.env.MAX_TOTAL_CREDITS) || 10000000,
    BATCH_SIZE: 10,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000
  },

  // Token Programs
  PROGRAMS: {
    TOKEN_PROGRAM: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    TOKEN_2022_PROGRAM: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
    ASSOCIATED_TOKEN_PROGRAM: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
    SYSTEM_PROGRAM: '11111111111111111111111111111111'
  },

  // DEX Programs
  DEX_PROGRAMS: {
    RAYDIUM_V4: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
    ORCA: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    JUPITER: 'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB',
    METEORA: 'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB'
  },

  // Security Thresholds
  SECURITY: {
    // Holder concentration thresholds
    MAX_HOLDER_PERCENTAGE: 50, // Max % for single holder
    TOP_10_HOLDER_THRESHOLD: 80, // Top 10 holders max %
    MIN_HOLDER_COUNT: 100, // Minimum unique holders

    // Liquidity thresholds
    MIN_LIQUIDITY_USD: 10000, // Minimum liquidity in USD
    MIN_LIQUIDITY_LOCK_DAYS: 30, // Minimum lock period in days

    // Volume thresholds
    MIN_24H_VOLUME_USD: 1000, // Minimum 24h volume
    VOLUME_LIQUIDITY_RATIO: 0.1, // Min volume to liquidity ratio

    // Transaction patterns
    MAX_SNIPER_PERCENTAGE: 20, // Max % of supply from snipers
    SUSPICIOUS_TX_THRESHOLD: 10 // Threshold for suspicious patterns
  },

  // Risk Scores
  RISK_WEIGHTS: {
    MINT_AUTHORITY: 25,
    FREEZE_AUTHORITY: 20,
    HOLDER_CONCENTRATION: 15,
    LIQUIDITY_LOCK: 15,
    HONEYPOT: 25
  },

  JUPITER: {
    BASE_URL: 'https://api.jup.ag/price/v2', // Updated endpoint
    QUOTE_URL: 'https://quote-api.jup.ag/v6',
    SWAP_URL: 'https://quote-api.jup.ag/v6',
    PRICE_V1: 'https://price.jup.ag/v4' // Legacy fallback
  },

  // Common token addresses
  TOKENS: {
    SOL: 'So11111111111111111111111111111111111111112',
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    WSOL: 'So11111111111111111111111111111111111111112'
  },

  // API Endpoints
  METADATA_APIS: {
    HELIUS: 'https://api.helius.xyz',
    METAPLEX: 'https://api.metaplex.com'
  }
};
