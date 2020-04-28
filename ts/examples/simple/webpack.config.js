const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

const glob = require("glob");
let alias = require("./start").getWebpackAlias();

module.exports = {
  entry: () => {
    let entry = {};
    let files = glob.sync("./**/*.ts", {
      ignore: [".*/node_modules/**", "./tests/**"],
    });

    files.forEach((file) => {
      entry[file.replace(".ts", "")] = file;
    });
    return entry;
  },
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
