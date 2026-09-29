// jsdom has no canvas backend: make getContext() return null (the runtime then keeps ink as
// vectors only) instead of logging "not implemented".
HTMLCanvasElement.prototype.getContext = (() =>
  null) as typeof HTMLCanvasElement.prototype.getContext;
