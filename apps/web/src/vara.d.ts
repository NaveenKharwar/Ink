// Vara ships no types; this is the part Ink uses.
declare module "vara" {
  type VaraText = {
    text: string;
    fontSize?: number;
    strokeWidth?: number;
    color?: string;
    duration?: number;
    textAlign?: "left" | "center" | "right";
    width?: number;
    delay?: number;
    x?: number;
    y?: number;
  };
  export default class Vara {
    constructor(selector: string, fontSource: string, texts: VaraText[], properties?: Record<string, unknown>);
    /** Called once the font has loaded and the text is laid out, before it is drawn. */
    ready(callback: () => void): void;
  }
}
