module.exports = function (context) {
  return {
    name: "webpack raw loader",
    configureWebpack(config, isServer, utils) {
      return {
        mergeStrategy: { "module.rules": "prepend" },
        module: {
          rules: [
            {
              test: /\.txt$/i,
              use: "raw-loader",
            },
          ],
        },
      };
    },
  };
};
