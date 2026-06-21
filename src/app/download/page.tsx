import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import DownloadClient from './DownloadClient';

// Disable default caching so APK stats reflect changes dynamically
export const revalidate = 0;

interface ApkMetadata {
  size: string;
  checksum: string;
}

function getApkMetadata(): ApkMetadata {
  const defaultSize = '24.53 MB';
  const defaultChecksum = 'd8f58b76c8c4a1de43bb1823a31c51480f2d87e0b57e7c4f4ad9492161f3647a';

  try {
    // Try the public/downloads/DirectShare.apk location first
    let filePath = path.join(process.cwd(), 'public', 'downloads', 'DirectShare.apk');
    
    if (!fs.existsSync(filePath)) {
      // Fallback to public/DirectShare.apk
      const fallbackPath = path.join(process.cwd(), 'public', 'DirectShare.apk');
      if (fs.existsSync(fallbackPath)) {
        filePath = fallbackPath;
      } else {
        console.warn('APK file not found in public/downloads/DirectShare.apk or public/DirectShare.apk');
        return { size: defaultSize, checksum: defaultChecksum };
      }
    }

    const stats = fs.statSync(filePath);
    const sizeInMb = stats.size / (1024 * 1024);
    const formattedSize = `${sizeInMb.toFixed(2)} MB`;

    // Compute SHA-256 Checksum
    const fileBuffer = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha256');
    hash.update(fileBuffer);
    const checksum = hash.digest('hex');

    return { size: formattedSize, checksum };
  } catch (error) {
    console.error('Error fetching APK metadata:', error);
    return { size: defaultSize, checksum: defaultChecksum };
  }
}

export default async function DownloadPage() {
  const { size, checksum } = getApkMetadata();

  return (
    <main className="flex-grow flex flex-col justify-center items-center">
      <DownloadClient apkSize={size} apkChecksum={checksum} />
    </main>
  );
}
