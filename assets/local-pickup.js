import { Component } from '@theme/component';
import { morph } from '@theme/morph';
import { ThemeEvents, VariantUpdateEvent } from '@theme/events';

class LocalPickup extends Component {
  /** @type {AbortController | undefined} */
  #activeFetch;

  connectedCallback() {
    super.connectedCallback();

    const closestSection = this.closest('.shopify-section, dialog');

    /** @type {(event: VariantUpdateEvent) => void} */
    const variantUpdated = (event) => {
      if (event.detail.data?.newProduct) {
        this.dataset.productUrl = event.detail.data.newProduct.url;
      }

      const variantId = event.detail.resource?.id || null;
      const variantAvailable = event.detail.resource?.available || false;

      if (variantId !== this.dataset.variantId) {
        if (variantId && variantAvailable) {
          this.dataset.variantId = String(variantId);
          this.removeAttribute('hidden');
          this.#fetchAvailability(String(variantId));
        } else {
          this.dataset.variantId = '';
          this.setAttribute('hidden', '');
        }
      }
    };

    closestSection?.addEventListener(ThemeEvents.variantUpdate, variantUpdated);

    this.disconnectedCallback = () => {
      closestSection?.removeEventListener(ThemeEvents.variantUpdate, variantUpdated);
      this.#activeFetch?.abort();
    };
  }

  #createAbortController() {
    if (this.#activeFetch) this.#activeFetch.abort();
    this.#activeFetch = new AbortController();
    return this.#activeFetch;
  }

  #appendCustomNotice() {
    const oldNotice = this.querySelector('.local-pickup-custom-note');
    if (oldNotice) oldNotice.remove();

    this.insertAdjacentHTML(
      'beforeend',
      `
        <div class="local-pickup-custom-note">
          สินค้ากลุ่มป้ายสั่งทำพิเศษ ใช้เวลา 5-7 วัน++
        </div>
      `
    );
  }

  /**
   * Fetches the availability of a variant.
   * @param {string} variantId
   */
  #fetchAvailability = (variantId) => {
    if (!variantId || !this.dataset.productUrl || !this.dataset.sectionId) return;

    const abortController = this.#createAbortController();
    const url = `${this.dataset.productUrl}?variant=${variantId}&section_id=${this.dataset.sectionId}`;

    fetch(url, { signal: abortController.signal })
      .then((response) => response.text())
      .then((text) => {
        if (abortController.signal.aborted) return;

        const html = new DOMParser().parseFromString(text, 'text/html');
        const wrapper = html.querySelector(`local-pickup[data-variant-id="${variantId}"]`);

        if (wrapper) {
          this.removeAttribute('hidden');
          morph(this, wrapper);
          this.#appendCustomNotice();
        } else {
          this.setAttribute('hidden', '');
        }
      })
      .catch((error) => {
        if (abortController.signal.aborted) return;
        console.error('Local pickup fetch failed:', error);
        this.setAttribute('hidden', '');
      });
  };
}

if (!customElements.get('local-pickup')) {
  customElements.define('local-pickup', LocalPickup);
}