import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import * as logger from 'firebase-functions/logger';
import { InventoryAnalysis } from '../types/analytics';

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY || '';
    this.genAI = new GoogleGenerativeAI(key);
    // Gemini 3 Flash - más rápido y económico
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-3.0-flash' });
  }

  /**
   * Analiza datos de inventario y genera insights inteligentes
   */
  async analyzeInventory(data: Partial<InventoryAnalysis>): Promise<string> {
    try {
      logger.info('Calling Gemini for inventory analysis', {
        criticalIssuesCount: data.recomendaciones?.length || 0
      });

      const prompt = this.buildInventoryPrompt(data);
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Calcular costo (Gemini Flash es gratis en tier gratuito)
      const usage = response.usageMetadata;
      const cost = this.calculateCost(
        usage?.promptTokenCount || 0,
        usage?.candidatesTokenCount || 0
      );

      logger.info('Gemini analysis completed', {
        inputTokens: usage?.promptTokenCount || 0,
        outputTokens: usage?.candidatesTokenCount || 0,
        cost: `$${cost.toFixed(4)}`
      });

      return text;
    } catch (error: any) {
      logger.error('Gemini API error', {
        error: error.message,
        stack: error.stack
      });
      throw new Error(`Gemini analysis failed: ${error.message}`);
    }
  }

  /**
   * Chat conversacional con contexto de inventario
   */
  async chat(question: string, context: any): Promise<{ answer: string; cost: number }> {
    try {
      logger.info('Chat request to Gemini', { question });

      const prompt = this.buildChatPrompt(question, context);
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      const usage = response.usageMetadata;
      const cost = this.calculateCost(
        usage?.promptTokenCount || 0,
        usage?.candidatesTokenCount || 0
      );

      logger.info('Chat response generated', {
        cost: `$${cost.toFixed(4)}`
      });

      return {
        answer: text,
        cost: cost
      };
    } catch (error: any) {
      logger.error('Gemini chat error', {
        error: error.message
      });
      throw new Error(`Gemini chat failed: ${error.message}`);
    }
  }

  /**
   * Construye el prompt para análisis de inventario
   */
  private buildInventoryPrompt(data: Partial<InventoryAnalysis>): string {
    return `Eres un experto en gestión de inventarios para retail presencial.

DATOS DEL INVENTARIO:
${JSON.stringify(data, null, 2)}

INSTRUCCIONES:
Analiza estos datos y proporciona:

1. **Resumen Ejecutivo** (5-8 puntos clave)
   - Situación general del inventario
   - Principales riesgos identificados
   - Oportunidades de optimización

2. **Alertas Críticas**
   - Quiebres de stock inminentes
   - Productos de alta rotación con bajo stock
   - Sobrestock problemático

3. **Recomendaciones Accionables**
   - Transferencias urgentes entre ubicaciones
   - Compras prioritarias
   - Promociones sugeridas para sobrestock
   - Ajustes de mínimos y máximos

4. **Insights Adicionales**
   - Patrones o tendencias detectadas
   - Sugerencias de mejora en procesos

Responde en español, de forma clara y profesional.`;
  }

  /**
   * Construye el prompt para chat conversacional
   */
  private buildChatPrompt(question: string, context: any): string {
    const brand = context?.brand || 'Iván Guaderrama Art';

    return `Eres un asistente experto en análisis de inventario para ${brand}.

CONTEXTO ACTUAL DEL INVENTARIO:
${JSON.stringify(context, null, 2)}

PREGUNTA DEL USUARIO:
${question}

INSTRUCCIONES:
- Responde en español de forma clara y profesional
- Si la pregunta requiere datos específicos que no están en el contexto, indícalo
- Proporciona recomendaciones accionables cuando sea apropiado
- Usa números y métricas concretas del contexto cuando estén disponibles
- Mantén un tono amigable pero profesional

Respuesta:`;
  }

  /**
   * Calcula el costo de la llamada a Gemini API
   * Gemini 3 Flash pricing (Enero 2026):
   * - Free tier: 1500 requests/día GRATIS
   * - Paid: $0.50 per 1M input tokens, $3.00 per 1M output tokens
   */
  private calculateCost(inputTokens: number, outputTokens: number): number {
    // Si estás en el tier gratuito (< 1500 req/día), el costo es $0
    // Para calcular el costo si superas el tier gratuito:
    const inputCost = (inputTokens / 1_000_000) * 0.50;
    const outputCost = (outputTokens / 1_000_000) * 3.00;
    return inputCost + outputCost;
  }

  /**
   * Verifica si la API key está configurada
   */
  isConfigured(): boolean {
    return !!process.env.GEMINI_API_KEY;
  }
}
