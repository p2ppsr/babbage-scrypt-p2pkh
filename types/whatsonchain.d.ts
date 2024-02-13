declare module 'whatsonchain';
    interface SomeType {
      // Add the type information you need here
      // For example:
      someField: string;
    }
  
    // Augment the existing module with additional types
    interface Whatsonchain {
      someFunction(): SomeType;
    }
  
    const woc: Whatsonchain;
    export = woc;
  }
