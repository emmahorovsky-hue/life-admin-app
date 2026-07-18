const path = require('path');

module.exports = function (api) {
  api.cache(true);
  // babel-preset-expo ships inside the expo package and is not hoisted to a
  // name-resolvable location in this monorepo, so resolve it explicitly from
  // expo rather than by bare name.
  const babelPresetExpo = require.resolve('babel-preset-expo', {
    paths: [path.dirname(require.resolve('expo/package.json'))],
  });
  return {
    presets: [babelPresetExpo],
    // react-native-worklets/plugin is required by react-native-reanimated (v4)
    // and must be listed last. Without it, Reanimated throws during setup and
    // the release build crashes on launch. Reanimated is pulled in transitively
    // by @gorhom/bottom-sheet, victory-native, and @shopify/react-native-skia.
    plugins: [require.resolve('react-native-worklets/plugin')],
  };
};
