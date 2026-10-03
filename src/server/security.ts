import crypto from 'crypto';

export class SecurityLayer {
  /**
   * Generates a SHA-256 checksum for a packet to ensure integrity.
   */
  public static generateChecksum(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Encrypts a premium packet using AES-256-GCM.
   * In a real scenario, the key would be unique per user/session.
   */
  public static encryptPacket(content: string, key: string): { encryptedData: string, iv: string, tag: string } {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);

    let encrypted = cipher.update(content, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      encryptedData: encrypted,
      iv: iv.toString('hex'),
      tag: cipher.getAuthTag().toString('hex'),
    };
  }

  /**
   * Decrypts a premium packet.
   */
  public static decryptPacket(encryptedData: string, key: string, iv: string, tag: string): string {
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
    decipher.setAuthTag(Buffer.from(tag, 'hex'));

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
