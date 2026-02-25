// Monkey-patch RTCPeerConnection at module load time to intercept Volcengine SDK
import "./lib/webcodecsMonkeyPatch";

import ArmcloudEngine from "./lib/pkg";
import { KEYTYPE } from "./lib/enums";

export { ArmcloudEngine, KEYTYPE };
export default ArmcloudEngine;
