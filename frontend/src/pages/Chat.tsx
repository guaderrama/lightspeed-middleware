import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Send, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  cost?: number;
}

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');

  const chatMutation = useMutation({
    mutationFn: async (question: string) => {
      const response = await apiClient.chat(question);
      return response.data;
    },
    onSuccess: (data) => {
      if (data) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.answer,
            cost: data.cost,
          },
        ]);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatMutation.isPending) return;

    const userMessage = input.trim();
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    chatMutation.mutate(userMessage);
  };

  const suggestedQuestions = [
    '¿Cuáles son los productos con mayor riesgo de quiebre de stock?',
    '¿Qué productos tienen exceso de inventario?',
    'Resume la situación del inventario',
    '¿Qué productos debo ordenar urgentemente?',
  ];

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Chat con IA</h1>
        <p className="text-gray-500 mt-1">
          Pregunta sobre tu inventario • Powered by Gemini 3 Flash
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="bg-gradient-to-br from-purple-100 to-blue-100 p-4 rounded-full mb-4">
                <Sparkles className="h-12 w-12 text-purple-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                ¿En qué puedo ayudarte?
              </h2>
              <p className="text-gray-500 mb-6 max-w-md">
                Hazme cualquier pregunta sobre tu inventario y te daré respuestas
                basadas en análisis en tiempo real.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl">
                {suggestedQuestions.map((question, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInput(question);
                    }}
                    className="text-left p-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
                  >
                    <p className="text-sm text-gray-700">{question}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((message, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'flex gap-3',
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {message.role === 'assistant' && (
                    <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                      <Sparkles className="h-4 w-4 text-white" />
                    </div>
                  )}

                  <div
                    className={cn(
                      'max-w-[80%] rounded-lg px-4 py-3',
                      message.role === 'user'
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-900'
                    )}
                  >
                    <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                      {message.content}
                    </div>
                    {message.cost !== undefined && (
                      <p className="text-xs text-gray-500 mt-2">
                        Costo: ${message.cost.toFixed(4)}
                      </p>
                    )}
                  </div>

                  {message.role === 'user' && (
                    <div className="flex-shrink-0 w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-semibold">U</span>
                    </div>
                  )}
                </div>
              ))}

              {chatMutation.isPending && (
                <div className="flex gap-3 justify-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-gray-100 rounded-lg px-4 py-3">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-600" />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 p-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu pregunta..."
              disabled={chatMutation.isPending}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || chatMutation.isPending}
              className={cn(
                'px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2'
              )}
            >
              {chatMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </form>
        </div>
      </div>

      {chatMutation.isError && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">
            Error: {(chatMutation.error as Error).message}
          </p>
        </div>
      )}
    </div>
  );
}
