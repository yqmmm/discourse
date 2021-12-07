"use strict";

const EmberApp = require("ember-cli/lib/broccoli/ember-app");
const resolve = require("path").resolve;
const mergeTrees = require("broccoli-merge-trees");
const concat = require("broccoli-concat");
const prettyTextEngine = require("./lib/pretty-text-engine");
const { createI18nTree } = require("./lib/translation-plugin");
const discourseScss = require("./lib/discourse-scss");
const funnel = require("broccoli-funnel");
const AssetRev = require("broccoli-asset-rev");

module.exports = function (defaults) {
  let discourseRoot = resolve("../../../..");
  let vendorJs = discourseRoot + "/vendor/assets/javascripts/";

  let app = new EmberApp(defaults, {
    autoRun: false,
    "ember-qunit": {
      insertContentForTestBody: false,
    },
    sourcemaps: {
      // There seems to be a bug with brocolli-concat when sourcemaps are disabled
      // that causes the `app.import` statements below to fail in production mode.
      // This forces the use of `fast-sourcemap-concat` which works in production.
      enabled: true,
    },
    autoImport: {
      forbidEval: true,
    },
  });

  // Patching a private method is not great, but there's no other way for us to tell
  // Ember CLI that we want the tests alone in a package without helpers/fixtures, since
  // we re-use those in the theme tests.
  app._defaultPackager.packageApplicationTests = function (tree) {
    let appTestTrees = []
      .concat(
        this.packageEmberCliInternalFiles(),
        this.packageTestApplicationConfig(),
        tree
      )
      .filter(Boolean);

    appTestTrees = mergeTrees(appTestTrees, {
      overwrite: true,
      annotation: "TreeMerger (appTestTrees)",
    });

    let tests = concat(appTestTrees, {
      inputFiles: [
        "**/tests/test-boot-ember-cli.js",
        "**/tests/acceptance/*.js",
        "**/tests/integration/*.js",
        "**tests/unit/*.js",
      ],
      headerFiles: ["vendor/ember-cli/tests-prefix.js"],
      footerFiles: ["vendor/ember-cli/app-config.js"],
      outputFile: this.distPaths.testJsFile,
      annotation: "Concat: App Tests",
      sourceMapConfig: this.sourcemaps,
    });

    let testHelpers = concat(appTestTrees, {
      inputFiles: [
        "**/tests/helpers/**/*.js",
        "**/tests/fixtures/**/*.js",
        "**/tests/setup-tests.js",
      ],
      outputFile: "/assets/test-helpers.js",
      annotation: "Concat: App Test Helpers",
      sourceMapConfig: this.sourcemaps,
    });

    return mergeTrees([tests, testHelpers]);
  };

  // Ember CLI does this by default for the app tree, but for our extra bundles we
  // need to do it ourselves in production mode.
  const isProduction = EmberApp.env().includes("production");
  function digest(tree) {
    return isProduction ? new AssetRev(tree) : tree;
  }

  // WARNING: We should only import scripts here if they are not in NPM.
  // For example: our very specific version of bootstrap-modal.
  app.import(vendorJs + "bootbox.js");
  app.import(vendorJs + "bootstrap-modal.js");
  app.import(vendorJs + "jquery.ui.widget.js");
  app.import(vendorJs + "jquery.fileupload.js");
  app.import(vendorJs + "jquery.fileupload-process.js");
  app.import(vendorJs + "jquery.autoellipsis-1.0.10.js");
  app.import(vendorJs + "caret_position.js");
  app.import(vendorJs + "show-html.js");
  app.import("node_modules/ember-source/dist/ember-template-compiler.js", {
    type: "test",
  });

  let adminVendor = funnel(vendorJs, {
    files: ["resumable.js"],
  });

  return mergeTrees([
    discourseScss(`${discourseRoot}/app/assets/stylesheets`, "testem.scss"),
    createI18nTree(discourseRoot, vendorJs),
    app.toTree(),
    funnel(`${discourseRoot}/public/javascripts`, { destDir: "javascripts" }),
    funnel(`${vendorJs}/highlightjs`, {
      files: ["highlight-test-bundle.min.js"],
      destDir: "assets/highlightjs",
    }),
    digest(
      concat(mergeTrees([app.options.adminTree, adminVendor]), {
        outputFile: `assets/admin.js`,
      })
    ),
    digest(prettyTextEngine(vendorJs, "discourse-markdown")),
    digest(
      concat("public/assets/scripts", {
        outputFile: `assets/start-discourse.js`,
        headerFiles: [`start-app.js`],
        inputFiles: [`discourse-boot.js`],
      })
    ),
  ]);
};
