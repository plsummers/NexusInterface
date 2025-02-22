import { ipcRenderer } from 'electron';
import log from 'electron-log';

import * as TYPE from 'consts/actionTypes';
import store from 'store';
import rpc from 'lib/rpc';
import { loadNexusConf, saveCoreConfig } from 'lib/coreConfig';
import { apiPost } from 'lib/tritiumApi';
import { updateSettings } from 'lib/settings';
import sleep from 'utils/promisified/sleep';

export const getMiningInfo = async () => {
  try {
    const miningInfo = await apiPost('ledger/get/mininginfo');
    store.dispatch({ type: TYPE.SET_MINING_INFO, payload: miningInfo });
  } catch (err) {
    store.dispatch({ type: TYPE.CLEAR_MINING_INFO });
    console.error('ledger/get/mininginfo failed', err);
  }
};

export const getDifficulty = async () => {
  const diff = await rpc('getdifficulty', []);
  store.dispatch({ type: TYPE.GET_DIFFICULTY, payload: diff });
};

/**
 * Start Nexus Core
 */
export const startCore = async () => {
  // Check manual core mode
  const { settings } = store.getState();
  if (settings.manualDaemon) {
    log.info('Core Manager: Manual Core mode, skipping starting core');
    return;
  }
  // Check if core's already running
  if (await ipcRenderer.invoke('check-core-running')) {
    log.info(
      'Core Manager: Nexus Core Process already running. Skipping starting core'
    );
    saveCoreConfig(await loadNexusConf());
    return;
  }
  // Check if core exists
  if (!(await ipcRenderer.invoke('check-core-exists'))) {
    throw new Error('Core not found');
  }
  // if (settings.clearPeers) {
  //   if (fs.existsSync(path.join(conf.dataDir, 'addr.bak'))) {
  //     await deleteDirectory(path.join(conf.dataDir, 'addr.bak'));
  //   }
  //   if (fs.existsSync(path.join(conf.dataDir, 'addr'))) {
  //     fs.renameSync(
  //       path.join(conf.dataDir, 'addr'),
  //       path.join(conf.dataDir, 'addr.bak')
  //     );
  //   }
  //   updateSettingsFile({ clearPeers: false });
  // }

  // Load config
  const conf = await loadNexusConf();

  // Prepare parameters
  const params = [
    '-daemon',
    '-server',
    '-rpcthreads=4',
    '-fastsync',
    `-datadir=${settings.coreDataDir}`,
    `-rpcport=${conf.port}`,
    `-verbose=${settings.verboseLevel}`,
  ];
  if (settings.testnetIteration && settings.testnetIteration !== '0') {
    params.push('-testnet=' + settings.testnetIteration);
  } else {
    //Only do this if your on mainnet.
    params.push('-connect=node1.nexusoft.io');
    params.push('-connect=node4.nexusoft.io');
  }
  if (settings.forkBlocks) {
    params.push('-forkblocks=' + settings.forkBlocks);
    updateSettings({ forkBlocks: 0 });
  }
  if (settings.walletClean) {
    params.push('-walletclean');
    updateSettings({ walletClean: false });
  }
  // Avatar is default so only add it if it is off.
  if (!settings.avatarMode) {
    params.push('-avatar=0');
  }
  // Enable mining (default is 0)
  if (settings.enableMining == true) {
    params.push('-mining=1');
    if (settings.ipMineWhitelist !== '') {
      settings.ipMineWhitelist.split(';').forEach((element) => {
        params.push(`-llpallowip=${element}`);
      });
    }
  }
  // Enable staking (default is 0)
  if (settings.enableStaking == true) params.push('-stake=1');

  // Start core
  await ipcRenderer.invoke('start-core', params);
  saveCoreConfig(conf);
  store.dispatch({
    type: TYPE.START_CORE_AUTO_CONNECT,
  });
};

/**
 * Stop Nexus Core
 */
export const stopCore = async (forRestart) => {
  log.info('Core Manager: Stop function called');
  const { manualDaemon } = store.getState().settings;
  store.dispatch({ type: TYPE.CLEAR_CORE_INFO });
  rpc('stop', []);

  // Wait for core to gracefully stop for 30 seconds
  for (let i = 0; i <= 30; i++) {
    if (i < 30) {
      if (await ipcRenderer.invoke('check-core-running')) {
        log.info(
          `Core Manager: Core still running after stop command for: ${i} seconds`
        );
      } else {
        log.info(`Core Manager: Core stopped gracefully.`);
        break;
      }
      await sleep(1000);
    } else {
      // If core still doesn't stop after 30 seconds, kill the process
      await ipcRenderer.invoke('kill-core-process');
    }
  }

  if (!forRestart && !manualDaemon) {
    store.dispatch({
      type: TYPE.STOP_CORE_AUTO_CONNECT,
    });
  }
};

/**
 * Restart Nexus Core
 */
export const restartCore = async () => {
  await stopCore(true);
  await startCore();
  store.dispatch({
    type: TYPE.START_CORE_AUTO_CONNECT,
  });
};
