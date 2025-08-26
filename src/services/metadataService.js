
// src/services/metadataService.js
const axios = require('axios');
const { Connection, PublicKey } = require('@solana/web3.js');
const { METADATA_APIS } = require('../config/constants');
const solanaService = require('./solanaService');
const rateLimiter = require('../config/rateLimit');
const logger = require('../utils/logger');

class MetadataService {
  constructor() {
    this.metaplexProgramId = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';
  }

  async getTokenMetadata(mintAddress) {
    try {
      logger.debug(`Fetching metadata for token: ${mintAddress}`);

      // Try to get Metaplex metadata first
      const metaplexMetadata = await this.getMetaplexMetadata(mintAddress);
      if (metaplexMetadata) {
        logger.debug('Retrieved Metaplex metadata');
        return metaplexMetadata;
      }

      // Fallback to basic token info
      logger.debug('Metaplex metadata not found, using basic token info');
      const basicInfo = await solanaService.getTokenMintInfo(mintAddress);

      return {
        mint: mintAddress,
        name: `Token ${mintAddress.substring(0, 8)}...`,
        symbol: 'UNKNOWN',
        description: null,
        image: null,
        uri: null,
        creators: [],
        ...basicInfo,
        source: 'BASIC'
      };

    } catch (error) {
      logger.error(`Failed to get metadata for ${mintAddress}:`, error.message);
      throw error;
    }
  }

  async getMetaplexMetadata(mintAddress) {
    try {
      // Calculate the metadata PDA (Program Derived Address)
      const metadataPDA = await this.findMetadataPDA(mintAddress);

      // Get the metadata account
      const accountInfo = await solanaService.getAccountInfo(metadataPDA);
      if (!accountInfo) {
        logger.debug(`No metadata account found for ${mintAddress}`);
        return null;
      }

      // Decode the metadata
      const metadata = this.decodeMetadata(accountInfo.data);

      // If there's an off-chain URI, fetch that data too
      let offChainMetadata = null;
      if (metadata.uri && metadata.uri.trim() !== '') {
        try {
          offChainMetadata = await this.fetchOffChainMetadata(metadata.uri);
        } catch (error) {
          logger.warn(`Failed to fetch off-chain metadata from ${metadata.uri}:`, error.message);
        }
      }

      return {
        mint: mintAddress,
        ...metadata,
        ...offChainMetadata,
        source: 'METAPLEX'
      };

    } catch (error) {
      logger.debug(`Failed to get Metaplex metadata for ${mintAddress}:`, error.message);
      return null;
    }
  }

  async findMetadataPDA(mintAddress) {
    const TOKEN_METADATA_PROGRAM = new PublicKey(this.metaplexProgramId);
    const mint = new PublicKey(mintAddress);

    const [metadataPDA] = await PublicKey.findProgramAddress(
      [
        Buffer.from('metadata'),
        TOKEN_METADATA_PROGRAM.toBuffer(),
        mint.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM
    );

    return metadataPDA.toBase58();
  }

  decodeMetadata(data) {
    try {
      // This is a simplified decoder - in production you'd want to use the full Metaplex SDK
      let offset = 1; // Skip the first byte (account discriminator)

      // Read update authority (32 bytes)
      const updateAuthority = new PublicKey(data.slice(offset, offset + 32)).toBase58();
      offset += 32;

      // Read mint (32 bytes)  
      const mint = new PublicKey(data.slice(offset, offset + 32)).toBase58();
      offset += 32;

      // Read name length and name
      const nameLength = data.readUInt32LE(offset);
      offset += 4;
      const name = data.slice(offset, offset + nameLength).toString('utf8').replace(/\0/g, '');
      offset += nameLength;

      // Read symbol length and symbol
      const symbolLength = data.readUInt32LE(offset);
      offset += 4;
      const symbol = data.slice(offset, offset + symbolLength).toString('utf8').replace(/\0/g, '');
      offset += symbolLength;

      // Read URI length and URI
      const uriLength = data.readUInt32LE(offset);
      offset += 4;
      const uri = data.slice(offset, offset + uriLength).toString('utf8').replace(/\0/g, '');
      offset += uriLength;

      // Read seller fee basis points
      const sellerFeeBasisPoints = data.readUInt16LE(offset);
      offset += 2;

      // Read creators (simplified)
      const hasCreators = data[offset] === 1;
      offset += 1;

      const creators = [];
      if (hasCreators) {
        const creatorsCount = data.readUInt32LE(offset);
        offset += 4;

        for (let i = 0; i < creatorsCount; i++) {
          const address = new PublicKey(data.slice(offset, offset + 32)).toBase58();
          offset += 32;
          const verified = data[offset] === 1;
          offset += 1;
          const share = data[offset];
          offset += 1;

          creators.push({ address, verified, share });
        }
      }

      return {
        updateAuthority,
        mint,
        name: name.trim(),
        symbol: symbol.trim(),
        uri: uri.trim(),
        sellerFeeBasisPoints,
        creators
      };

    } catch (error) {
      logger.error('Failed to decode metadata:', error.message);
      throw new Error('Invalid metadata format');
    }
  }

  async fetchOffChainMetadata(uri) {
    try {
      return await rateLimiter.executeRequest(async () => {
        // Handle IPFS URIs
        let fetchUrl = uri;
        if (uri.startsWith('ipfs://')) {
          fetchUrl = uri.replace('ipfs://', 'https://ipfs.io/ipfs/');
        }

        const response = await axios.get(fetchUrl, { 
          timeout: 10000,
          headers: {
            'User-Agent': 'Solana-Token-Validator/1.0'
          }
        });

        return {
          description: response.data.description,
          image: response.data.image,
          external_url: response.data.external_url,
          attributes: response.data.attributes || [],
          properties: response.data.properties || {}
        };
      }, 1);

    } catch (error) {
      logger.warn(`Failed to fetch off-chain metadata from ${uri}:`, error.message);
      return {
        description: null,
        image: null,
        external_url: null,
        attributes: [],
        properties: {}
      };
    }
  }

  async validateMetadata(metadata) {
    const issues = [];
    const warnings = [];

    // Check for missing essential fields
    if (!metadata.name || metadata.name.trim() === '') {
      issues.push('Missing token name');
    }

    if (!metadata.symbol || metadata.symbol.trim() === '') {
      issues.push('Missing token symbol');
    }

    // Check for suspicious patterns
    if (metadata.name && metadata.name.toLowerCase().includes('test')) {
      warnings.push('Token name contains "test"');
    }

    if (metadata.symbol && metadata.symbol.length > 10) {
      warnings.push('Symbol is unusually long');
    }

    // Check URI accessibility
    if (metadata.uri && metadata.uri.trim() !== '') {
      try {
        await this.fetchOffChainMetadata(metadata.uri);
      } catch (error) {
        warnings.push('Off-chain metadata URI is not accessible');
      }
    } else {
      warnings.push('No off-chain metadata URI provided');
    }

    // Check for creator verification
    if (metadata.creators && metadata.creators.length > 0) {
      const verifiedCreators = metadata.creators.filter(c => c.verified);
      if (verifiedCreators.length === 0) {
        warnings.push('No verified creators found');
      }
    } else {
      warnings.push('No creators specified');
    }

    return {
      isValid: issues.length === 0,
      issues,
      warnings,
      score: this.calculateMetadataScore(metadata, issues, warnings)
    };
  }

  calculateMetadataScore(metadata, issues, warnings) {
    let score = 100;

    // Deduct points for issues
    score -= issues.length * 20;

    // Deduct points for warnings
    score -= warnings.length * 5;

    // Bonus points for good practices
    if (metadata.description && metadata.description.length > 50) {
      score += 10;
    }

    if (metadata.image && metadata.image.startsWith('http')) {
      score += 5;
    }

    if (metadata.creators && metadata.creators.some(c => c.verified)) {
      score += 15;
    }

    if (metadata.external_url && metadata.external_url.startsWith('http')) {
      score += 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  async getBatchMetadata(mintAddresses) {
    logger.info(`Fetching metadata for ${mintAddresses.length} tokens`);

    const results = await solanaService.processBatch(
      mintAddresses,
      async (mintAddress) => {
        try {
          const metadata = await this.getTokenMetadata(mintAddress);
          const validation = await this.validateMetadata(metadata);

          return {
            mintAddress,
            metadata,
            validation,
            success: true
          };
        } catch (error) {
          return {
            mintAddress,
            metadata: null,
            validation: null,
            success: false,
            error: error.message
          };
        }
      },
      5 // Process 5 at a time to avoid overwhelming
    );

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    logger.info(`Metadata fetch completed: ${successful.length} successful, ${failed.length} failed`);

    return {
      successful,
      failed,
      totalProcessed: results.length
    };
  }
}

module.exports = new MetadataService();
