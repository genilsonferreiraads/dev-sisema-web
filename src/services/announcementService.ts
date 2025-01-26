import { ANNOUNCEMENT_PROMPT } from '../config/prompts';

export const announcementService = {
  async generateAnnouncement(message: string): Promise<string> {
    try {
      // Aqui você integraria com o Gemini
      // Por enquanto, vou deixar um exemplo de como seria a estrutura
      const fullPrompt = `${ANNOUNCEMENT_PROMPT}\n\nEntrada: "${message}"\nGere um anúncio profissional seguindo as diretrizes acima.`;
      
      // Exemplo de resposta formatada (substitua pela integração real com o Gemini)
      const response = `Prezados Alunos,

Solicitamos gentilmente a todos que ${message}. Esta medida é fundamental para mantermos o ambiente da academia agradável e funcional para todos.

Contamos com a colaboração e compreensão de todos.

Atenciosamente,
Academia Império Fitness`;

      return response;
    } catch (error) {
      console.error('Erro ao gerar anúncio:', error);
      throw new Error('Não foi possível gerar o anúncio no momento.');
    }
  }
}; 