import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, ExternalLink, ShieldCheck, Zap, CheckCircle2, Lock, Unlock } from 'lucide-react';
import UploadZone from './components/UploadZone';
import ResultModal from './components/ResultModal';
import { AppState } from './types';
import { analyzeItemImage, generateTryOn, refineImage } from './services/geminiService';

// --- CONFIGURATION ---
// ⚠️ REPLACE THIS URL WITH YOUR CLOUD HOSTED VIDEO LINK
// You must upload your 'sam2_masked_video' to a cloud service (Cloudinary, AWS S3, etc.)
// and paste the direct .mp4 link here. Local file paths (C:/ or /Users/) will NOT work in a browser.
const HERO_VIDEO_URL = "https://res.cloudinary.com/dqabkngry/video/upload/v1765395847/Final_Video_with_black_background_x0sc6e.mp4"; 

const App: React.FC = () => {
  // --- STATE ---
  const [loading, setLoading] = useState(true);
  const [dissolving, setDissolving] = useState(false);
  const [state, setState] = useState<AppState>({
    personImage: null,
    itemImage: null,
    generatedImage: null,
    isAnalyzing: false,
    isGenerating: false,
    loadingStatus: null,
    detectedType: null,
    manualTypeOverride: null,
    error: null,
    hasApiKey: false,
    showKeyGuide: false,
    modelMode: 'pro',
    flashApiKey: '',
  });
  // Local state for Pro Key when not in AI Studio
  const [localProKey, setLocalProKey] = useState('');
  
  const [history, setHistory] = useState<string[]>([]);
  const studioRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLHeadingElement>(null);
  const [isLocalEnv, setIsLocalEnv] = useState(false);

  // --- PRELOADER ANIMATION SEQUENCE ---
  useEffect(() => {
    // Check environment
    const isAiStudio = !!(window as any).aistudio;
    setIsLocalEnv(!isAiStudio);

    // 1. Text Animates In via CSS (0s - 1.4s)
    
    // 2. Text Dissolves (2.2s)
    const dissolveTimer = setTimeout(() => {
      setDissolving(true);
    }, 2200);

    // 3. Curtain Opens (3.0s)
    const openTimer = setTimeout(() => {
      setLoading(false);
    }, 3000);

    // API Key Check (Only for AI Studio)
    const checkKey = async () => {
      if ((window as any).aistudio) {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        setState(prev => ({ ...prev, hasApiKey: hasKey }));
      }
    };
    checkKey();

    return () => { clearTimeout(dissolveTimer); clearTimeout(openTimer); };
  }, []);

  // --- SCROLL ANIMATION FOR VIDEO & TEXT ---
  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY;
      const viewportHeight = window.innerHeight;
      // Calculate ratio (0 to 1) based on how far we've scrolled down the first viewport
      const ratio = Math.min(scrolled / viewportHeight, 1);

      // VIDEO ANIMATION
      if (videoRef.current) {
        // Blur increases as we scroll down (0px to 20px)
        const blurAmount = ratio * 20; 
        // Opacity decreases (1 to 0) - accelerate fade slightly
        const opacity = 1 - Math.pow(ratio, 1.2); 
        // Scale decreases slightly for depth (1 to 0.9)
        const scale = 1 - (ratio * 0.1);

        videoRef.current.style.filter = `blur(${blurAmount}px)`;
        videoRef.current.style.opacity = `${opacity}`;
        videoRef.current.style.transform = `scale(${scale})`;
      }

      // TEXT ANIMATION (Parallax Effect)
      if (textRef.current) {
        // Scale UP slightly to create depth difference with video (1 -> 1.15)
        const textScale = 1 + (ratio * 0.15);
        // Fade out slightly faster than video
        const textOpacity = 1 - Math.pow(ratio, 0.8);
        // Blur slightly
        const textBlur = ratio * 10;

        textRef.current.style.transform = `scale(${textScale})`;
        textRef.current.style.opacity = `${textOpacity}`;
        textRef.current.style.filter = `blur(${textBlur}px)`;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // --- HELPER: CHECK UNLOCK STATUS ---
  const isValidKey = (key: string) => /^AIza[0-9A-Za-z-_]{35}$/.test(key);
  
  const isUnlocked = () => {
    if (state.modelMode === 'pro') {
      // In AI Studio, rely on internal state. Locally, check the manual input.
      return isLocalEnv ? isValidKey(localProKey) : state.hasApiKey;
    }
    return isValidKey(state.flashApiKey);
  };

  // --- AUTO SCROLL WHEN UNLOCKED ---
  useEffect(() => {
    if (isUnlocked() && studioRef.current) {
      setTimeout(() => {
        studioRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 500);
    }
  }, [state.hasApiKey, state.flashApiKey, localProKey, state.modelMode, isLocalEnv]);

  // --- HANDLERS ---
  const handleSelectKey = async () => {
    if ((window as any).aistudio) {
      try {
        await (window as any).aistudio.openSelectKey();
        setState(prev => ({ ...prev, hasApiKey: true, error: null, modelMode: 'pro' }));
      } catch (e) { console.log(e); }
    } else {
      // Local fallback: Just focus the input or allow user to type
      setState(prev => ({ ...prev, modelMode: 'pro' }));
    }
  };

  const getActiveKey = () => {
    if (state.modelMode === 'flash') return state.flashApiKey;
    if (isLocalEnv) return localProKey;
    return undefined; // In AI Studio Pro mode, key is handled by env
  };

  const autoAnalyze = async () => {
      if (!isUnlocked() || !state.itemImage || state.detectedType || state.isAnalyzing) return;
      setState(prev => ({ ...prev, isAnalyzing: true, error: null }));
      try {
        const type = await analyzeItemImage(
          state.itemImage.base64, 
          state.itemImage.mimeType,
          { 
            modelMode: state.modelMode, 
            customApiKey: getActiveKey()
          }
        );
        setState(prev => ({ ...prev, detectedType: type, manualTypeOverride: type, isAnalyzing: false }));
      } catch (err) {
        setState(prev => ({ ...prev, detectedType: 'clothing', manualTypeOverride: 'clothing', isAnalyzing: false }));
      }
  };

  useEffect(() => { autoAnalyze(); }, [state.itemImage, state.flashApiKey, localProKey]);

  const handleGenerate = async () => {
    if (!state.personImage || !state.itemImage || !isUnlocked()) return;
    setState(prev => ({ ...prev, isGenerating: true, loadingStatus: 'INITIALIZING GENERATION...', error: null }));
    setHistory([]);

    try {
      const finalType = state.manualTypeOverride || state.detectedType || 'clothing';
      const resultImage = await generateTryOn(
        state.personImage.base64,
        state.personImage.mimeType,
        state.itemImage.base64,
        state.itemImage.mimeType,
        finalType,
        { 
          modelMode: state.modelMode, 
          customApiKey: getActiveKey(),
          onStatusUpdate: (status) => setState(prev => ({ ...prev, loadingStatus: status.toUpperCase() }))
        }
      );
      setState(prev => ({ ...prev, generatedImage: resultImage, isGenerating: false, loadingStatus: null }));
    } catch (err: any) {
      console.error("Generation Error Full:", err);
      let msg = err.message || "Generation failed.";
      if (msg.includes('403')) msg = "Permission denied. API Key invalid or expired.";
      setState(prev => ({ ...prev, isGenerating: false, loadingStatus: null, error: msg }));
    }
  };

  const handleRefine = async (instruction: string) => {
    if (!state.generatedImage) return;
    setHistory(prev => [...prev, state.generatedImage!]);
    try {
      const refined = await refineImage(state.generatedImage, instruction, { 
        modelMode: state.modelMode, 
        customApiKey: getActiveKey()
      });
      setState(prev => ({ ...prev, generatedImage: refined }));
    } catch (e) {
      setHistory(prev => prev.slice(0, -1));
      throw e;
    }
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    setState(prev => ({ ...prev, generatedImage: history[history.length - 1] }));
    setHistory(prev => prev.slice(0, -1));
  };

  const word = "NANOFIT";

  return (
    <div className="bg-black min-h-screen text-white selection:bg-white selection:text-black font-sans">
      
      {/* --- SPLIT CURTAIN PRELOADER --- */}
      <div className={`fixed inset-0 z-[999] pointer-events-none flex flex-col`}>
         <div className={`bg-black flex-1 w-full curtain-panel flex items-end justify-center pb-2 ${!loading ? 'curtain-open-top' : ''}`}></div>
         <div className={`absolute inset-0 flex items-center justify-center pointer-events-none z-[1000]`}>
            <div className={`preloader-content flex gap-1 md:gap-4 ${dissolving ? 'dissolve' : ''} ${!loading && !dissolving ? 'opacity-0' : ''}`}>
               {word.split('').map((char, i) => (
                  <span key={i} className="char-wrapper overflow-hidden">
                     <span 
                        className={`char font-display text-[12vw] md:text-[15vw] font-bold leading-none tracking-tighter text-white ${i % 2 === 0 ? 'from-bottom' : 'from-top'}`}
                        style={{ animationDelay: `${i * 0.1}s` }}
                     >
                        {char}
                     </span>
                  </span>
               ))}
            </div>
         </div>
         <div className={`bg-black flex-1 w-full curtain-panel flex items-start justify-center pt-2 ${!loading ? 'curtain-open-bottom' : ''}`}></div>
      </div>

      {/* --- HERO SECTION (STICKY BACKGROUND) --- */}
      <div className="fixed inset-0 z-0 h-screen w-full overflow-hidden flex flex-col items-center justify-center">
          <h1 
            ref={textRef}
            className="absolute z-0 font-display text-[22vw] leading-none text-center font-bold text-white tracking-tighter select-none will-change-transform origin-center"
          >
            NANOFIT
          </h1>
          <div 
            ref={videoRef}
            className="relative z-10 w-[280px] md:w-[350px] aspect-[9/16] overflow-hidden transition-all duration-75 will-change-transform"
            style={{ mixBlendMode: 'screen' }}
          >
             <video 
              autoPlay 
              loop 
              muted 
              playsInline
              className="w-full h-full object-cover"
              // Fallback poster if video fails
              poster="https://images.pexels.com/photos/7653556/pexels-photo-7653556.jpeg"
             >
               <source src={HERO_VIDEO_URL} type="video/mp4" />
               Your browser does not support the video tag.
             </video>
          </div>
      </div>

      {/* --- SCROLLABLE CONTENT LAYER --- */}
      <div className="relative z-10 mt-[100vh] bg-black w-full min-h-screen border-t border-zinc-800">
        
        <div className="w-full py-12 px-6 border-b border-zinc-800 bg-black">
          <p className="font-display text-2xl md:text-4xl text-center uppercase max-w-4xl mx-auto leading-tight">
            Try on any fit or accessory<br/>with just a click.
          </p>
        </div>

        {/* --- MODEL SELECTION HEADER --- */}
        <div className="w-full py-4 border-b border-zinc-800 bg-zinc-950 text-center">
            <span className="font-mono text-zinc-500 text-sm uppercase tracking-widest">Choose Your Model</span>
        </div>

        {/* --- AUTHENTICATION SECTION --- */}
        <div id="try-nanofit" className="grid grid-cols-1 md:grid-cols-2 border-b border-zinc-800 min-h-[500px]">
          
          {/* Left: PRO MODE */}
          <div 
            onClick={() => { setState(prev => ({ ...prev, modelMode: 'pro' })); handleSelectKey(); }}
            className={`
              p-12 md:p-24 border-b md:border-b-0 md:border-r border-zinc-800 cursor-pointer transition-colors duration-500 group flex flex-col justify-between
              ${state.modelMode === 'pro' ? 'bg-zinc-900' : 'bg-black hover:bg-zinc-950'}
            `}
          >
            <div>
              <div className="flex justify-between items-start mb-12">
                <ShieldCheck size={48} strokeWidth={1} className={state.modelMode === 'pro' ? 'text-white' : 'text-zinc-600'} />
                {state.modelMode === 'pro' && (
                   <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-green-500 uppercase">Active</span>
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                   </div>
                )}
              </div>
              <h2 className="font-display text-5xl md:text-6xl uppercase font-bold mb-4 group-hover:tracking-wide transition-all">
                Nano Banana<br/>Pro
              </h2>
              <p className="text-zinc-400 font-mono mb-8 max-w-md">
                Use this model for 99% accuracy and the most optimal fits!!
              </p>
            </div>
            
            {/* Conditional Input for PRO Mode: Auto-connect in AI Studio, Manual input Local */}
            {!isLocalEnv ? (
              <div className={`inline-flex items-center gap-2 border border-zinc-700 px-6 py-4 uppercase font-bold text-sm tracking-widest transition-colors w-fit ${state.hasApiKey ? 'bg-white text-black border-white' : 'text-zinc-400'}`}>
                {state.hasApiKey ? 'CONNECTED' : 'CONNECT VIA GOOGLE'}
              </div>
            ) : (
               <div className="relative z-20" onClick={e => e.stopPropagation()}>
                <div className={`relative flex items-center border-b-2 transition-colors ${state.modelMode === 'pro' ? 'border-white' : 'border-zinc-700'}`}>
                  <input 
                    type="password" 
                    placeholder="PASTE PRO API KEY"
                    value={localProKey}
                    onChange={(e) => setLocalProKey(e.target.value.trim())}
                    className="w-full bg-transparent py-4 font-mono text-lg outline-none placeholder:text-zinc-700"
                  />
                  {localProKey && (
                    isValidKey(localProKey) 
                     ? <CheckCircle2 className="text-green-500" />
                     : <span className="text-red-500 font-mono text-xs">INVALID</span>
                  )}
                </div>
                <span className="inline-block mt-4 text-xs font-mono text-zinc-500">
                  RUNNING LOCALLY? ENTER KEY MANUALLY.
                </span>
             </div>
            )}
          </div>

          {/* Right: FLASH MODE */}
          <div 
            onClick={() => setState(prev => ({ ...prev, modelMode: 'flash' }))}
            className={`
              p-12 md:p-24 cursor-pointer transition-colors duration-500 group relative overflow-hidden flex flex-col justify-between
              ${state.modelMode === 'flash' ? 'bg-zinc-900' : 'bg-black hover:bg-zinc-950'}
            `}
          >
            <div>
              <div className="flex justify-between items-start mb-12">
                <Zap size={48} strokeWidth={1} className={state.modelMode === 'flash' ? 'text-white' : 'text-zinc-600'} />
                {state.modelMode === 'flash' && (
                  <div className="flex items-center gap-2">
                     <span className="font-mono text-xs text-green-500 uppercase">Active</span>
                     <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                  </div>
                )}
              </div>
              <h2 className="font-display text-5xl md:text-6xl uppercase font-bold mb-4 group-hover:tracking-wide transition-all">
                Gemini<br/>Flash
              </h2>
              <p className="text-zinc-400 font-mono mb-8 max-w-md">
                Use this model for free with some limits, the results from this model might not be accurate everytime!
              </p>
            </div>
            
            {/* API Input for Flash */}
            <div className="relative z-20" onClick={e => e.stopPropagation()}>
               <div className={`relative flex items-center border-b-2 transition-colors ${state.modelMode === 'flash' ? 'border-white' : 'border-zinc-700'}`}>
                 <input 
                   type="password" 
                   placeholder="PASTE FLASH API KEY"
                   value={state.flashApiKey}
                   onChange={(e) => setState(prev => ({ ...prev, flashApiKey: e.target.value.trim() }))}
                   className="w-full bg-transparent py-4 font-mono text-lg outline-none placeholder:text-zinc-700"
                 />
                 {state.flashApiKey && (
                   isValidKey(state.flashApiKey) 
                    ? <CheckCircle2 className="text-green-500" />
                    : <span className="text-red-500 font-mono text-xs">INVALID</span>
                 )}
               </div>
               <a 
                 href="https://aistudio.google.com/app/apikey" 
                 target="_blank" 
                 rel="noreferrer"
                 className="inline-flex items-center gap-1 mt-4 text-xs font-mono text-zinc-500 hover:text-white transition-colors"
               >
                 GET KEY <ExternalLink size={10} />
               </a>
            </div>
          </div>
        </div>

        {/* --- STUDIO SECTION --- */}
        <div 
          ref={studioRef}
          className={`
            transition-all duration-1000 ease-in-out overflow-hidden bg-black
            ${isUnlocked() ? 'max-h-[2500px] opacity-100' : 'max-h-0 opacity-20'}
          `}
        >
          <div className="py-24 px-6 md:px-12 max-w-screen-2xl mx-auto border-t border-zinc-800">
             
             <div className="mb-12 flex items-center gap-4">
               <div className="bg-green-500 text-black px-3 py-1 font-mono text-xs uppercase font-bold">
                  System Ready
               </div>
               <span className="font-mono text-zinc-500 text-xs">
                 MODEL: {state.modelMode === 'pro' ? 'GEMINI 3 PRO' : 'GEMINI 2.5 FLASH'}
               </span>
             </div>

             <div className="flex flex-col lg:flex-row gap-12 lg:gap-24 items-start">
               
               {/* Person Upload */}
               <div className="flex-1 w-full">
                  <UploadZone 
                    label="01. Subject"
                    sublabel="Upload Person Image"
                    image={state.personImage}
                    onImageChange={(img) => setState(prev => ({ ...prev, personImage: img }))}
                  />
               </div>

               {/* Divider */}
               <div className="hidden lg:flex flex-col items-center justify-center pt-32 opacity-30">
                  <ArrowRight size={48} />
               </div>

               {/* Item Upload */}
               <div className="flex-1 w-full">
                  <UploadZone 
                    label="02. Outfit"
                    sublabel="Upload Clothing/Accessory"
                    image={state.itemImage}
                    onImageChange={(img) => setState(prev => ({ ...prev, itemImage: img, detectedType: null }))}
                  />
               </div>

             </div>

             {/* Action Bar */}
             <div className="mt-24 flex flex-col items-center justify-center gap-8">
                
                {state.error && (
                   <div className="font-mono text-red-500 border border-red-500 px-6 py-4 uppercase text-sm w-full max-w-lg text-center bg-red-950/20">
                     ERROR: {state.error}
                   </div>
                )}
                
                {/* Type Detector Status */}
                {state.itemImage && (
                   <div className="flex flex-col items-center gap-4 font-mono text-sm text-zinc-500 border border-zinc-800 p-6 w-full max-w-lg">
                      <div className="flex justify-between w-full">
                         <span>DETECTED TYPE</span>
                         <span className="text-white uppercase font-bold">{state.isAnalyzing ? 'SCANNING...' : state.detectedType || '---'}</span>
                      </div>
                      <div className="w-full h-px bg-zinc-800 my-2" />
                      <div className="flex justify-between w-full items-center">
                        <span>MANUAL OVERRIDE</span>
                        <div className="flex gap-2">
                          {['clothing', 'accessory'].map(type => (
                            <button
                              key={type}
                              onClick={() => setState(prev => ({ ...prev, manualTypeOverride: type as any }))}
                              className={`px-4 py-2 border text-xs uppercase font-bold transition-all ${state.manualTypeOverride === type ? 'bg-white text-black border-white' : 'border-zinc-800 text-zinc-600 hover:border-zinc-500'}`}
                            >
                              {type}
                            </button>
                          ))}
                        </div>
                      </div>
                   </div>
                )}

                <button 
                  onClick={handleGenerate}
                  disabled={!state.personImage || !state.itemImage || state.isGenerating}
                  className={`
                    group relative px-16 py-8 w-full md:w-auto min-w-[360px]
                    font-display text-4xl uppercase font-bold tracking-tighter
                    border-2 border-white transition-all duration-300
                    disabled:opacity-50 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-600
                    hover:bg-white hover:text-black overflow-hidden
                  `}
                >
                  <span className="relative z-10 flex items-center justify-center gap-4">
                     {state.isGenerating ? (
                       <>
                         <span className="animate-spin"><Zap size={24} fill="currentColor" /></span>
                         <span className="animate-pulse text-2xl">{state.loadingStatus || 'PROCESSING...'}</span>
                       </>
                     ) : (
                       <>
                         INITIATE TRY-ON
                         <ArrowRight className="group-hover:translate-x-2 transition-transform" />
                       </>
                     )}
                  </span>
                </button>
             </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-900 py-12 text-center bg-black">
           <p className="font-mono text-zinc-700 text-xs uppercase tracking-[0.2em]">
             NanoFit AI v2.0 • Powered by Google Gemini
           </p>
        </div>

      </div>

      {/* Result Modal */}
      {state.generatedImage && (
        <ResultModal 
          imageUrl={state.generatedImage}
          onClose={() => setState(prev => ({ ...prev, generatedImage: null }))}
          onReset={() => setState(prev => ({ ...prev, generatedImage: null, personImage: null, itemImage: null }))}
          onRefine={handleRefine}
          onUndo={handleUndo}
          canUndo={history.length > 0}
        />
      )}
    </div>
  );
};

export default App;