import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';
import { vi } from 'vitest';

// Ensure self is defined in all global scopes for @firebase/util and fake-indexeddb
if (typeof global !== 'undefined') {
  (global as unknown as { self: typeof global }).self = global;
}
if (typeof window !== 'undefined') {
  (window as unknown as { self: typeof window }).self = window;
}
if (typeof globalThis !== 'undefined') {
  (globalThis as unknown as { self: typeof globalThis }).self = globalThis;
}

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Suppress console errors during tests
vi.spyOn(console, 'error').mockImplementation(() => {});
