function s(r){return r!==null&&typeof r=="object"&&!Array.isArray(r)?r:{}}function i(r){return Array.isArray(r)?r.map(s):[]}function a(r,...t){for(const o of t){const n=r[o];if(n!=null&&n!=="")return typeof n=="object"?JSON.stringify(n):String(n)}return"—"}export{s as a,i as b,a as d};
//# sourceMappingURL=records-8Tl9Ziws.js.map
