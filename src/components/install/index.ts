import { listenForInstallPrompt } from './installPrompt';
import { registerServiceWorker } from './registerServiceWorker';

// Home-screen install and web-push notifications for the customer app (plan 004 stage 7).

export { InstallOverlay } from './InstallScreens';
export { NotifyCard, NotifyLine, UpdatesCard } from './NotifyParts';
export { registerInstallI18n, INSTALL_NS } from './i18n/register';
export {
  useOrderInstall,
  useSavedOrdersInstall,
  type InstallController,
  type InstallOverride,
} from './useInstallFlow';
export { promptInstall, useCanInstall } from './installPrompt';
export {
  manifestTarget,
  sellerManifestTarget,
  useManifestLinks,
  HOME_SCREEN_SOURCE,
} from './manifestLinks';
export type { Environment } from './detect';
export type { ScreenId } from './flow';

/** Called once at startup: the service worker (production builds) and Android's install prompt. */
export function startInstallSupport(): void {
  listenForInstallPrompt();
  void registerServiceWorker();
}
