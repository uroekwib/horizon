import { Component } from '@theme/component';
import { debounce, onDocumentLoaded, setHeaderMenuStyle } from '@theme/utilities';
import { MegaMenuHoverEvent } from '@theme/events';

/**
 * A custom element that manages a header menu.
 *
 * @typedef {Object} State
 * @property {HTMLElement | null} activeItem - The currently active menu item.
 *
 * @typedef {object} Refs
 * @property {HTMLElement} overflowMenu - The overflow menu.
 * @property {HTMLElement[]} [submenu] - The submenu in each respective menu item.
 *
 * @extends {Component<Refs>}
 */
class HeaderMenu extends Component {
  requiredRefs = ['overflowMenu'];

  /**
   * @type {MutationObserver | null}
   */
  #submenuMutationObserver = null;

  /**
   * Timer for closing when mouse leaves the visible Mega Menu horizontally.
   * @type {number | null}
   */
  #horizontalExitTimer = null;

  connectedCallback() {
    super.connectedCallback();

    onDocumentLoaded(this.#preloadImages);
    window.addEventListener('resize', this.#resizeListener);

    document.addEventListener('pointermove', this.#horizontalExitListener, {
      passive: true,
    });

    this.overflowMenu?.addEventListener(
      'pointerleave',
      this.#overflowSubmenuListener
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    window.removeEventListener('resize', this.#resizeListener);
    document.removeEventListener('pointermove', this.#horizontalExitListener);

    this.overflowMenu?.removeEventListener(
      'pointerleave',
      this.#overflowSubmenuListener
    );

    this.#clearHorizontalExitTimer();
    this.#cleanupMutationObserver();
  }

  /**
   * Debounced resize event listener to recalculate menu style
   */
  #resizeListener = debounce(() => {
    setHeaderMenuStyle();
  }, 100);

  #overflowSubmenuListener = () => {
    this.#deactivate();
  };

  /**
   * Close Mega Menu when mouse moves outside the visible panel
   * on the left or right side.
   *
   * @param {PointerEvent} event
   */
  #horizontalExitListener = (event) => {
    if (event.pointerType !== 'mouse') return;

    const activeItem = this.#state.activeItem;

    if (!activeItem) {
      this.#clearHorizontalExitTimer();
      return;
    }

    const submenu = findSubmenu(activeItem);

    if (!submenu) {
      this.#clearHorizontalExitTimer();
      return;
    }

    const submenuInner = submenu.querySelector(
      '.menu-list__submenu-inner'
    );

    const megaMenu = submenu.querySelector('.mega-menu');
    const megaMenuGrid = submenu.querySelector('.mega-menu__grid');

    if (!(submenuInner instanceof HTMLElement)) return;

    let visiblePanel =
      megaMenu instanceof HTMLElement ? megaMenu : megaMenuGrid;

    /*
     * If .mega-menu is still full width,
     * use the narrower .mega-menu__grid instead.
     */
    if (
      visiblePanel instanceof HTMLElement &&
      megaMenuGrid instanceof HTMLElement
    ) {
      const submenuWidth = submenu.getBoundingClientRect().width;
      const panelWidth = visiblePanel.getBoundingClientRect().width;

      if (panelWidth >= submenuWidth - 4) {
        visiblePanel = megaMenuGrid;
      }
    }

    if (!(visiblePanel instanceof HTMLElement)) return;

    const innerRect = submenuInner.getBoundingClientRect();
    const panelRect = visiblePanel.getBoundingClientRect();

    if (
      innerRect.width <= 0 ||
      innerRect.height <= 0 ||
      panelRect.width <= 0 ||
      panelRect.height <= 0
    ) {
      return;
    }

    /*
     * Allow a small safe area around the visible menu.
     */
    const horizontalBuffer = 16;
    const verticalBuffer = 8;

    const isWithinMenuHeight =
      event.clientY >= innerRect.top - verticalBuffer &&
      event.clientY <= innerRect.bottom + verticalBuffer;

    const isOutsideMenuWidth =
      event.clientX < panelRect.left - horizontalBuffer ||
      event.clientX > panelRect.right + horizontalBuffer;

    /*
     * Mouse is inside the real Mega Menu,
     * above it or below it: keep original behaviour.
     */
    if (!isWithinMenuHeight || !isOutsideMenuWidth) {
      this.#clearHorizontalExitTimer();
      return;
    }

    /*
     * Already waiting to close. Do not create another timer.
     */
    if (this.#horizontalExitTimer !== null) return;

    /*
     * Small delay prevents accidental closing near the edge.
     */
    this.#horizontalExitTimer = window.setTimeout(() => {
      this.#horizontalExitTimer = null;

      if (this.#state.activeItem === activeItem) {
        this.#deactivate(activeItem);
      }
    }, 120);
  };

  #clearHorizontalExitTimer() {
    if (this.#horizontalExitTimer === null) return;

    clearTimeout(this.#horizontalExitTimer);
    this.#horizontalExitTimer = null;
  }

  /**
   * @type {State}
   */
  #state = {
    activeItem: null,
  };

  /**
   * Get the overflow menu
   */
  get overflowMenu() {
    return /** @type {HTMLElement | null} */ (
      this.refs.overflowMenu?.shadowRoot?.querySelector('[part="overflow"]')
    );
  }

  /**
   * Whether the overflow list is hovered
   * @returns {boolean}
   */
  get overflowListHovered() {
    return (
      this.refs.overflowMenu?.shadowRoot
        ?.querySelector('[part="overflow-list"]')
        ?.matches(':hover') ?? false
    );
  }

  get headerComponent() {
    return /** @type {HTMLElement | null} */ (
      this.closest('header-component')
    );
  }

  /**
   * Activate the selected menu item immediately
   * @param {PointerEvent | FocusEvent} event
   */
  activate = (event) => {
    this.dispatchEvent(new MegaMenuHoverEvent());

    if (!(event.target instanceof Element) || !this.headerComponent) return;

    const item = findMenuItem(event.target);

    if (!item || item == this.#state.activeItem) return;

    this.#clearHorizontalExitTimer();

    const isDefaultSlot = event.target.slot === '';

    this.dataset.overflowExpanded = (!isDefaultSlot).toString();

    const previouslyActiveItem = this.#state.activeItem;

    if (previouslyActiveItem) {
      previouslyActiveItem.ariaExpanded = 'false';
    }

    this.#state.activeItem = item;
    this.ariaExpanded = 'true';
    item.ariaExpanded = 'true';

    let submenu = findSubmenu(item);
    const hasSubmenu = Boolean(submenu);

    if (!hasSubmenu && !isDefaultSlot) {
      submenu = this.overflowMenu;
    }

    if (submenu) {
      // Mark submenu as active for content-visibility optimization
      submenu.dataset.active = '';

      // Cleanup any existing mutation observer from previous menu activations
      this.#cleanupMutationObserver();

      // Monitor DOM mutations to catch deferred content injection
      this.#submenuMutationObserver = new MutationObserver(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (submenu.offsetHeight > 0) {
              this.headerComponent?.style.setProperty(
                '--submenu-height',
                `${submenu.offsetHeight}px`
              );

              this.#cleanupMutationObserver();
            }
          });
        });
      });

      this.#submenuMutationObserver.observe(submenu, {
        childList: true,
        subtree: true,
      });

      // Auto-disconnect after 500ms to prevent memory leaks
      setTimeout(() => {
        this.#cleanupMutationObserver();
      }, 500);
    }

    let finalHeight = submenu?.offsetHeight || 0;

    // For overflow menu, use submenu content or total menu link height
    if (!isDefaultSlot) {
      const overflowListHeight = this.#getOverflowListLinksHeight();

      if (hasSubmenu) {
        const overflowHeight = this.overflowMenu?.offsetHeight || 0;
        finalHeight = Math.max(overflowHeight, overflowListHeight);
      } else {
        finalHeight = overflowListHeight;
      }
    }

    if (!submenu) {
      finalHeight = 0;
    }

    this.headerComponent.style.setProperty(
      '--submenu-height',
      `${finalHeight}px`
    );

    this.#setFullOpenHeaderHeight(finalHeight);
    this.style.setProperty('--submenu-opacity', '1');
  };

  /**
   * Deactivate the active item after a delay
   * @param {PointerEvent | FocusEvent} event
   */
  deactivate(event) {
    if (!(event.target instanceof Element)) return;

    const menu = findSubmenu(this.#state.activeItem);

    const isMovingWithinMenu =
      event.relatedTarget instanceof Node &&
      menu?.contains(document.activeElement);

    const isMovingToSubmenu =
      event.relatedTarget instanceof Node &&
      event.type === 'blur' &&
      menu?.contains(event.relatedTarget);

    const isMovingToOverflowMenu =
      event.relatedTarget instanceof Node &&
      event.relatedTarget.parentElement?.matches('[slot="overflow"]');

    if (
      isMovingWithinMenu ||
      isMovingToOverflowMenu ||
      isMovingToSubmenu
    ) {
      return;
    }

    this.#deactivate();
  }

  /**
   * Deactivate the active item immediately
   * @param {HTMLElement | null} [item]
   */
  #deactivate = (item = this.#state.activeItem) => {
    if (!item || item != this.#state.activeItem) return;

    // Don't deactivate if overflow menu or overflow list is hovered
    if (
      this.overflowListHovered ||
      this.overflowMenu?.matches(':hover')
    ) {
      return;
    }

    this.#clearHorizontalExitTimer();

    this.headerComponent?.style.setProperty('--submenu-height', '0px');
    this.#setFullOpenHeaderHeight(0);
    this.style.setProperty('--submenu-opacity', '0');
    this.dataset.overflowExpanded = 'false';

    const submenu = findSubmenu(item);

    this.#state.activeItem = null;
    this.ariaExpanded = 'false';
    item.ariaExpanded = 'false';

    if (submenu) {
      delete submenu.dataset.active;
    }
  };

  #getOverflowListLinksHeight() {
    const slottedMenuLinks =
      this.overflowMenu?.querySelector('slot')?.assignedElements();

    if (!slottedMenuLinks) {
      return this.overflowMenu?.offsetHeight || 0;
    }

    /**
     * @param {(submenu: HTMLElement) => void} cb
     */
    const mapSubmenus = (cb) => {
      slottedMenuLinks.forEach((link) => {
        const submenu = /** @type {HTMLElement | null} */ (
          link.querySelector('[ref="submenu[]"]')
        );

        if (submenu) {
          cb(submenu);
        }
      });
    };

    mapSubmenus((submenu) => {
      submenu.style.setProperty('display', 'none');
    });

    const height = this.overflowMenu?.offsetHeight || 0;

    mapSubmenus((submenu) => {
      submenu.style.removeProperty('display');
    });

    return height;
  }

  /**
   * Calculate and set the full open header height.
   * @param {number} submenuHeight
   */
  #setFullOpenHeaderHeight(submenuHeight) {
    if (!this.headerComponent) return;

    const isOverlapSituation =
      this.headerComponent.hasAttribute(
        'data-submenu-overlap-bottom-row'
      );

    const headerVisibleHeight =
      isOverlapSituation && this.headerComponent.offsetHeight > 0
        ? /** @type {HTMLElement | null} */ (
            this.headerComponent.querySelector('.header__row--top')
          )?.offsetHeight ?? 0
        : this.headerComponent.offsetHeight;

    const nothingToOpen = submenuHeight === 0;

    const fullOpenHeaderHeight = nothingToOpen
      ? 0
      : submenuHeight + (headerVisibleHeight ?? 0);

    this.headerComponent.style.setProperty(
      '--full-open-header-height',
      `${fullOpenHeaderHeight}px`
    );
  }

  /**
   * Preload images that are set to load lazily.
   */
  #preloadImages = () => {
    const images = this.querySelectorAll('img[loading="lazy"]');

    images?.forEach((image) => {
      image.removeAttribute('loading');
    });
  };

  #cleanupMutationObserver() {
    this.#submenuMutationObserver?.disconnect();
    this.#submenuMutationObserver = null;
  }
}

if (!customElements.get('header-menu')) {
  customElements.define('header-menu', HeaderMenu);
}

/**
 * Find the closest menu item.
 * @param {Element | null | undefined} element
 * @returns {HTMLElement | null}
 */
function findMenuItem(element) {
  if (!(element instanceof Element)) return null;

  if (element.matches('[slot="more"]')) {
    // Select the first overflowing menu item when hovering over More
    return findMenuItem(
      element.parentElement?.querySelector('[slot="overflow"]')
    );
  }

  return element.querySelector('[ref="menuitem"]');
}

/**
 * Find the closest submenu.
 * @param {Element | null | undefined} element
 * @returns {HTMLElement | null}
 */
function findSubmenu(element) {
  const submenu =
    element?.parentElement?.querySelector('[ref="submenu[]"]');

  return submenu instanceof HTMLElement ? submenu : null;
}