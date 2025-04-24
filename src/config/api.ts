export const YOUTUBE_API_KEYS = [
  process.env.REACT_APP_YOUTUBE_API_KEY_1 || '',
  process.env.REACT_APP_YOUTUBE_API_KEY_2 || '',
  process.env.REACT_APP_YOUTUBE_API_KEY_3 || '',
  process.env.REACT_APP_YOUTUBE_API_KEY_4 || '',
  process.env.REACT_APP_YOUTUBE_API_KEY_5 || '',
  process.env.REACT_APP_YOUTUBE_API_KEY_6 || '',
].filter(key => key !== '');

const geminiKey = process.env.REACT_APP_GEMINI_API_KEY;

export const TTS_API_KEYS = {
  google: process.env.REACT_APP_GOOGLE_TTS_API_KEY || '',
  gemini: process.env.REACT_APP_GEMINI_API_KEY || '',
  elevenlabs: process.env.REACT_APP_ELEVENLABS_API_KEY || ''
};

export const getApiKeys = () => [...YOUTUBE_API_KEYS];

const CACHE_DURATION = 1000 * 60 * 60; // 1 hora

interface CacheItem {
  data: any;
  timestamp: number;
}

const cache = new Map<string, CacheItem>();
const apiUsage = new Map<string, number>();

let lastWorkingApiKey: string | null = null;

export const BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://imperiofitness.netlify.app'
  : 'http://localhost:3000';

export const tryFetchWithFallback = async (url: string, apiKeys: readonly string[]) => {
  let lastError = null;
  
  const sortedApiKeys = [...apiKeys].sort((a, b) => {
    if (a === lastWorkingApiKey) return -1;
    if (b === lastWorkingApiKey) return 1;
    return 0;
  });

  for (const apiKey of sortedApiKeys) {
    try {
      const finalUrl = url.replace('API_KEY', apiKey);
      
      const response = await fetch(finalUrl);
      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error?.message || 'Unknown error';
        if (errorMessage.includes('quota')) {
          throw new Error(`Quota excedida para API ${apiKey.substring(0, 8)}...`);
        }
        throw new Error(errorMessage);
      }
      
      lastWorkingApiKey = apiKey;
      trackApiUsage(apiKey);
      return data;
    } catch (error) {
      lastError = error;
      
      if (apiKey === lastWorkingApiKey) {
        lastWorkingApiKey = null;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  throw lastError;
};

export const fetchWithCache = async (url: string, apiKeys: readonly string[]) => {
  const cacheKey = url.replace(/key=API_KEY/, '');
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  const data = await tryFetchWithFallback(url, [...apiKeys]);
  cache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
};

export const trackApiUsage = (apiKey: string) => {
  const current = apiUsage.get(apiKey) || 0;
  apiUsage.set(apiKey, current + 1);
};

export const clearCache = () => {
  cache.clear();
};