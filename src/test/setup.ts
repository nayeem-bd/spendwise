/// <reference types="node" />
// expo-crypto is native; Node's crypto gives the same API for tests.
jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual<typeof import('crypto')>('crypto').randomUUID() }));
