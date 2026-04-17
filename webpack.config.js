const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

/** @type {import('webpack').Configuration} */
module.exports = {
  entry: {
    "service-worker": "./src/background/service-worker.ts",
    "content-script": "./src/content/content-script.ts",
    sidepanel: "./src/sidepanel/sidepanel.ts",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
    clean: true,
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: "[name].css",
    }),
    new CopyPlugin({
      patterns: [
        { from: "manifest.json", to: "manifest.json" },
        { from: "src/sidepanel/sidepanel.html", to: "sidepanel.html" },
        { from: "public/icons", to: "icons", noErrorOnMissing: true },
        { from: "src/wasm/pkg/gitx1_wasm_bg.wasm", to: "wasm/gitx1_wasm_bg.wasm" },
        { from: "src/wasm/pkg/gitx1_wasm.js", to: "wasm/gitx1_wasm.js" },
      ],
    }),
  ],
  optimization: {
    minimize: false, // Keep readable for debugging during dev
  },
  devtool: "cheap-module-source-map",
};
