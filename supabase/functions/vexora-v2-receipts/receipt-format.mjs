const startsWith = (bytes, signature, offset = 0) =>
  signature.every((value, index) => bytes[offset + index] === value);

export function receiptType(bytes) {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { extension: 'pdf', mime: 'application/pdf' };
  if (startsWith(bytes, [137, 80, 78, 71, 13, 10, 26, 10])) return { extension: 'png', mime: 'image/png' };
  if (startsWith(bytes, [255, 216, 255])) return { extension: 'jpg', mime: 'image/jpeg' };
  if (startsWith(bytes, [82, 73, 70, 70]) && startsWith(bytes, [87, 69, 66, 80], 8)) {
    return { extension: 'webp', mime: 'image/webp' };
  }
  return null;
}
