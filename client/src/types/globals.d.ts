declare namespace google {
  namespace maps {
    class Map {
      constructor(element: HTMLElement, options?: any);
      setCenter(latLng: any): void;
      addListener(event: string, handler: Function): void;
    }

    class Marker {
      constructor(options: any);
      setMap(map: Map | null): void;
    }

    class Circle {
      constructor(options: any);
      setMap(map: Map | null): void;
    }

    namespace event {
      function addListener(instance: any, eventName: string, handler: Function): void;
    }

    interface MapMouseEvent {
      latLng?: {
        lat(): number;
        lng(): number;
      };
    }

    namespace geometry {
      // Add geometry namespace if needed
    }

    enum SymbolPath {
      CIRCLE = 0,
    }
  }
}

declare var google: typeof google;