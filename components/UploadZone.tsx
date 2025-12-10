import React, { useRef } from 'react';
import { Plus, X } from 'lucide-react';
import { ImageFile } from '../types';
import { fileToBase64 } from '../utils/imageUtils';

interface UploadZoneProps {
  label: string;
  sublabel?: string;
  image: ImageFile | null;
  onImageChange: (image: ImageFile | null) => void;
  disabled?: boolean;
}

const UploadZone: React.FC<UploadZoneProps> = ({ label, sublabel, image, onImageChange, disabled }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        const base64 = await fileToBase64(file);
        const mimeType = file.type || 'image/png';
        onImageChange({
          file,
          previewUrl: URL.createObjectURL(file),
          base64,
          mimeType,
        });
        // Reset input to allow re-uploading the same file
        e.target.value = '';
      } catch (err) {
        console.error("Error reading file", err);
      }
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (image?.previewUrl) {
      URL.revokeObjectURL(image.previewUrl);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onImageChange(null);
  };

  return (
    <div className="w-full group/zone">
      <div className="flex justify-between items-baseline mb-6 border-b border-zinc-800 pb-2">
        <h3 className="font-display text-4xl uppercase font-bold tracking-tight text-white">{label}</h3>
        <span className="font-mono text-xs text-zinc-500 uppercase tracking-wider hidden md:block">
           {image ? 'ASSET LOADED' : 'AWAITING INPUT'}
        </span>
      </div>
      
      {/* Brutalist Frame */}
      <div 
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={`
          relative w-full aspect-[3/4] bg-zinc-950
          border-2 ${image ? 'border-white' : 'border-zinc-800'} 
          hover:border-white transition-all duration-300
          cursor-pointer overflow-hidden
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*"
          onChange={handleFileSelect}
          disabled={disabled}
        />

        {image ? (
          <>
            <img 
              src={image.previewUrl} 
              alt="Preview" 
              className="w-full h-full object-cover grayscale group-hover/zone:grayscale-0 transition-all duration-500"
            />
            {/* Hover Actions */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/zone:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-4">
                 <button 
                  onClick={handleClear}
                  className="bg-white text-black border border-white px-8 py-4 font-display uppercase text-xl font-bold hover:bg-black hover:text-white transition-colors flex items-center gap-2"
                >
                  <X size={20} /> Clear Asset
                </button>
                <span className="text-zinc-400 font-mono text-xs uppercase">Click to Replace</span>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950">
             <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-6 text-center group-hover/zone:bg-zinc-900 transition-colors duration-500">
                <Plus size={80} strokeWidth={0.5} className="text-zinc-700 group-hover/zone:text-white transition-colors duration-500 mb-6" />
                <span className="font-display text-2xl font-bold uppercase text-white mb-2">{sublabel}</span>
                <span className="font-mono text-xs text-zinc-500 uppercase tracking-widest">
                  JPG / PNG / WEBP <br/> MAX 10MB
                </span>
             </div>
             {/* Diagonal Lines Texture */}
             <div className="absolute inset-0 opacity-10 pointer-events-none" 
                  style={{ backgroundImage: 'repeating-linear-gradient(45deg, #333 0, #333 1px, transparent 0, transparent 50%)', backgroundSize: '10px 10px' }} 
             />
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadZone;