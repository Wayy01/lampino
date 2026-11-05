/* Browser page translators (Chrome/Google Translate, Edge, Yandex) swap the
   page's text nodes for their own <font> wrappers. React still holds the
   originals, so its next DOM update calls removeChild/insertBefore on a node
   that is no longer there and the whole app falls through to global-error.

   Both root layouts set translate="no"; this is the safety net for translators
   that ignore it. Loaded as an async hoistable <script src> from both layouts
   (React 19 warns about executable inline scripts rendered in the tree, but not
   about async src resources). It patches the prototypes before React's first
   post-hydration reconciliation, turning the fatal "not a child of this node"
   into a no-op. Keep this in sync with any inline fallback. */
(function () {
  if (typeof Node !== "function" || !Node.prototype) return;
  var removeChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function (child) {
    if (child.parentNode !== this) return child;
    return removeChild.apply(this, arguments);
  };
  var insertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function (node, ref) {
    if (ref && ref.parentNode !== this) return node;
    return insertBefore.apply(this, arguments);
  };
})();
