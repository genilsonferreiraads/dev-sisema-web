export const YOUTUBE_API_KEYS = [
  process.env.REACT_APP_YOUTUBE_API_KEY_1 || '',
  process.env.REACT_APP_YOUTUBE_API_KEY_2 || '',
  process.env.REACT_APP_YOUTUBE_API_KEY_3 || '',
  // ... adicione mais chaves conforme necessário
].filter(key => key !== '');

// ... resto do código ... 