import { TeamsActivityHandler, TurnContext } from "botbuilder";
import axios, { AxiosRequestConfig } from "axios";
import 'dotenv/config';

// URL e chave de API do AnythingLLM (recomenda-se armazenar em variáveis de ambiente)
const ANYTHING_LLM_API_URL = process.env.ANYTHING_LLM_API_URL || 'http://localhost:3001/api/v1';
const ANYTHING_LLM_API_KEY = process.env.ANYTHING_LLM_API_KEY || '';

export class TeamsBot extends TeamsActivityHandler {
  constructor() {
    super();

    this.onMessage(async (context, next) => {
      console.log("Mensagem recebida.");

      const userMessage = this.formatUserMessage(context.activity);

      try {
        await this.checkAuth();
        const slug = 'sicoob-teste';
        const slugThread = await this.createChat(slug);

        const llmResponse = await this.sendMessageToLLM(slug, slugThread, userMessage);

        await context.sendActivity(llmResponse || 'Nenhuma resposta do AnythingLLM.');
      } catch (error) {
        console.error('Erro ao se comunicar com o AnythingLLM:', error.message);
        await context.sendActivity('Desculpe, ocorreu um problema ao processar sua mensagem.');
      }

      await next();
    });

    this.onMembersAdded(async (context, next) => {
      for (const member of context.activity.membersAdded) {
        if (member.id) {
          await context.sendActivity(
            `Olá! Estou integrado com o AnythingLLM. Pergunte-me algo!`
          );
          break;
        }
      }
      await next();
    });
  }

  private formatUserMessage(activity: any): string {
    const removedMentionText = TurnContext.removeRecipientMention(activity);
    return removedMentionText ? removedMentionText.toLowerCase().replace(/\n|\r/g, "").trim() : '';
  }

  private async httpRequest(method: string, url: string, data?: any): Promise<any> {
    const config: AxiosRequestConfig = {
      method,
      url,
      headers: {
        'Authorization': `Bearer ${ANYTHING_LLM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      data,
    };

    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      throw new Error(`Erro na requisição para ${url}: ${error.response?.data?.message || error.message}`);
    }
  }

  private async checkAuth(): Promise<void> {
    await this.httpRequest('GET', `${ANYTHING_LLM_API_URL}/auth`);
  }

  private async createChat(slug: string): Promise<string> {
    const response = await this.httpRequest('POST', `${ANYTHING_LLM_API_URL}/workspace/${slug}/thread/new`);
    return response?.thread?.slug || '';
  }

  private async sendMessageToLLM(slug: string, slugThread: string, message: string): Promise<string> {
    const requestBody = {
      message,
      mode: 'chat',
    };

    const response = await this.httpRequest(
      'POST',
      `${ANYTHING_LLM_API_URL}/workspace/${slug}/thread/${slugThread}/chat`,
      requestBody
    );

    return response?.textResponse || 'Nenhuma resposta recebida.';
  }
}
