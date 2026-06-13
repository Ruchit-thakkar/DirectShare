import {
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  FileArchive,
  Cpu,
  Code as CodeIcon,
  BookOpen,
  Type,
  Database,
  Palette,
  Box,
  File as FileIcon,
} from 'lucide-react';

export function getFileCategory(fileName: string, mimeType?: string): string {
  const extIndex = fileName.lastIndexOf('.');
  const ext = extIndex !== -1 ? fileName.slice(extIndex).toLowerCase() : '';

  // Documents
  if (['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.rtf', '.odt', '.ods', '.odp'].includes(ext)) {
    return 'Document';
  }

  // Images
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.ico'].includes(ext)) {
    return 'Image';
  }

  // Videos
  if (['.mp4', '.mkv', '.avi', '.mov', '.flv', '.webm', '.wmv'].includes(ext)) {
    return 'Video';
  }

  // Audio
  if (['.mp3', '.wav', '.aac', '.flac', '.ogg', '.m4a', '.wma'].includes(ext)) {
    return 'Audio';
  }

  // Archives
  if (['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz'].includes(ext)) {
    return 'Archive';
  }

  // Applications
  if (['.apk', '.exe', '.msi', '.app', '.dmg', '.deb', '.rpm'].includes(ext)) {
    return 'Application';
  }

  // Code Files
  if (['.html', '.css', '.js', '.ts', '.py', '.java', '.c', '.cpp', '.json', '.xml', '.h', '.cs', '.go', '.rs', '.sh', '.bat', '.rb', '.php', '.swift', '.tsx', '.jsx'].includes(ext)) {
    return 'Code';
  }

  // E-books
  if (['.epub', '.mobi'].includes(ext)) {
    return 'E-book';
  }

  // Fonts
  if (['.ttf', '.otf', '.woff', '.woff2', '.eot'].includes(ext)) {
    return 'Font';
  }

  // Databases
  if (['.sql', '.db', '.sqlite', '.mdb', '.accdb'].includes(ext)) {
    return 'Database';
  }

  // Design Files
  if (['.psd', '.ai', '.svg', '.fig', '.xd', '.sketch'].includes(ext)) {
    return 'Design';
  }

  // 3D Models
  if (['.obj', '.stl', '.fbx', '.gltf', '.glb', '.3ds', '.dae'].includes(ext)) {
    return '3D Model';
  }

  // Fallback check based on MIME type
  if (mimeType) {
    if (mimeType.startsWith('image/')) return 'Image';
    if (mimeType.startsWith('video/')) return 'Video';
    if (mimeType.startsWith('audio/')) return 'Audio';
    if (mimeType.startsWith('text/')) return 'Document';
  }

  return 'Other Files';
}

export function getFileTypeVisuals(category: string) {
  switch (category) {
    case 'Document':
      return {
        icon: FileText,
        colorClass: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
      };
    case 'Image':
      return {
        icon: ImageIcon,
        colorClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      };
    case 'Video':
      return {
        icon: Video,
        colorClass: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      };
    case 'Audio':
      return {
        icon: Music,
        colorClass: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
      };
    case 'Archive':
      return {
        icon: FileArchive,
        colorClass: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20',
      };
    case 'Application':
      return {
        icon: Cpu,
        colorClass: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
      };
    case 'Code':
      return {
        icon: CodeIcon,
        colorClass: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
      };
    case 'E-book':
      return {
        icon: BookOpen,
        colorClass: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
      };
    case 'Font':
      return {
        icon: Type,
        colorClass: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
      };
    case 'Database':
      return {
        icon: Database,
        colorClass: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
      };
    case 'Design':
      return {
        icon: Palette,
        colorClass: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
      };
    case '3D Model':
      return {
        icon: Box,
        colorClass: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
      };
    default:
      return {
        icon: FileIcon,
        colorClass: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
      };
  }
}

export function getFileTypeVisualsByFileName(fileName: string, mimeType?: string) {
  const category = getFileCategory(fileName, mimeType);
  return {
    category,
    ...getFileTypeVisuals(category),
  };
}

export function generateThumbnail(file: File): Promise<string | undefined> {
  return new Promise((resolve) => {
    // Only generate thumbnails for images that are not extremely large (>50MB) to prevent canvas issues
    if (!file.type.startsWith('image/') || file.size > 50 * 1024 * 1024) {
      resolve(undefined);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 80;
        let w = img.width;
        let h = img.height;
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          try {
            resolve(canvas.toDataURL('image/jpeg', 0.6));
          } catch (err) {
            resolve(undefined);
          }
        } else {
          resolve(undefined);
        }
      };
      img.onerror = () => resolve(undefined);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(undefined);
    reader.readAsDataURL(file);
  });
}
