"use strict";

const path = require("path");
const fs = require("graceful-fs");
const webpack = require("webpack");
const { test } = require("../helpers/playwright-test");
const { expect } = require("../helpers/playwright-custom-expects");
const Server = require("../../lib/Server");
const HTMLGeneratorPlugin = require("../helpers/html-generator-plugin");
const config = require("../fixtures/client-config/webpack.config");
const port = require("../ports-map").logging;

test.describe("logging", () => {
  const webSocketServers = [
    { webSocketServer: "ws" },
    { webSocketServer: "sockjs" },
  ];

  const cases = [
    {
      title: "should work and log message about live reloading is enabled",
      devServerOptions: {
        hot: false,
      },
    },
    {
      title: "should work and log messages about hot",
      devServerOptions: {
        hot: true,
      },
    },
    {
      title: "should work and log messages about hot is enabled",
      devServerOptions: {
        liveReload: false,
      },
    },
    {
      title:
        "should work and do not log messages about hot and live reloading is enabled",
      devServerOptions: {
        liveReload: false,
        hot: false,
      },
    },
    {
      title:
        "should work and log messages about hot and live reloading is enabled",
      devServerOptions: {
        liveReload: true,
        hot: true,
      },
    },
    {
      title: "should work and log warnings by default",
      webpackOptions: {
        plugins: [
          {
            apply(compiler) {
              compiler.hooks.thisCompilation.tap(
                "warnings-webpack-plugin",
                (compilation) => {
                  compilation.warnings.push(
                    new Error("Warning from compilation"),
                  );
                },
              );
            },
          },
          new HTMLGeneratorPlugin(),
        ],
      },
    },
    {
      title: "should work and log errors by default",
      webpackOptions: {
        plugins: [
          {
            apply(compiler) {
              compiler.hooks.thisCompilation.tap(
                "warnings-webpack-plugin",
                (compilation) => {
                  compilation.errors.push(new Error("Error from compilation"));
                },
              );
            },
          },
          new HTMLGeneratorPlugin(),
        ],
      },
    },
    {
      title: 'should work when the "client.logging" is "info"',
      devServerOptions: {
        client: {
          logging: "info",
        },
      },
    },
    {
      title: 'should work when the "client.logging" is "log"',
      devServerOptions: {
        client: {
          logging: "log",
        },
      },
    },
    {
      title: 'should work when the "client.logging" is "verbose"',
      devServerOptions: {
        client: {
          logging: "verbose",
        },
      },
    },
    {
      title: 'should work when the "client.logging" is "none"',
      devServerOptions: {
        client: {
          logging: "none",
        },
      },
    },
    {
      title: "should work and log only error",
      webpackOptions: {
        plugins: [
          {
            apply(compiler) {
              compiler.hooks.thisCompilation.tap(
                "warnings-webpack-plugin",
                (compilation) => {
                  compilation.warnings.push(
                    new Error("Warning from compilation"),
                  );
                  compilation.errors.push(new Error("Error from compilation"));
                },
              );
            },
          },
          new HTMLGeneratorPlugin(),
        ],
      },
      devServerOptions: {
        client: {
          logging: "error",
        },
      },
    },
    {
      title: "should work and log warning and errors",
      webpackOptions: {
        plugins: [
          {
            apply(compiler) {
              compiler.hooks.thisCompilation.tap(
                "warnings-webpack-plugin",
                (compilation) => {
                  compilation.warnings.push(
                    new Error("Warning from compilation"),
                  );
                  compilation.errors.push(new Error("Error from compilation"));
                },
              );
            },
          },
          new HTMLGeneratorPlugin(),
        ],
      },
      devServerOptions: {
        client: {
          logging: "warn",
        },
      },
    },
    {
      title: "should work and log static changes",
      devServerOptions: {
        static: path.resolve(__dirname, "../fixtures/client-config/static"),
      },
    },
  ];

  webSocketServers.forEach((webSocketServer) => {
    cases.forEach((testCase) => {
      test(`${testCase.title} (${
        webSocketServer.webSocketServer || "default"
      })`, async ({ page }) => {
        const compiler = webpack({ ...config, ...testCase.webpackOptions });
        const devServerOptions = {
          port,
          ...testCase.devServerOptions,
        };
        const server = new Server(devServerOptions, compiler);

        await server.start();

        try {
          const consoleMessages = [];

          page.on("console", (message) => {
            consoleMessages.push(message);
          });

          await page.goto(`http://localhost:${port}/`, {
            waitUntil: "networkidle0",
          });

          if (testCase.devServerOptions && testCase.devServerOptions.static) {
            fs.writeFileSync(
              path.join(testCase.devServerOptions.static, "./foo.txt"),
              "Text",
            );

            await page.waitForNavigation({
              waitUntil: "networkidle0",
            });
          }

          expect(
              consoleMessages.map((message) =>
                message
                  .text()
                  .replace(/\\/g, "/")
                  .replace(
                    new RegExp(process.cwd().replace(/\\/g, "/"), "g"),
                    "<cwd>",
                  ),
              ),
          ).toMatchSnapshotWithArray("console messages");
        } catch (error) {
          throw error;
        } finally {
          await server.stop();
        }
      });
    });
  });
});
