export const CONNECTIVITY_STATUS = Object.freeze({
  ONLINE: 'online',
  OFFLINE: 'offline',
  UNKNOWN: 'unknown'
});

export class InMemoryConnectivityService {
  constructor(status = CONNECTIVITY_STATUS.ONLINE) {
    this.status = status;
    this.listeners = new Set();
  }

  getStatus() {
    return this.status;
  }

  isOnline() {
    return this.status === CONNECTIVITY_STATUS.ONLINE;
  }

  setStatus(status) {
    if (!Object.values(CONNECTIVITY_STATUS).includes(status)) throw new Error(`CONNECTIVITY_STATUS_INVALID:${status}`);
    this.status = status;
    this.listeners.forEach((listener) => listener(this.getStatus()));
  }

  subscribe(listener = () => {}) {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  activeCount() {
    return this.listeners.size;
  }
}

export class BrowserConnectivityService {
  constructor(target = globalThis) {
    this.target = target;
    this.listeners = new Set();
    this.boundNotify = () => this.notify();
  }

  getStatus() {
    const nav = this.target.navigator;
    if (!nav || typeof nav.onLine !== 'boolean') return CONNECTIVITY_STATUS.UNKNOWN;
    return nav.onLine ? CONNECTIVITY_STATUS.ONLINE : CONNECTIVITY_STATUS.OFFLINE;
  }

  isOnline() {
    return this.getStatus() !== CONNECTIVITY_STATUS.OFFLINE;
  }

  notify() {
    const status = this.getStatus();
    this.listeners.forEach((listener) => listener(status));
  }

  subscribe(listener = () => {}) {
    const first = this.listeners.size === 0;
    this.listeners.add(listener);
    if (first) {
      this.target.addEventListener?.('online', this.boundNotify);
      this.target.addEventListener?.('offline', this.boundNotify);
    }
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.target.removeEventListener?.('online', this.boundNotify);
        this.target.removeEventListener?.('offline', this.boundNotify);
      }
    };
  }

  activeCount() {
    return this.listeners.size;
  }
}
