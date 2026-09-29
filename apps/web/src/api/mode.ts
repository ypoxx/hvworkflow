/** Compile-time mode, validated by vite.config.ts before a build starts. */
export const WEB_MODE = __HV_WEB_MODE__;
export const DEMO_MODE = WEB_MODE === 'demo';
