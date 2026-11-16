// يُحمَّل بـnode --import: يجعل أي fetch صادر يفشل فوراً (إثبات أن dry-run لا يلمس الشبكة)
globalThis.fetch = () => { throw new Error("NETWORK_FORBIDDEN: dry-run لا يجوز أن يتصل بالشبكة"); };
