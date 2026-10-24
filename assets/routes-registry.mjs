// ARCH-CLEAN-02 A03: Node ESM facade; browser consumers load the classic core.
import registry from "./routes-registry.js";
export const {countries,competitionViews,cupViews,clubViews,pages,parseRoute,buildRoute,canonicalizeRoute,resolveRouteIdentity}=registry;
