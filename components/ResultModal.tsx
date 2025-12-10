import React, { useState, useEffect } from 'react';
import { X, ArrowRight, Loader2 } from 'lucide-react';

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

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex justify-between items-center p-6 border-b border-white/20">
         <h2 className="font-display text-2xl uppercase font-bold tracking-tighter">Generated Output</h2>
         <button 
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center border border-white/20 hover:bg-white hover:text-black transition-colors"
         >
            <X size={20} />
         </button>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* Main Image Stage */}
        <div className="flex-1 bg-zinc-900 relative flex items-center justify-center p-4 lg:p-8 overflow-hidden">
          <div className="relative h-full w-full max-w-4xl flex items-center justify-center">
            <img 
              key={imageKey} 
              src={imageUrl} 
              alt="Result" 
              className="max-h-full max-w-full object-contain shadow-2xl"
            />
            {isRefining && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20">
                 <Loader2 size={48} className="animate-spin text-white mb-4" />
                 <span className="font-display text-xl uppercase tracking-widest animate-pulse">Processing Refinement</span>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Controls */}
        <div className="w-full lg:w-[450px] bg-black border-l border-white/20 p-8 flex flex-col">
           
           <div className="flex-1">
              <div className="mb-12">
                 <h3 className="font-display text-3xl uppercase font-bold mb-2 leading-tight">Damn you really look hot in that fit😉</h3>
                 <p className="text-zinc-500 font-mono text-sm mt-4">
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

           <div className="mt-8 space-y-4">
              <a 
                href={imageUrl} 
                download="nanofit_render.png"
                className="block w-full py-5 bg-white text-black font-display text-xl font-bold uppercase text-center hover:bg-zinc-300 transition-colors"
              >
                Download Asset
              </a>
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