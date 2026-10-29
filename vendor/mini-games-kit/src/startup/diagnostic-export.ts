export type TextExportMethod = 'clipboard' | 'legacy-copy' | 'exposed';

export interface TextExportPorts {
  writeClipboard?: (text: string) => Promise<void>;
  legacyCopy?: (text: string) => boolean;
  expose?: (text: string) => void;
}

/**
 * Hosted game iframes can expose navigator.clipboard while rejecting writeText.
 * Failure therefore falls through instead of being treated as terminal.
 */
export const exportTextWithFallback = async (
  text: string,
  ports: TextExportPorts,
): Promise<TextExportMethod> => {
  if (ports.writeClipboard) {
    try {
      await ports.writeClipboard(text);
      return 'clipboard';
    } catch {
      // Continue to synchronous copy / visible selection fallbacks.
    }
  }

  if (ports.legacyCopy) {
    try {
      if (ports.legacyCopy(text)) return 'legacy-copy';
    } catch {
      // Continue to visible exposure.
    }
  }

  if (ports.expose) {
    ports.expose(text);
    return 'exposed';
  }

  throw new Error('No text export method succeeded');
};

export interface BrowserTextExportOptions {
  document?: Document;
  navigator?: Navigator;
  container?: HTMLElement;
  className?: string;
  ariaLabel?: string;
}

export interface BrowserTextExportResult {
  method: TextExportMethod;
  exposedElement: HTMLTextAreaElement | undefined;
}

export const copyOrExposeText = async (
  text: string,
  options: BrowserTextExportOptions = {},
): Promise<BrowserTextExportResult> => {
  const doc = options.document ?? (typeof document === 'undefined' ? undefined : document);
  const nav = options.navigator ?? (typeof navigator === 'undefined' ? undefined : navigator);
  let exposedElement: HTMLTextAreaElement | undefined;

  const createTextarea = (visible: boolean): HTMLTextAreaElement => {
    if (!doc) throw new Error('Document is unavailable for text export fallback');
    const textarea = doc.createElement('textarea');
    textarea.value = text;
    textarea.readOnly = true;
    textarea.setAttribute('aria-label', options.ariaLabel ?? 'Diagnostic output');
    if (options.className) textarea.className = options.className;
    if (visible) {
      textarea.rows = 8;
      textarea.style.width = '100%';
      textarea.style.maxHeight = '40vh';
    } else {
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.style.pointerEvents = 'none';
    }
    (options.container ?? doc.body).append(textarea);
    textarea.focus();
    textarea.select();
    return textarea;
  };

  const method = await exportTextWithFallback(text, {
    ...(nav?.clipboard?.writeText
      ? { writeClipboard: (value) => nav.clipboard.writeText(value) }
      : {}),
    ...(doc
      ? {
          legacyCopy: () => {
            const textarea = createTextarea(false);
            try {
              return typeof doc.execCommand === 'function' && doc.execCommand('copy');
            } finally {
              textarea.remove();
            }
          },
          expose: () => {
            exposedElement?.remove();
            exposedElement = createTextarea(true);
          },
        }
      : {}),
  });

  return { method, exposedElement };
};
