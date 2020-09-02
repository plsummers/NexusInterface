import fs from 'fs';
import path from 'path';
import log from 'electron-log';
import crypto from 'crypto';
import macaddress from 'macaddress';

import store from 'store';
import * as TYPE from 'consts/actionTypes';

function generateDefaultPassword() {
  let randomNumbers = ['', ''];
  const ranByte = crypto.randomBytes(64).toString('hex').split('');
  for (let index = 0; index < ranByte.length; index++) {
    const element = ranByte[index];
    if (index % 2) {
      randomNumbers[0] += element.charCodeAt(0);
    } else {
      randomNumbers[1] += element.charCodeAt(0);
    }
  }
  randomNumbers[0] = parseInt(randomNumbers[0]);
  randomNumbers[1] = parseInt(randomNumbers[1]);
  const randomValue = randomNumbers[0] * randomNumbers[1];
  const secret =
    process.platform === 'darwin'
      ? process.env.USER + process.env.HOME + process.env.SHELL + randomValue
      : JSON.stringify(macaddress.networkInterfaces(), null, 2) + randomValue;
  return crypto.createHmac('sha256', secret).update('pass').digest('hex');
}

const fromKeyValues = (rawContent) =>
  rawContent
    ? rawContent.split('\n').reduce((obj, line) => {
        const equalIndex = line.indexOf('=');
        if (equalIndex >= 0) {
          const key = line.substring(0, equalIndex);
          const value = line.substring(equalIndex + 1);
          if (key) obj[key] = value;
        }
        return obj;
      }, {})
    : {};

const toKeyValues = (obj) =>
  Object.entries(obj)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

const defaultConfig = {
  ip: '127.0.0.1',
  rpcSSL: true,
  port: '9336',
  portSSL: '7336',
  user: 'rpcserver',
  password: generateDefaultPassword(),
  apiSSL: true,
  apiPort: '8080',
  apiPortSSL: '7080',
  apiUser: 'apiserver',
  apiPassword: generateDefaultPassword(),
};

/**
 * Returns either the given config or default Config
 *
 * @param {*} [config={}]
 * @returns
 */
function customConfig(config = {}) {
  const ip = config.ip || defaultConfig.ip;
  const rpcSSL =
    typeof config.rpcSSL === 'boolean' ? config.rpcSSL : defaultConfig.rpcSSL;
  const apiSSL =
    typeof config.apiSSL === 'boolean' ? config.apiSSL : defaultConfig.apiSSL;
  const port = config.port || defaultConfig.port;
  const portSSL = config.portSSL || defaultConfig.portSSL;
  const apiPort = config.apiPort || defaultConfig.apiPort;
  const apiPortSSL = config.apiPortSSL || defaultConfig.apiPortSSL;
  return {
    ip,
    port,
    portSSL,
    host: `${rpcSSL ? 'https' : 'http'}://${ip}:${rpcSSL ? portSSL : port}`,
    user: config.user || config.rpcuser || defaultConfig.user,
    password: config.password || config.rpcpassword || defaultConfig.password,
    apiPort,
    apiPortSSL,
    apiHost: `${apiSSL ? 'https' : 'http'}://${ip}:${
      apiSSL ? apiPortSSL : apiPort
    }`,
    apiUser: config.apiUser || config.apiuser || defaultConfig.apiUser,
    apiPassword:
      config.apiPassword || config.apipassword || defaultConfig.apiPassword,
  };
}

/**
 * Load user & password from the nexus.conf file
 *
 * @returns
 */
export async function loadNexusConf() {
  const {
    settings: { coreDataDir },
  } = store.getState();
  if (!fs.existsSync(coreDataDir)) {
    log.info(
      'Core Manager: Data Directory path not found. Creating folder: ' +
        coreDataDir
    );
    await fs.promises.mkdir(coreDataDir);
  }

  const confPath = path.join(coreDataDir, 'nexus.conf');
  let confContent = '';
  if (fs.existsSync(confPath)) {
    log.info(
      'nexus.conf exists. Importing username and password for RPC server and API server.'
    );
    confContent = (await fs.promises.readFile(confPath)).toString();
  }
  const configs = fromKeyValues(confContent);

  // Fallback to default values if empty
  const fallbackConf = [
    ['rpcuser', defaultConfig.user],
    ['rpcpassword', defaultConfig.password],
    ['apiuser', defaultConfig.apiUser],
    ['apipassword', defaultConfig.apiPassword],
  ];
  let updated = false;
  fallbackConf.forEach(([key, value]) => {
    // Don't replace it if value is an empty string
    if (configs[key] === undefined) {
      configs[key] = value;
      updated = true;
    }
  });

  // Save nexus.conf file if there were changes
  if (updated) {
    log.info('Filling up some missing configurations in nexus.conf');
    fs.writeFile(confPath, toKeyValues(configs), (err) => {
      if (err) {
        console.error(err);
      } else {
        log.info('nexus.conf has been updated');
      }
    });
  }

  return customConfig({
    rpcuser: configs.rpcuser,
    rpcpassword: configs.rpcpassword,
    apiuser: configs.apiuser,
    apipassword: configs.apipassword,
  });
}

export function saveCoreConfig(conf) {
  return store.dispatch({
    type: TYPE.SET_CORE_CONFIG,
    payload: conf,
  });
}

export async function getActiveCoreConfig() {
  const {
    settings,
    core: { config },
  } = store.getState();

  if (settings.manualDaemon) {
    return customConfig({
      ip: settings.manualDaemonIP,
      rpcSSL: settings.manualDaemonSSL,
      port: settings.manualDaemonPort,
      portSSL: settings.manualDaemonPortSSL,
      user: settings.manualDaemonUser,
      password: settings.manualDaemonPassword,
      apiSSL: settings.manualDaemonApiSSL,
      apiPort: settings.manualDaemonApiPort,
      apiPortSSL: settings.manualDaemonApiPortSSL,
      apiUser: settings.manualDaemonApiUser,
      apiPassword: settings.manualDaemonApiPassword,
    });
  } else {
    if (config) {
      // Config cached when core was started,
      return config;
    } else {
      // If there's no cached config, load it from nexus.conf
      const conf = await loadNexusConf();
      saveCoreConfig(conf);
      return conf;
    }
  }
}
