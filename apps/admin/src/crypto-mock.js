export const createHash = () => ({ update: () => ({ digest: () => "" }) });
export const createHmac = () => ({ update: () => ({ digest: () => "" }) });
export const randomBytes = (size) => {
  const arr = new Uint8Array(size);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(arr);
  }
  return {
    toString: (enc) => {
      if (enc === 'hex') {
        return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
      }
      return '';
    }
  };
};
export const timingSafeEqual = () => false;
