/* eslint-disable no-param-reassign */
/* eslint-disable func-names */
const loaderUtils = require('loader-utils');
const validateOptions = require('schema-utils');
const WebWorkerTemplatePlugin = require('webpack/lib/webworker/WebWorkerTemplatePlugin');
const SingleEntryPlugin = require('webpack/lib/SingleEntryPlugin');

module.exports = function () {};
module.exports.pitch = function (request) {
  const options = loaderUtils.getOptions(this) || {};

  validateOptions({
    type: 'object',
    properties: {
      publicPath: {
        type: 'string',
      },
      filename: {
        type: 'string',
      },
      chunkFilename: {
        type: 'string',
      },
    },
  }, options, 'Shared Worker Loader');

  if (!this.webpack) {
    throw new Error('Shared Worker Loader is only usable with webpack');
  }

  this.cacheable(false);

  const callback = this.async();
  const filename = options.filename || 'js/worker.[contenthash:8].js';
  const chunkFilename = options.chunkFilename || 'js/worker-[id].[contenthash:8].js';
  const output = {
    filename,
    chunkFilename,
    namedChunkFilename: null,
  };

  if (this.options && this.options.worker && this.options.worker.output) {
    for (const name in this.options.worker.output) {
      output[name] = this.options.worker.output[name];
    }
  }

  const compiler = this._compilation.createChildCompiler('sharedworker', output);

  new WebWorkerTemplatePlugin(output).apply(compiler);
  new SingleEntryPlugin(this.context, `!!${request}`, 'main').apply(compiler);

  if (this.options && this.options.worker && this.options.worker.plugins) {
    this.options.worker.plugins.forEach((plugin) => {
      compiler.apply(plugin);
    });
  }

  const subCache = `subcache ${__dirname} ${request}`;
  compiler.hooks.compilation.tap({ name: 'SharedWorkerLoader' }, (compilation) => {
    if (compilation.cache) {
      if (!compilation.cache[subCache]) { compilation.cache[subCache] = {}; }
      compilation.cache = compilation.cache[subCache];
    }
  });

  compiler.runAsChild((err, entries) => {
    if (err) return callback(err);

    if (entries[0]) {
      const file = JSON.stringify(entries[0].files[0]);
      const publicPath = options.publicPath
        ? JSON.stringify(options.publicPath)
        : '__webpack_public_path__';
      const factory = `new SharedWorker(${publicPath} + ${file}, name)`;
      return callback(null, `module.exports = function(name) {\n  return ${factory};\n};`);
    }

    return callback(null, null);
  });
};
