import type { ProductModule } from '../components/Navbar.js';

export interface BusCarrierPayload {
  dataUrl: string;
  name: string;
  width?: number;
  height?: number;
  bytes?: Uint8Array;
  mimeType?: string;
  source?: string;
}

export interface BusCiphertextPayload {
  ciphertext: Uint8Array;
  messageId?: string;
  source?: string;
}

type CarrierListener = (carrier: BusCarrierPayload) => void;
type NavigationListener = (module: ProductModule) => void;
type CiphertextListener = (payload: BusCiphertextPayload) => void;

class StudioDataBus {
  private activeCarrier: BusCarrierPayload | null = null;
  private activeCiphertext: BusCiphertextPayload | null = null;

  private carrierListeners = new Set<CarrierListener>();
  private navListeners = new Set<NavigationListener>();
  private ciphertextListeners = new Set<CiphertextListener>();

  // Carrier methods
  publishCarrier(carrier: BusCarrierPayload): void {
    this.activeCarrier = carrier;
    for (const listener of this.carrierListeners) {
      try {
        listener(carrier);
      } catch (err) {
        console.error('Error in carrier listener:', err);
      }
    }
  }

  getActiveCarrier(): BusCarrierPayload | null {
    return this.activeCarrier;
  }

  subscribeCarrier(listener: CarrierListener): () => void {
    this.carrierListeners.add(listener);
    if (this.activeCarrier) {
      listener(this.activeCarrier);
    }
    return () => {
      this.carrierListeners.delete(listener);
    };
  }

  // Cross-Studio Navigation & Transfer
  sendCarrierToModule(module: ProductModule, carrier: BusCarrierPayload): void {
    this.publishCarrier(carrier);
    this.navigateTo(module);
  }

  navigateTo(module: ProductModule): void {
    for (const listener of this.navListeners) {
      try {
        listener(module);
      } catch (err) {
        console.error('Error in navigation listener:', err);
      }
    }
  }

  subscribeNavigation(listener: NavigationListener): () => void {
    this.navListeners.add(listener);
    return () => {
      this.navListeners.delete(listener);
    };
  }

  // Ciphertext Handoff (e.g. from Core or AirGap to Relay)
  publishCiphertext(payload: BusCiphertextPayload): void {
    this.activeCiphertext = payload;
    for (const listener of this.ciphertextListeners) {
      try {
        listener(payload);
      } catch (err) {
        console.error('Error in ciphertext listener:', err);
      }
    }
  }

  getActiveCiphertext(): BusCiphertextPayload | null {
    return this.activeCiphertext;
  }

  subscribeCiphertext(listener: CiphertextListener): () => void {
    this.ciphertextListeners.add(listener);
    if (this.activeCiphertext) {
      listener(this.activeCiphertext);
    }
    return () => {
      this.ciphertextListeners.delete(listener);
    };
  }

  sendCiphertextToRelay(payload: BusCiphertextPayload): void {
    this.publishCiphertext(payload);
    this.navigateTo('relay' as ProductModule);
  }
}

export const studioDataBus = new StudioDataBus();
