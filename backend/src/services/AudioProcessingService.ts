export interface AudioFormat {
    name: string;
    mimeType: string;
    extension: string;
}

export interface AudioValidationResult {
    valid: boolean;
    format?: AudioFormat;
    error?: string;
}

export interface AudioDurationResult {
    duration: number;
    valid: boolean;
    error?: string;
}

export class AudioProcessingService {
    private readonly MAX_DURATION_SECONDS = 600; // 10 minutes

    // Magic bytes for common audio formats
    private readonly MAGIC_BYTES: Record<string, AudioFormat> = {
        'ID3': { name: 'MP3', mimeType: 'audio/mpeg', extension: '.mp3' },
        'ID3\x03': { name: 'MP3', mimeType: 'audio/mpeg', extension: '.mp3' },
        'ID3\x04': { name: 'MP3', mimeType: 'audio/mpeg', extension: '.mp3' },
        'ID3\x05': { name: 'MP3', mimeType: 'audio/mpeg', extension: '.mp3' },
        '\xFF\xFB': { name: 'MP3', mimeType: 'audio/mpeg', extension: '.mp3' },
        '\xFF\xFA': { name: 'MP3', mimeType: 'audio/mpeg', extension: '.mp3' },
        '\xFF\xF3': { name: 'MP3', mimeType: 'audio/mpeg', extension: '.mp3' },
        '\xFF\xF2': { name: 'MP3', mimeType: 'audio/mpeg', extension: '.mp3' },
        'RIFF': { name: 'WAV', mimeType: 'audio/wav', extension: '.wav' },
        '\x00\x00\x00\x18ftypM4A': { name: 'M4A', mimeType: 'audio/mp4', extension: '.m4a' },
        '\x00\x00\x00\x20ftypM4A': { name: 'M4A', mimeType: 'audio/mp4', extension: '.m4a' },
        '\x1A\x45\xDF\xA3': { name: 'WEBM', mimeType: 'audio/webm', extension: '.webm' },
    };

    /**
     * Validate audio format using magic bytes
     * @param buffer - File buffer
     * @returns Validation result with format info or error
     */
    validateAudioFormat(buffer: Buffer): AudioValidationResult {
        if (!buffer || buffer.length < 4) {
            return {
                valid: false,
                error: 'File is too small to be a valid audio file',
            };
        }

        // Check for each magic byte pattern
        for (const [magicBytes, format] of Object.entries(this.MAGIC_BYTES)) {
            const magicBuffer = Buffer.from(magicBytes, 'binary');

            if (buffer.length >= magicBuffer.length) {
                const fileHeader = buffer.subarray(0, magicBuffer.length);

                if (fileHeader.equals(magicBuffer)) {
                    return {
                        valid: true,
                        format,
                    };
                }
            }
        }

        return {
            valid: false,
            error: 'Unsupported audio format. Supported formats: MP3, WAV, M4A, WEBM',
        };
    }

    /**
     * Extract audio duration from buffer
     * Note: This is a simplified implementation. In production, use a library like music-metadata
     * for accurate duration extraction across all formats.
     * @param buffer - File buffer
     * @returns Duration in seconds
     */
    async extractAudioDuration(buffer: Buffer): Promise<AudioDurationResult> {
        try {
            const formatValidation = this.validateAudioFormat(buffer);

            if (!formatValidation.valid || !formatValidation.format) {
                return {
                    duration: 0,
                    valid: false,
                    error: formatValidation.error || 'Invalid audio format',
                };
            }

            // For a production application, use a library like music-metadata
            // For now, we'll estimate duration based on file size and format
            // This is a rough estimation and should be replaced with proper metadata extraction

            const format = formatValidation.format;
            let estimatedDuration = 0;

            switch (format.name) {
                case 'MP3':
                    // MP3: ~128kbps average, so ~16KB per second
                    estimatedDuration = Math.floor(buffer.length / 16000);
                    break;
                case 'WAV':
                    // WAV: Uncompressed, need to parse header for accurate duration
                    estimatedDuration = this.estimateWavDuration(buffer);
                    break;
                case 'M4A':
                    // M4A: Compressed, ~128kbps average
                    estimatedDuration = Math.floor(buffer.length / 16000);
                    break;
                case 'WEBM':
                    // WEBM: Compressed, ~128kbps average
                    estimatedDuration = Math.floor(buffer.length / 16000);
                    break;
                default:
                    estimatedDuration = Math.floor(buffer.length / 16000);
            }

            // Validate against max duration
            if (estimatedDuration > this.MAX_DURATION_SECONDS) {
                return {
                    duration: estimatedDuration,
                    valid: false,
                    error: `Audio duration exceeds maximum allowed duration of ${this.MAX_DURATION_SECONDS / 60} minutes`,
                };
            }

            return {
                duration: estimatedDuration,
                valid: true,
            };
        } catch (error) {
            return {
                duration: 0,
                valid: false,
                error: 'Failed to extract audio duration',
            };
        }
    }

    /**
     * Estimate WAV duration by parsing the header
     * @param buffer - WAV file buffer
     * @returns Estimated duration in seconds
     */
    private estimateWavDuration(buffer: Buffer): number {
        try {
            // WAV format: RIFF header at 0, WAVE at 8, fmt chunk at 12
            // Sample rate is at bytes 24-27, data size at 40-43
            // Bytes per sample = (bits per sample / 8) * channels

            if (buffer.length < 44) {
                return 0;
            }

            // Read sample rate (little-endian)
            const sampleRate = buffer.readUInt32LE(24);

            // Read bits per sample
            const bitsPerSample = buffer.readUInt16LE(34);

            // Read number of channels
            const channels = buffer.readUInt16LE(22);

            // Read data size (excluding header)
            const dataSize = buffer.readUInt32LE(40);

            if (sampleRate === 0 || bitsPerSample === 0 || channels === 0) {
                return 0;
            }

            const bytesPerSample = (bitsPerSample / 8) * channels;
            const duration = Math.floor(dataSize / (sampleRate * bytesPerSample));

            return duration;
        } catch (error) {
            console.error('Error estimating WAV duration:', error);
            return 0;
        }
    }

    /**
     * Validate audio file (format and duration)
     * @param buffer - File buffer
     * @returns Combined validation result
     */
    async validateAudioFile(buffer: Buffer): Promise<{
        valid: boolean;
        format?: AudioFormat;
        duration?: number;
        error?: string;
    }> {
        const formatResult = this.validateAudioFormat(buffer);

        if (!formatResult.valid) {
            return {
                valid: false,
                error: formatResult.error,
            };
        }

        const durationResult = await this.extractAudioDuration(buffer);

        if (!durationResult.valid) {
            return {
                valid: false,
                error: durationResult.error,
            };
        }

        return {
            valid: true,
            format: formatResult.format,
            duration: durationResult.duration,
        };
    }
}

// Export singleton instance
export const audioProcessingService = new AudioProcessingService();
