declare namespace YT {
  interface Player {
    playVideo(): void;
    pauseVideo(): void;
    stopVideo(): void;
    seekTo(seconds: number, allowSeekAhead: boolean): void;
    getPlayerState(): number;
    getCurrentTime(): number;
    getDuration(): number;
    setVolume(volume: number): void;
    getVolume(): number;
    destroy(): void;
  }

  interface PlayerEvent {
    target: Player;
    data: number;
  }

  interface PlayerOptions {
    height?: string | number;
    width?: string | number;
    videoId?: string;
    playerVars?: {
      autoplay?: 0 | 1;
      controls?: 0 | 1;
      enablejsapi?: 0 | 1;
      origin?: string;
      playsinline?: 0 | 1;
      rel?: 0 | 1;
      modestbranding?: 0 | 1;
    };
    events?: {
      onReady?: (event: PlayerEvent) => void;
      onStateChange?: (event: PlayerEvent) => void;
      onError?: (event: PlayerEvent) => void;
    };
  }
}

interface Window {
  YT: {
    Player: {
      new(elementId: string, options: YT.PlayerOptions): YT.Player;
    };
  };
  onYouTubeIframeAPIReady: () => void;
} 