const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
let alias = require("./start").getWebpackAlias();

console.log(alias);
module.exports = {
  // entry: glob.sync("./**/*.ts", {
  //   ignore: [".*/node_modules/**", "./tests/**"],
  // }),
  entry: "./src/index.ts",
  target: "node",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    alias: alias,
    extensions: [".tsx", ".ts", ".js"],
  },
  output: {
    path: path.resolve(__dirname, "lib"),
    filename: "[name].js",
  },
  plugins: [
    new CopyPlugin([{ from: "config", to: path.resolve(__dirname, "lib") }]),
  ],
  mode: process.node_env || "development",
};
