import { getRandomValues as expoCryptoGetRandomValues } from "expo-crypto";
import { Buffer } from "buffer";

global.Buffer = Buffer;

// getRandomValues polyfill
class Crypto {
  getRandomValues = expoCryptoGetRandomValues;
}

const webCrypto = typeof crypto !== "undefined" ? crypto : new Crypto();

(() => {
  if (typeof crypto === "undefined") {
    Object.defineProperty(window, "crypto", {
      configurable: true,
      enumerable: true,
      get: () => webCrypto,
    });
  }
})();

// Node.js process polyfill for React Native
if (typeof global.process === "undefined") {
  (global as any).process = {
    env: {},
    platform: "react-native",
    version: "",
    versions: {},
    nextTick: (callback: Function) => setTimeout(callback, 0),
    stdout: {
      write: (data: string) => console.log(data),
    },
    stderr: {
      write: (data: string) => console.error(data),
    },
    stdin: {
      on: () => {},
      off: () => {},
      pause: () => {},
      resume: () => {},
      listenerCount: () => 0,
    },
  };
}

// Disable Node.js specific modules that are not needed in React Native
const disabledModules = [
  'fs', 'net', 'tls', 'child_process', 'http', 'https', 
  'zlib', 'domain', 'punycode', 'tty', 'vm'
];

disabledModules.forEach(moduleName => {
  (global as any)[moduleName] = undefined;
});
