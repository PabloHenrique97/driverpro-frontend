import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User, Loader2, Mic, StopCircle } from 'lucide-react';
import { chatWithAssistant, transcribeAudio } from '../services/geminiService';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
}

export const ChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'model', text: 'Olá! Sou o assistente DriverPro. Como posso ajudar com suas rotas ou entregas hoje?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Audio State
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>(''); // Store the supported mime type

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
    }));

    const responseText = await chatWithAssistant(userMsg.text, history);
    
    const botMsg: Message = { id: (Date.now() + 1).toString(), role: 'model', text: responseText };
    setMessages(prev => [...prev, botMsg]);
    setIsLoading(false);
  };

  // --- Audio Logic ---
  const getSupportedMimeType = () => {
    const types = [
      'audio/webm',
      'audio/mp4',
      'audio/ogg',
      'audio/wav',
      'audio/aac'
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return ''; // Let browser decide default if none match
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Seu navegador não suporta gravação de áudio.");
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        const mimeType = getSupportedMimeType();
        mimeTypeRef.current = mimeType;

        const options = mimeType ? { mimeType } : undefined;
        const mediaRecorder = new MediaRecorder(stream, options);
        
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunksRef.current.push(event.data);
            }
        };

        mediaRecorder.onstop = async () => {
            // Use actual mime type from recorder if available, else fallback
            const type = mediaRecorder.mimeType || mimeTypeRef.current || 'audio/webm';
            const audioBlob = new Blob(audioChunksRef.current, { type });
            
            // Stop all tracks to release mic
            stream.getTracks().forEach(track => track.stop()); 
            
            await processAudio(audioBlob, type);
        };

        mediaRecorder.start();
        setIsRecording(true);
    } catch (err: any) {
        console.error("Erro ao acessar microfone:", err);
        // Detailed Error Handling
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            alert("Permissão do microfone negada. Habilite nas configurações do navegador.");
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            alert("Nenhum microfone encontrado neste dispositivo.");
        } else {
            // Log warning but don't disrupt flow unless critical
            console.warn(`Erro na gravação: ${err.message}`);
        }
    }
  };

  const stopRecording = () => {
      if (mediaRecorderRef.current && isRecording) {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
      }
  };

  const processAudio = async (blob: Blob, mimeType: string) => {
      setIsTranscribing(true);
      try {
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = async () => {
              const base64Audio = reader.result as string;
              if (base64Audio) {
                  const text = await transcribeAudio(base64Audio, mimeType);
                  if (text) {
                      setInput(prev => (prev ? prev + " " + text : text));
                  } else {
                      alert("Não foi possível entender o áudio. Tente falar mais perto do microfone.");
                  }
              }
              setIsTranscribing(false);
          };
      } catch (error) {
          console.error("Erro processando áudio:", error);
          setIsTranscribing(false);
      }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="bg-white w-80 md:w-96 h-[500px] rounded-2xl shadow-2xl border border-slate-200 flex flex-col mb-4 overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-300">
          {/* Header */}
          <div className="bg-slate-900 p-4 flex justify-between items-center text-white">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-600 rounded-lg">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm">DriverPro AI</h3>
                <p className="text-[10px] text-slate-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                  Gemini 3 Pro Online
                </p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-br-none' 
                    : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none shadow-sm'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-2 text-slate-500 text-xs">
                  <Loader2 className="w-3 h-3 animate-spin" /> Digitando...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-white border-t border-slate-100 flex gap-2 items-end">
             {isRecording ? (
                 <div className="flex-1 bg-red-50 border border-red-100 rounded-xl px-4 py-2 text-sm text-red-600 flex items-center justify-between animate-pulse">
                     <span className="font-bold">Gravando áudio...</span>
                     <Loader2 className="w-4 h-4 animate-spin" />
                 </div>
             ) : (
                <input 
                  type="text" 
                  className="flex-1 bg-slate-100 border-0 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder={isTranscribing ? "Transcrevendo..." : "Digite ou fale..."}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  disabled={isLoading || isTranscribing}
                />
             )}

            {/* Mic / Stop Button */}
            {isRecording ? (
                <button 
                  onClick={stopRecording}
                  className="p-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition shadow-md shadow-red-200"
                  title="Parar Gravação"
                >
                  <StopCircle className="w-5 h-5" />
                </button>
            ) : (
                <button 
                  onClick={startRecording}
                  disabled={isLoading || isTranscribing}
                  className={`p-2 rounded-xl transition ${isTranscribing ? 'bg-slate-200 text-slate-400' : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600'}`}
                  title="Gravar Áudio"
                >
                  {isTranscribing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mic className="w-5 h-5" />}
                </button>
            )}

            <button 
              onClick={handleSend}
              disabled={isLoading || isTranscribing || !input.trim()}
              className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-md shadow-blue-200"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg shadow-blue-600/30 flex items-center justify-center transition-transform hover:scale-110 active:scale-95 group"
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6 group-hover:animate-bounce" />}
      </button>
    </div>
  );
};
