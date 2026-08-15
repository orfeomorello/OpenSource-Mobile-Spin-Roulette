import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "io.mobilespinroulette.app",
  appName: "Mobile Roulette – No cash",
  webDir: "dist",
  android: {
    allowMixedContent: false,
    backgroundColor: "#06100d",
    webContentsDebuggingEnabled: false,
    adjustMarginsForEdgeToEdge: "disable",
  },
  server: {
    androidScheme: "https",
  },
};

export default config;
