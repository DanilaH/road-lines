import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { GameplayActivityCoordinator, installDocumentVisibilityBlocker } from '../../vendor/mini-games-kit/src/platform/activity';

export async function installRuntime(
  activity: GameplayActivityCoordinator,
  onBack: () => void,
  onBackground: (background: boolean) => void = () => {},
): Promise<() => void> {
  let documentBackground = false, nativeBackground = false;
  const setBlocked = (reason: string, value: boolean): void => {
    if (reason === 'visibility') documentBackground = value;
    if (reason === 'native-background') nativeBackground = value;
    onBackground(documentBackground || nativeBackground);
    activity.setBlocked(reason, value);
  };
  const visibility = installDocumentVisibilityBlocker({ setBlocked });
  const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') onBack(); };
  window.addEventListener('keydown', onKey);
  const handles: PluginListenerHandle[] = [];
  try {
    if (Capacitor.isNativePlatform()) {
      const { App } = await import('@capacitor/app');
      handles.push(await App.addListener('appStateChange', ({ isActive }) => setBlocked('native-background', !isActive)));
      handles.push(await App.addListener('backButton', onBack));
      setBlocked('native-background', !(await App.getState()).isActive);
    }
  } catch (error) {
    visibility(); window.removeEventListener('keydown', onKey);
    await Promise.all(handles.map(handle => handle.remove()));
    throw error;
  }
  return () => {
    visibility(); window.removeEventListener('keydown', onKey);
    for (const handle of handles) void handle.remove();
  };
}
