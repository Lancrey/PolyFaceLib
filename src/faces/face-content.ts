export interface TextFaceContent {
  type: 'text';
  text: string;
  className?: string;
}

export interface ImageFaceContent {
  type: 'image';
  src: string;
  alt?: string;
  /** CSS object-fit. Default 'cover'. */
  fit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  className?: string;
}

export interface HtmlFaceContent {
  type: 'html';
  /** A trusted HTML string. Caller is responsible for sanitization. */
  html?: string;
  /** Or, an existing element to be appended directly. */
  element?: HTMLElement;
  className?: string;
}

export interface ComponentFaceContent {
  type: 'component';
  /**
   * Mount the framework component into the provided face content element.
   * Return an unmount callback.
   */
  mount: (faceContentEl: HTMLElement) => (() => void) | void;
}

export type FaceContent =
  | TextFaceContent
  | ImageFaceContent
  | HtmlFaceContent
  | ComponentFaceContent;

/**
 * Apply a FaceContent definition into a face-content element. Returns a
 * disposer that should be called when the face is replaced or destroyed.
 */
export function applyFaceContent(
  contentEl: HTMLElement,
  content: FaceContent,
): () => void {
  contentEl.innerHTML = '';
  contentEl.className = 'pf-face__content';

  switch (content.type) {
    case 'text': {
      const node = document.createElement('div');
      node.className = `pf-face__text ${content.className ?? ''}`.trim();
      node.textContent = content.text;
      contentEl.appendChild(node);
      return () => { contentEl.innerHTML = ''; };
    }
    case 'image': {
      const img = document.createElement('img');
      img.src = content.src;
      img.alt = content.alt ?? '';
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = content.fit ?? 'cover';
      img.className = `pf-face__image ${content.className ?? ''}`.trim();
      contentEl.appendChild(img);
      return () => { contentEl.innerHTML = ''; };
    }
    case 'html': {
      if (content.element) {
        contentEl.appendChild(content.element);
      } else if (content.html != null) {
        contentEl.innerHTML = content.html;
      }
      if (content.className) contentEl.classList.add(...content.className.split(/\s+/).filter(Boolean));
      return () => { contentEl.innerHTML = ''; };
    }
    case 'component': {
      const dispose = content.mount(contentEl);
      return () => {
        if (typeof dispose === 'function') dispose();
        contentEl.innerHTML = '';
      };
    }
  }
}
