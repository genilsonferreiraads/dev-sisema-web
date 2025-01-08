declare module '@foobar404/wave' {
  export default class Wave {
    constructor(canvas: HTMLCanvasElement, options?: {
      type?: string;
      colors?: string[];
      stroke?: number;
      scale?: number;
      smoothing?: number;
      spacing?: number;
      mirroredX?: boolean;
      mirroredY?: boolean;
      center?: boolean;
    });

    fromElement(element: HTMLMediaElement): void;
    clearAnimation(): void;
  }
} 