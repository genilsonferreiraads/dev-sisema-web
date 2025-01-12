export const YOUTUBE_API_KEYS = [
  process.env.REACT_APP_YOUTUBE_API_KEY_1 || '',
  process.env.REACT_APP_YOUTUBE_API_KEY_2 || '',
  process.env.REACT_APP_YOUTUBE_API_KEY_3 || '',
  process.env.REACT_APP_YOUTUBE_API_KEY_4 || '',
  process.env.REACT_APP_YOUTUBE_API_KEY_5 || '',
  process.env.REACT_APP_YOUTUBE_API_KEY_6 || '',
].filter(key => key !== '');

export const getApiKeys = () => [...YOUTUBE_API_KEYS];

const CACHE_DURATION = 1000 * 60 * 60; // 1 hora

interface CacheItem {
  data: any;
  timestamp: number;
}

const cache = new Map<string, CacheItem>();
const apiUsage = new Map<string, number>();

// Variável para armazenar a última API que funcionou
let lastWorkingApiKey: string | null = null;

export const tryFetchWithFallback = async (url: string, apiKeys: readonly string[]) => {
  let lastError = null;
  
  // Reorganiza as APIs para tentar primeiro a última que funcionou
  const sortedApiKeys = [...apiKeys].sort((a, b) => {
    if (a === lastWorkingApiKey) return -1;
    if (b === lastWorkingApiKey) return 1;
    return 0;
  });

  console.log('Ordem das APIs:', sortedApiKeys.map(key => key.substring(0, 8) + '...'));

  for (const apiKey of sortedApiKeys) {
    try {
      console.log('Tentando API:', apiKey.substring(0, 8) + '...');
      const finalUrl = url.replace('API_KEY', apiKey);
      
      const response = await fetch(finalUrl);
      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error?.message || 'Unknown error';
        console.error(`API ${apiKey.substring(0, 8)}... falhou:`, errorMessage);
        
        if (errorMessage.includes('quota')) {
          console.log('Quota excedida, tentando próxima API...');
          throw new Error(`Quota excedida para API ${apiKey.substring(0, 8)}...`);
        }
        
        throw new Error(errorMessage);
      }
      
      lastWorkingApiKey = apiKey;
      console.log('API funcionou e foi salva:', apiKey.substring(0, 8) + '...');
      
      trackApiUsage(apiKey);
      return data;
    } catch (error) {
      console.error(`API ${apiKey.substring(0, 8)}... falhou com erro:`, error);
      lastError = error;
      
      if (apiKey === lastWorkingApiKey) {
        console.log('Limpando registro da última API funcionante');
        lastWorkingApiKey = null;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.error('Todas as APIs falharam. Último erro:', lastError);
  throw lastError;
};

export const fetchWithCache = async (url: string, apiKeys: readonly string[]) => {
  const cacheKey = url.replace(/key=API_KEY/, '');
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('Usando dados do cache para:', cacheKey);
    return cached.data;
  }

  const data = await tryFetchWithFallback(url, [...apiKeys]);
  cache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
};

export const trackApiUsage = (apiKey: string) => {
  const current = apiUsage.get(apiKey) || 0;
  apiUsage.set(apiKey, current + 1);
  console.log(`API Usage - ${apiKey.substring(0, 8)}...`, current + 1);
};

export const clearCache = () => {
  cache.clear();
  console.log('Cache limpo');
}; 