import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

export interface StorageConfig {
    useS3: boolean;
    s3Config?: {
        bucket: string;
        region: string;
        accessKeyId: string;
        secretAccessKey: string;
    };
}

export class AudioStorageService {
    private uploadDir: string;
    private config: StorageConfig;

    constructor(config?: StorageConfig) {
        this.config = config || { useS3: false };
        this.uploadDir = path.join(process.cwd(), 'uploads');
    }

    private async ensureDirectoryExists(dirPath: string): Promise<void> {
        if (!existsSync(dirPath)) {
            await fs.mkdir(dirPath, { recursive: true });
        }
    }

    private getUserUploadDir(userId: string): string {
        return path.join(this.uploadDir, userId);
    }

    private getFilePath(userId: string, filename: string): string {
        return path.join(this.getUserUploadDir(userId), filename);
    }

    /**
     * Store a file to local filesystem or S3
     * @param file - File buffer
     * @param filename - Original filename
     * @param userId - User ID for organizing files
     * @returns Relative path to stored file
     */
    async storeFile(file: Buffer, filename: string, userId: string): Promise<string> {
        if (this.config.useS3) {
            // S3 implementation for production
            throw new Error('S3 storage not yet implemented');
        }

        // Local filesystem storage
        const userUploadDir = this.getUserUploadDir(userId);
        await this.ensureDirectoryExists(userUploadDir);

        // Generate unique filename to avoid conflicts
        const timestamp = Date.now();
        const ext = path.extname(filename);
        const baseName = path.basename(filename, ext);
        const uniqueFilename = `${baseName}-${timestamp}${ext}`;
        const filePath = this.getFilePath(userId, uniqueFilename);

        // Write file
        await fs.writeFile(filePath, file);

        // Return relative path for database storage
        return `${userId}/${uniqueFilename}`;
    }

    /**
     * Get signed URL for file access
     * For local storage, returns a local URL path
     * For S3, would return a pre-signed URL
     * @param relativePath - Relative path from uploads directory
     * @returns URL to access the file
     */
    async getSignedUrl(relativePath: string): Promise<string> {
        if (this.config.useS3) {
            // S3 implementation for production
            throw new Error('S3 storage not yet implemented');
        }

        // For local storage, return a path that can be served by the API
        return `/api/audio/stream/${relativePath}`;
    }

    /**
     * Delete a file from storage
     * @param relativePath - Relative path from uploads directory
     */
    async deleteFile(relativePath: string): Promise<void> {
        if (this.config.useS3) {
            // S3 implementation for production
            throw new Error('S3 storage not yet implemented');
        }

        const filePath = path.join(this.uploadDir, relativePath);

        try {
            await fs.unlink(filePath);
        } catch (error) {
            // Log error but don't throw - file might not exist
            console.error(`Error deleting file ${filePath}:`, error);
        }
    }

    /**
     * Get the full file path for local storage
     * @param relativePath - Relative path from uploads directory
     * @returns Full file system path
     */
    getFullFilePath(relativePath: string): string {
        return path.join(this.uploadDir, relativePath);
    }
}

// Export singleton instance
export const audioStorageService = new AudioStorageService();
