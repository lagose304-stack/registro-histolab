const { TextDecoder, TextEncoder } = globalThis;

function normalizeEncoding(enc) {
  if (!enc) return 'utf-8';
  const clean = String(enc).toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (clean === 'utf8' || clean === 'utf-8') return 'utf-8';
  if (clean === 'latin1' || clean === 'binary' || clean === 'iso-8859-1' || clean === 'iso88591') return 'iso-8859-1';
  if (clean === 'ascii') return 'windows-1252';
  return clean;
}

function getDecoder(encoding, options) {
  const enc = normalizeEncoding(encoding);
  let decoder;
  try {
    decoder = new TextDecoder(enc);
  } catch (e) {
    decoder = new TextDecoder('utf-8');
  }
  return {
    write(buf) {
      if (!buf) return '';
      if (typeof buf === 'string') return buf;
      return decoder.decode(buf, { stream: true });
    },
    end() {
      return decoder.decode();
    }
  };
}

function getEncoder(encoding, options) {
  const encoder = new TextEncoder();
  return {
    write(str) {
      return encoder.encode(str || '');
    },
    end() {
      return new Uint8Array(0);
    }
  };
}

function decode(buf, encoding, options) {
  if (!buf) return '';
  if (typeof buf === 'string') return buf;
  const enc = normalizeEncoding(encoding);
  try {
    return new TextDecoder(enc).decode(buf);
  } catch (e) {
    return new TextDecoder('utf-8').decode(buf);
  }
}

function encode(str, encoding, options) {
  if (!str) return typeof Buffer !== 'undefined' ? Buffer.alloc(0) : new Uint8Array(0);
  const u8 = new TextEncoder().encode(String(str));
  return typeof Buffer !== 'undefined' ? Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength) : u8;
}

function encodingExists(enc) {
  try {
    new TextDecoder(normalizeEncoding(enc));
    return true;
  } catch (e) {
    return false;
  }
}

const iconv = {
  getDecoder,
  getEncoder,
  decode,
  encode,
  encodingExists,
  supportsStreams: false
};

module.exports = iconv;
module.exports.default = iconv;
module.exports.getDecoder = getDecoder;
module.exports.getEncoder = getEncoder;
module.exports.decode = decode;
module.exports.encode = encode;
module.exports.encodingExists = encodingExists;
