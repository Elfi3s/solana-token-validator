const axios = require('axios');

class SocialAnalyzer {
    constructor() {
        this.suspiciousPatterns = [
            /(guaranteed|moon|100x|\$\$\$)/i,
            /(rug\s*pull|honeypot|scam)/i,
            /(pump\s*and\s*dump|p&d)/i
        ];
    }

    async analyzeSocialPresence(metadata) {
        const analysis = {
            hasWebsite: false,
            hasTwitter: false,
            hasTelegram: false,
            hasDiscord: false,
            suspiciousContent: [],
            verificationStatus: 'UNVERIFIED',
            riskScore: 50
        };

        if (!metadata || !metadata.uri) {
            analysis.riskScore = 80;
            analysis.warnings = ['NO_METADATA_AVAILABLE'];
            return analysis;
        }

        try {
            // Fetch off-chain metadata
            const response = await axios.get(metadata.uri, { timeout: 10000 });
            const data = response.data;

            // Check for social links
            this.checkSocialLinks(data, analysis);

            // Analyze content for suspicious patterns
            this.analyzeSuspiciousContent(data, analysis);

            // Calculate risk score
            analysis.riskScore = this.calculateSocialRiskScore(analysis);

        } catch (error) {
            analysis.riskScore = 70;
            analysis.warnings = ['METADATA_FETCH_FAILED'];
        }

        return analysis;
    }

    checkSocialLinks(data, analysis) {
        const content = JSON.stringify(data).toLowerCase();

        analysis.hasWebsite = /https?:\/\/[\w\-\.]+\.\w+/.test(content);
        analysis.hasTwitter = /twitter\.com|x\.com/.test(content);
        analysis.hasTelegram = /t\.me|telegram\.me/.test(content);
        analysis.hasDiscord = /discord\.gg|discord\.com/.test(content);
    }

    analyzeSuspiciousContent(data, analysis) {
        const textContent = [
            data.name || '',
            data.description || '',
            data.symbol || ''
        ].join(' ').toLowerCase();

        for (const pattern of this.suspiciousPatterns) {
            if (pattern.test(textContent)) {
                analysis.suspiciousContent.push(pattern.source);
            }
        }
    }

    calculateSocialRiskScore(analysis) {
        let score = 50; // Base score

        // Reduce risk for legitimate social presence
        if (analysis.hasWebsite) score -= 10;
        if (analysis.hasTwitter) score -= 10;
        if (analysis.hasTelegram) score -= 5;
        if (analysis.hasDiscord) score -= 5;

        // Increase risk for suspicious content
        score += analysis.suspiciousContent.length * 20;

        return Math.max(0, Math.min(100, score));
    }
}

module.exports = new SocialAnalyzer();