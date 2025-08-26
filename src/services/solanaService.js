// src/services/solanaService.js - SIMPLE VERSION THAT WORKS
const { Connection, PublicKey } = require('@solana/web3.js');
const { RPC } = require('../config/constants');
const logger = require('../utils/logger');

class SolanaService {
  constructor() {
    // Use public RPC if QuickNode fails
    const rpcUrl = process.env.SOLANA_RPC_HTTP && process.env.SOLANA_RPC_HTTP !== 'undefined' 
      ? process.env.SOLANA_RPC_HTTP 
      : 'https://api.mainnet-beta.solana.com';
      
    console.log(`Using RPC: ${rpcUrl}`);
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  async getTokenMintInfo(mintAddress) {
    try {
      console.log(`Getting mint info for: ${mintAddress}`);
      
      const mintPubkey = new PublicKey(mintAddress);
      
      // Use the simple getParsedAccountInfo method
      const accountInfo = await this.connection.getParsedAccountInfo(mintPubkey);
      
      if (!accountInfo.value) {
        throw new Error('Token mint not found');
      }

      if (accountInfo.value.data.program !== 'spl-token') {
        throw new Error('Not a valid token mint');
      }

      const mintInfo = accountInfo.value.data.parsed.info;
      
      return {
        mintAddress: mintAddress,
        supply: mintInfo.supply,
        decimals: mintInfo.decimals,
        mintAuthority: mintInfo.mintAuthority || null,
        freezeAuthority: mintInfo.freezeAuthority || null,
        isInitialized: true
      };
      
    } catch (error) {
      logger.error(`Failed to get mint info for ${mintAddress}:`, error.message);
      throw error;
    }
  }

  async getTokenLargestAccounts(mintAddress, limit = 20) {
    try {
      const mintPubkey = new PublicKey(mintAddress);
      const response = await this.connection.getTokenLargestAccounts(mintPubkey);
      
      return response.value.slice(0, limit).map(account => ({
        address: account.address.toBase58(),
        amount: account.amount,
        uiAmount: account.uiAmount,
        decimals: account.decimals
      }));
      
    } catch (error) {
      logger.error(`Failed to get largest accounts for ${mintAddress}:`, error.message);
      throw error;
    }
  }

  async getTokenSupply(mintAddress) {
    try {
      const mintPubkey = new PublicKey(mintAddress);
      const supply = await this.connection.getTokenSupply(mintPubkey);
      
      return {
        amount: supply.value.amount,
        decimals: supply.value.decimals,
        uiAmount: supply.value.uiAmount,
        uiAmountString: supply.value.uiAmountString
      };
      
    } catch (error) {
      logger.error(`Failed to get token supply for ${mintAddress}:`, error.message);
      throw error;
    }
  }

  async getAccountInfo(pubkey) {
    try {
      const publicKey = new PublicKey(pubkey);
      const accountInfo = await this.connection.getAccountInfo(publicKey);
      
      if (!accountInfo) return null;
      
      return {
        lamports: accountInfo.lamports,
        owner: accountInfo.owner.toBase58(),
        data: accountInfo.data,
        executable: accountInfo.executable,
        rentEpoch: accountInfo.rentEpoch
      };
      
    } catch (error) {
      logger.error(`Failed to get account info for ${pubkey}:`, error.message);
      throw error;
    }
  }

  isValidPublicKey(address) {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = new SolanaService();
