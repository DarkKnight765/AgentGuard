import { authApi } from '../lib/api';

export function Login({ onLogin }: { onLogin: () => void }) {
  const handleDevLogin = async () => {
    try {
      await authApi.devLogin();
      onLogin();
    } catch (err) {
      console.error('Dev login failed:', err);
    }
  };

  return (
    <div className="min-h-screen bg-landing-outer p-4 md:p-8 lg:p-12 flex items-center justify-center relative overflow-hidden">
      
      {/* Abstract fluid background effect elements (optional css shapes) */}
      <div className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-white rounded-full blur-[100px] mix-blend-overlay"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-black rounded-full blur-[100px] mix-blend-overlay"></div>
      </div>

      {/* Main Inner Card */}
      <div className="card-landing-inner w-full max-w-7xl rounded-[2rem] overflow-hidden flex flex-col relative z-10" style={{ minHeight: '80vh' }}>
        
        {/* Navigation Bar */}
        <nav className="flex items-center justify-between px-8 py-6 z-20 relative">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-amber-200 to-orange-500 shadow-lg shadow-orange-500/20"></div>
            <span className="text-white font-semibold text-lg tracking-tight">AgentGuard.</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#" className="text-orange-400 hover:text-orange-300 transition-colors">Home</a>
            <a href="#" className="hover:text-white transition-colors">About</a>
            <a href="#" className="hover:text-white transition-colors">Agents</a>
            <a href="#" className="hover:text-white transition-colors">Pricing</a>
          </div>

          <div className="flex items-center gap-4">
            <button onClick={handleDevLogin} className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
              Login
            </button>
            <button onClick={handleDevLogin} className="text-sm font-medium btn-dark-glow px-5 py-2 rounded-full transition-all">
              Support
            </button>
          </div>
        </nav>

        {/* Hero Section */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 items-center z-20 relative px-8 pb-12 lg:pb-0">
          
          {/* Left Content */}
          <div className="max-w-xl xl:pl-12">
            <h1 className="text-5xl lg:text-6xl xl:text-7xl text-white tracking-tight leading-tight mb-6">
              <span className="font-bold">AgentGuard.</span>
              <br />
              <span className="font-serif italic text-slate-300 font-medium">Intelligent</span>
              <span className="font-bold"> by design</span>
            </h1>
            
            <p className="text-slate-400 text-sm lg:text-base leading-relaxed mb-10 max-w-md">
              Hey, you've gotta try this cool AI platform! It lets you whip up, launch, 
              and tweak smart automation solutions without needing to code! Plus, it offers a 
              user-friendly interface that makes everything super easy to navigate.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <button 
                onClick={handleDevLogin}
                className="btn-orange text-sm font-semibold px-8 py-3.5 rounded-full transition-all hover:scale-105 active:scale-95"
              >
                Build Your Agent
              </button>
              <button 
                onClick={handleDevLogin}
                className="btn-dark-glow text-sm font-medium px-8 py-3.5 rounded-full transition-all hover:scale-105 active:scale-95"
              >
                View Our Agent
              </button>
            </div>
          </div>

          {/* Right Content / Brain Graphic */}
          <div className="relative h-full min-h-[400px] flex items-center justify-center lg:justify-end pr-0 lg:pr-8 xl:pr-16 mt-12 lg:mt-0">
            {/* Soft glow behind the image */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-orange-500/10 blur-[100px] rounded-full z-0"></div>
            
            <img 
              src="/hero-brain.jpg" 
              alt="Neural Network Brain" 
              className="relative z-10 w-full max-w-lg lg:max-w-xl object-contain mix-blend-screen opacity-90 drop-shadow-2xl animate-pulse"
              style={{ animationDuration: '4s' }}
            />
          </div>
        </div>

      </div>
    </div>
  );
}
