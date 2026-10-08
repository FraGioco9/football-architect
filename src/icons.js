// Shared outline SVG icons: consistent stroke, alignment and accessible decorative markup.
const paths={
 shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
 'plus-circle':'<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
 'folder-open':'<path d="M3 7V5a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v2"/><path d="M3 10h18l-3 10H6L3 10Z"/>',
 settings:'<circle cx="12" cy="12" r="3"/><path d="M19.5 14 22 15.5l-2 3.5-2.6-1a8 8 0 0 1-2.2 1.3L14.7 22h-4l-.5-2.7A8 8 0 0 1 8 18l-2.6 1-2-3.5L6 14a8 8 0 0 1 0-3L3.4 9.5l2-3.5L8 7a8 8 0 0 1 2.2-1.3L10.7 3h4l.5 2.7A8 8 0 0 1 17.4 7L20 6l2 3.5-2.5 1.5a8 8 0 0 1 0 3Z"/>',
 'chevron-right':'<path d="m9 18 6-6-6-6"/>',
 'chevron-down':'<path d="m6 9 6 6 6-6"/>',
 'arrow-left':'<path d="m12 19-7-7 7-7M19 12H5"/>',
 flag:'<path d="M4 22V4M4 4c3-2 6 2 9 0s6-2 8 0v11c-2-2-5-2-8 0S7 13 4 15"/>',
 check:'<path d="m5 12 4 4L19 6"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 play:'<path d="m8 5 11 7-11 7V5Z"/>',
 pause:'<path d="M8 5v14M16 5v14"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
 download:'<path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v4h16v-4"/>',
 upload:'<path d="M12 17V5m0 0 4 4m-4-4-4 4M4 17v4h16v-4"/>',
 trash:'<path d="M3 6h18M8 6V4h8v2m-11 0 1 15h12l1-15M10 10v7M14 10v7"/>',
 pencil:'<path d="m4 20 5-.8L20 8a2 2 0 0 0-4-4L5 15Z"/>',
 'alert-triangle':'<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5M12 17h.01"/>',
 'refresh-cw':'<path d="M20 11a8 8 0 0 0-14.6-4M4 4v4h4M4 13a8 8 0 0 0 14.6 4M20 20v-4h-4"/>',
 x:'<path d="M18 6 6 18M6 6l12 12"/>',
};
export function icon(name,size=18){
 const path=paths[name];
 if(!path)throw new Error('Unknown icon: '+name);
 return `<svg class="fa-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${path}</svg>`;
}
