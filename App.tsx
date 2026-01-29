import React from 'react';
import { LiveSession } from './components/LiveSession';

const App: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-900 text-white p-4 font-sans">
      <header className="w-full max-w-4xl flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-sudan-600 rounded-full flex items-center justify-center text-xl font-bold">
            🇸🇩
          </div>
          <div>
            <h1 className="text-2xl font-bold text-sudan-400">Gemini Live Sudan</h1>
            <p className="text-zinc-400 text-sm">ونسة سودانية مع الذكاء الاصطناعي</p>
          </div>
        </div>
      </header>

      <main className="w-full max-w-4xl flex-1 flex flex-col">
        <LiveSession />
      </main>

      <footer className="mt-8 text-zinc-600 text-xs text-center">
        Powered by Google Gemini 2.0 Flash Experimental • Native Audio
      </footer>
    </div>
  );
};

export default App;