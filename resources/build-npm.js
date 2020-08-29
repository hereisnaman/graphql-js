'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const babel = require('@babel/core');

const { rmdirRecursive, readdirRecursive, showDirStats } = require('./utils');

if (require.main === module) {
  rmdirRecursive('./npmDist');
  fs.mkdirSync('./npmDist');

  const srcFiles = readdirRecursive('./src', { ignoreDir: /^__.*__$/ });
  for (const filepath of srcFiles) {
    const srcPath = path.join('./src', filepath);
    const destPath = path.join('./npmDist', filepath);

    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    if (filepath.endsWith('.js')) {
      fs.copyFileSync(srcPath, destPath + '.flow');

      const cjs = babelBuild(srcPath, { envName: 'cjs' });
      fs.writeFileSync(destPath, cjs);

      const mjs = babelBuild(srcPath, { envName: 'mjs' });
      fs.writeFileSync(destPath.replace(/\.js$/, '.mjs'), mjs);
    } else if (filepath.endsWith('.d.ts') || filepath.endsWith('.json')) {
      fs.copyFileSync(srcPath, destPath);
    }
  }

  fs.copyFileSync('./LICENSE', './npmDist/LICENSE');
  fs.copyFileSync('./README.md', './npmDist/README.md');

  // Should be done as the last step so only valid packages can be published
  const packageJSON = buildPackageJSON();
  fs.writeFileSync(
    './npmDist/package.json',
    JSON.stringify(packageJSON, null, 2),
  );

  showDirStats('./npmDist');
}

function babelBuild(srcPath, options) {
  return babel.transformFileSync(srcPath, options).code + '\n';
}

function buildPackageJSON() {
  const packageJSON = require('../package.json');
  delete packageJSON.private;
  delete packageJSON.scripts;
  delete packageJSON.devDependencies;

  packageJSON.engines = packageJSON.engines_on_npm;
  delete packageJSON.engines_on_npm;

  const { version } = packageJSON;
  const versionMatch = /^\d+\.\d+\.\d+-?(.*)?$/.exec(version);
  if (!versionMatch) {
    throw new Error('Version does not match semver spec: ' + version);
  }

  const [, preReleaseTag] = versionMatch;

  if (preReleaseTag != null) {
    const [tag] = preReleaseTag.split('.');
    assert(['alpha', 'beta', 'rc'].includes(tag), `"${tag}" tag is supported.`);

    assert(!packageJSON.publishConfig, 'Can not override "publishConfig".');
    packageJSON.publishConfig = { tag: tag || 'latest' };
  }

  return packageJSON;
}
