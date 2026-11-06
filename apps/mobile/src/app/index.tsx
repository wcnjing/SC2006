import { DevHomeScreen } from '../dev/DevHomeScreen';
import { DemoHomeScreen } from '../demo/DemoScreens';
import { DEMO_MODE } from '../lib/runtime';

export default function HomeRoute() {
  return DEMO_MODE ? <DemoHomeScreen /> : <DevHomeScreen />;
}
