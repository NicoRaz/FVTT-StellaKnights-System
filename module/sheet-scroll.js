// Capture at DOM replacement, then restore after Foundry and render hooks finish.
export function PreserveSheetScroll(Base) {
  return class extends Base {
    _preSyncPartState(partId, newElement, priorElement, state) {
      super._preSyncPartState(partId, newElement, priorElement, state);
      if (partId === 'main') this._stellaScrollState = state;
    }
    async _postRender(context, options) {
      await super._postRender(context, options);
      const root = this.element?.querySelector('.stella-content');
      if (!root) return;
      for (const [selector, scrollTop, scrollLeft] of this._stellaScrollState?.scrollPositions ?? []) {
        const element = selector === '' ? root : root.querySelector(selector);
        if (element) Object.assign(element, {scrollTop, scrollLeft});
      }
    }
  };
}
