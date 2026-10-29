// Browser page translators (Chrome/Google Translate, Edge, Yandex) swap the
// page's text nodes for their own <font> wrappers. React still holds the
// originals, so its next DOM update — a client navigation, a cart change —
// calls removeChild/insertBefore on a node that is no longer there and the
// whole app falls through to global-error.tsx.
//
// The site is natively bilingual, so both root layouts set translate="no"
// (Chrome then doesn't offer to translate). This inline script is the safety
// net for translators and extensions that ignore that: it turns the fatal
// "not a child of this node" into a no-op. Must run before React hydrates.
export const TRANSLATE_GUARD_SCRIPT = `(function(){if(typeof Node!=="function"||!Node.prototype)return;var r=Node.prototype.removeChild;Node.prototype.removeChild=function(c){if(c.parentNode!==this)return c;return r.apply(this,arguments)};var i=Node.prototype.insertBefore;Node.prototype.insertBefore=function(n,ref){if(ref&&ref.parentNode!==this)return n;return i.apply(this,arguments)}})();`;
