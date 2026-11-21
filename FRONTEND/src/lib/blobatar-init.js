import { blobatar } from 'https://cdn.jsdelivr.net/npm/blobatar/dist/index.js';
window.blobatar = blobatar;
window.dispatchEvent(new Event('blobatar-ready'));
