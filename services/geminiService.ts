import { GoogleGenAI, Modality } from "@google/genai";
import { DashboardStats } from "../types";

// Helper to ensure fresh instance with latest key if available globally
const getAIClient = () => {
  // Check if there is a globally injected key from AI Studio selector
  const key = process.env.API_KEY; 
  if (!key) {
    console.error("API Key não configurada.");
    return null;
  }
  return new GoogleGenAI({ apiKey: key });
};

export const generateProductivityInsight = async (stats: DashboardStats): Promise<string> => {
  const ai = getAIClient();
  if (!ai) return "API Key ausente.";

  try {
    const prompt = `
      Atue como um analista de logística sênior. Analise os seguintes dados de produtividade da frota e forneça um resumo executivo curto (máximo 3 frases) com uma recomendação de melhoria.
      
      Dados:
      - Tempo Médio de Percurso: ${(stats.avgTravelTime / 60).toFixed(1)} minutos
      - Tempo Médio de Tarefa: ${(stats.avgTaskTime / 60).toFixed(1)} minutos
      - Viagens Hoje: ${stats.totalTripsToday}
      - Tarefas Hoje: ${stats.totalTasksToday}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Não foi possível gerar insights no momento.";
  } catch (error) {
    console.error("Erro ao gerar insights:", error);
    return "Erro ao conectar com a IA para análise de dados.";
  }
};

export const chatWithAssistant = async (message: string, history: {role: string, parts: {text: string}[]}[] = []): Promise<string> => {
  const ai = getAIClient();
  if (!ai) return "Erro de configuração de API.";

  try {
    const chat = ai.chats.create({
      model: 'gemini-3-pro-preview',
      history: history,
      config: {
        systemInstruction: "Você é o assistente virtual do DriverPro, um app de logística. Ajude motoristas e gestores com dúvidas sobre rotas, manutenção de veículos e procedimentos de entrega. Seja conciso e útil.",
      },
    });

    const result = await chat.sendMessage({ message });
    return result.text || "Sem resposta.";
  } catch (error) {
    console.error("Erro no Chatbot:", error);
    return "Desculpe, estou indisponível no momento.";
  }
};

export const transcribeAudio = async (base64Audio: string, mimeType: string): Promise<string> => {
  const ai = getAIClient();
  if (!ai) return "";

  try {
    // Remove header data URL se existir (ex: "data:audio/webm;base64,")
    const cleanBase64 = base64Audio.includes(',') ? base64Audio.split(',')[1] : base64Audio;
    
    // console.log("Enviando áudio para Gemini:", mimeType, cleanBase64.substring(0, 50) + "...");

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: cleanBase64
            }
          },
          { text: "Transcreva este áudio fielmente. Apenas o texto falado." }
        ]
      }
    });

    return response.text || "";
  } catch (error) {
    console.error("Erro na transcrição:", error);
    return "";
  }
};

export const askMapsGrounding = async (query: string, userLocation?: {lat: number, lng: number}): Promise<string> => {
  const ai = getAIClient();
  if (!ai) return "Erro de configuração.";

  try {
    const config: any = {
      tools: [{ googleMaps: {} }],
    };

    // Adiciona localização se disponível para melhorar a resposta
    if (userLocation) {
      config.toolConfig = {
        googleSearchRetrieval: {
             dynamicRetrievalConfig: {
                mode: "MODE_DYNAMIC",
                dynamicThreshold: 0.7,
             }
        }
      };
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Contexto: O usuário é um motorista. Localização atual: ${userLocation ? `${userLocation.lat}, ${userLocation.lng}` : 'Desconhecida'}. Pergunta: ${query}`,
      config: config
    });

    return response.text || "Não encontrei informações sobre isso no Maps.";
  } catch (error) {
    console.error("Erro no Maps Grounding:", error);
    return "Erro ao consultar o Google Maps.";
  }
};

export const generatePromoVideo = async (prompt: string): Promise<string | null> => {
  const ai = getAIClient();
  if (!ai) {
      throw new Error("API Key não encontrada.");
  }

  try {
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt,
      config: {
        numberOfVideos: 1,
        resolution: '720p', 
        aspectRatio: '16:9'
      }
    });

    // Polling loop
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s
      operation = await ai.operations.getVideosOperation({operation: operation});
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) return null;

    // Fetch the video bytes using the key
    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    const blob = await response.blob();
    return URL.createObjectURL(blob);

  } catch (error) {
    console.error("Erro ao gerar vídeo:", error);
    throw error;
  }
};