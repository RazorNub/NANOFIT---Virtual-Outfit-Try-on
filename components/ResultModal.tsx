import React, { useState, useEffect } from 'react';
import { X, ArrowRight, Loader2, Download, Share2 } from 'lucide-react';

interface ResultModalProps {
  imageUrl: string | null;
  onClose: () => void;
  onReset: () => void;
  onRefine: (prompt: string) => Promise<void>;
  onUndo: () => void;
  canUndo: boolean;
}

const ResultModal: React.FC<ResultModalProps> = ({ imageUrl, onClose, onReset, onRefine, onUndo, canUndo }) => {
  const [prompt, setPrompt] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [imageKey, setImageKey] = useState(Date.now());
  const [isSharing, setIsSharing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (imageUrl) setImageKey(Date.now());
  }, [imageUrl]);

  if (!imageUrl) return null;

  const handleSend = async () => {
    if (!prompt.trim()) return;
    setIsRefining(true);
    try {
      await onRefine(prompt);
      setPrompt('');
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefining(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 1. Share Handler (Mobile Native Share)
  const handleShare = async () => {
    if (!imageUrl) return;
    setIsSharing(true);
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const file = new File([blob], "nanofit_render.png", { type: "image/png" });
      
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'NanoFit Output',
          text: 'Check out my fit generated with NanoFit AI.',
        });
      } else {
        alert("Native sharing is not supported on this device.");
      }
    } catch (error) {
      console.error("Share failed:", error);
    } finally {
      setIsSharing(false);
    }
  };

  // 2. Download/Save Handler (Universal)
  const handleDownload = async () => {
    if (!imageUrl) return;
    setIsDownloading(true);
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `nanofit_render_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
      // Fallback for strict mobile browsers
      window.open(imageUrl, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex justify-between items-center p-4 md:p-6 border-b border-white/20 bg-black z-50 shrink-0">
         <h2 className="font-display text-xl md:text-2xl uppercase font-bold tracking-tighter">Generated Output</h2>
         <button 
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center border border-white/20 hover:bg-white hover:text-black transition-colors"
         >
            <X size={20} />
         </button>
      </div>

      {/* Content Container - Scrollable on mobile, Fixed on Desktop */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
        
        {/* Main Image Stage 
            Mobile: Fixed height (65vh) to ensure visibility. 
            Desktop: Flex-1 to fill available space.
        */}
        <div className="
          relative 
          w-full 
          h-[65vh] lg:h-auto lg:flex-1 
          bg-zinc-900 
          flex items-center justify-center 
          p-4 lg:p-8 
          shrink-0
        ">
          <div className="relative h-full w-full max-w-4xl flex items-center justify-center">
            <img 
              key={imageKey} 
              src={imageUrl} 
              alt="Result" 
              className="h-full w-full object-contain shadow-2xl"
            />
            {isRefining && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20">
                 <Loader2 size={48} className="animate-spin text-white mb-4" />
                 <span className="font-display text-xl uppercase tracking-widest animate-pulse">Processing Refinement</span>
              </div>
            )}
          </div>
          
          {/* Mobile Overlay Hint */}
          <div className="lg:hidden absolute bottom-4 left-0 right-0 text-center pointer-events-none">
            <span className="bg-black/50 text-white text-[10px] px-2 py-1 uppercase backdrop-blur-md rounded-full">
              Scroll down for controls
            </span>
          </div>
        </div>

        {/* Sidebar Controls */}
        <div className="
          w-full lg:w-[450px] 
          bg-black 
          border-t lg:border-t-0 lg:border-l border-white/20 
          p-6 md:p-8 
          flex flex-col 
          gap-8
          shrink-0
          pb-20 lg:pb-8
        ">
           
           <div className="flex-1">
              <div className="mb-8 md:mb-12">
                 <h3 className="font-display text-2xl md:text-3xl uppercase font-bold mb-2 leading-tight text-white">
                    Damn you really look hot in that fit😉
                 </h3>
                 <p className="text-zinc-500 font-mono text-xs md:text-sm mt-4">
                   AI GENERATED • HIGH FIDELITY • V3.0<br/>
                   The output preserves identity while morphing fabric reality.
                 </p>
              </div>

              {/* Chat Input */}
              <div className="space-y-6">
                 <div className="relative group">
                    <input 
                      type="text"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="TYPE COMMAND TO REFINE..."
                      disabled={isRefining}
                      className="w-full bg-transparent border-b-2 border-zinc-800 py-4 pr-12 text-lg font-display uppercase placeholder:text-zinc-700 text-white focus:border-white focus:outline-none transition-colors"
                    />
                    <button 
                      onClick={handleSend}
                      disabled={!prompt.trim() || isRefining}
                      className="absolute right-0 top-4 text-zinc-500 hover:text-white transition-colors"
                    >
                      <ArrowRight size={24} />
                    </button>
                 </div>
                 
                 <div className="flex flex-wrap gap-3">
                    {["Zoom In", "Fix Lighting", "Higher Contrast"].map((tag) => (
                       <button
                         key={tag}
                         onClick={() => setPrompt(tag)}
                         className="px-4 py-2 border border-zinc-800 text-xs font-bold uppercase hover:bg-white hover:text-black transition-colors"
                       >
                         {tag}
                       </button>
                    ))}
                 </div>
              </div>
           </div>

           <div className="mt-auto space-y-4">
              
              {/* Separate Share and Save Buttons */}
              <div className="grid grid-cols-2 gap-3">
                 <button 
                   onClick={handleShare}
                   disabled={isSharing || (typeof navigator !== 'undefined' && !navigator.share)}
                   className="py-5 bg-zinc-900 border border-zinc-800 text-white font-display text-lg md:text-xl font-bold uppercase hover:bg-zinc-800 hover:border-zinc-700 transition-colors flex items-center justify-center gap-3 disabled:opacity-30 disabled:cursor-not-allowed"
                 >
                   {isSharing ? <Loader2 className="animate-spin" size={24}/> : <Share2 size={24} />}
                   Share
                 </button>

                 <button 
                   onClick={handleDownload}
                   disabled={isDownloading}
                   className="py-5 bg-white text-black font-display text-lg md:text-xl font-bold uppercase hover:bg-zinc-300 transition-colors flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   {isDownloading ? <Loader2 className="animate-spin" size={24}/> : <Download size={24} />}
                   Save
                 </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <button 
                   onClick={onUndo}
                   disabled={!canUndo}
                   className="py-4 border border-zinc-800 text-zinc-400 font-display font-bold uppercase hover:border-white hover:text-white disabled:opacity-30 disabled:hover:border-zinc-800 transition-all"
                 >
                   Undo
                 </button>
                 <button 
                    onClick={onReset}
                    className="py-4 border border-zinc-800 text-zinc-400 font-display font-bold uppercase hover:bg-red-600 hover:text-white hover:border-red-600 transition-all"
                 >
                    Reset
                 </button>
              </div>
           </div>

        </div>

      </div>
    </div>
  );
};

export default ResultModal;