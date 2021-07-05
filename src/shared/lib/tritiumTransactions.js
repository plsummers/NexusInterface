import { callApi } from 'lib/tritiumApi';
import store, { observeStore } from 'store';
import * as TYPE from 'consts/actionTypes';
import { loadAccounts } from 'lib/user';
import { showDesktopNotif } from 'utils/misc';
import { formatNumber } from 'lib/intl';
import { showNotification, openErrorDialog } from 'lib/ui';
import TokenName from 'components/TokenName';
import { legacyMode, addressRegex } from 'consts/misc';
import listAll from 'utils/listAll';

const isConfirmed = (tx) => !!tx.confirmations;

const txCountPerPage = 10;

const unsubscribers = {};
function watchTransaction(txid) {
  if (unsubscribers[txid]) return;
  // Update everytime a new block is received
  unsubscribers[txid] = observeStore(
    ({ core: { systemInfo } }) => systemInfo?.blocks,
    async (blocks) => {
      // Skip because core is most likely disconnected
      if (!blocks) return;

      // Fetch the updated transaction info
      await fetchTransaction(txid);

      const tx = store.getState().user.transactions.map[txid];
      if (tx && isConfirmed(tx)) {
        // If this transaction is already confirmed, unobserve the store
        unsubscribers[txid]();
        delete unsubscribers[txid];
        // Reload the account list
        // so that the account balances (available & unconfirmed) are up-to-date
        loadAccounts();
      }
    }
  );
}

const getBalanceChanges = (tx) =>
  tx.contracts
    ? tx.contracts.reduce((changes, contract) => {
        const sign = getDeltaSign(contract);
        if (sign && contract.amount) {
          let change = changes.find(
            contract.token_name
              ? (change) => change.token_name === contract.token_name
              : (change) => change.token === contract.token
          );
          if (change) {
            change.amount =
              change.amount + (sign === '-' ? -1 : 1) * contract.amount;
          } else {
            change = {
              token_name: contract.token_name,
              token: contract.token,
              amount: (sign === '-' ? -1 : 1) * contract.amount,
            };
            changes.push(change);
          }
        }
        return changes;
      }, [])
    : 0;

/**
 * Public API
 * =============================================================================
 */

export async function loadTransactions() {
  const { accountQuery, tokenQuery, operation, timeSpan, page } =
    store.getState().ui.transactionsPage.filter;
  store.dispatch({
    type: TYPE.START_FETCHING_TXS,
  });
  try {
    const transactions = await callApi('users/list/transactions', {
      accountQuery,
      tokenQuery,
      operation,
      timeSpan,
      page,
    });
    store.dispatch({
      type: TYPE.FETCH_TXS_RESULT,
      payload: {
        transactions,
        lastPage: transactions.length < limit,
      },
    });
    for (const tx of transactions) {
      if (!isConfirmed(tx)) {
        watchTransaction(tx.txid);
      }
    }
  } catch (err) {
    store.dispatch({
      type: TYPE.FETCH_TXS_ERROR,
    });
    openErrorDialog({
      message: __('Error fetching transactions'),
      note: typeof err === 'string' ? err : err?.message || __('Unknown error'),
    });
  }
}

export async function updateFilter(updates) {
  store.dispatch({
    type: TYPE.UPDATE_TRANSACTIONS_FILTER,
    payload: updates,
  });
  return await loadTransactions();
}

export const addTritiumTransactions = (newTransactions) => {
  store.dispatch({
    type: TYPE.ADD_TRITIUM_TRANSACTIONS,
    payload: {
      list: newTransactions,
    },
  });
};

export const updateTritiumTransaction = (tx) => {
  store.dispatch({
    type: TYPE.UPDATE_TRITIUM_TRANSACTION,
    payload: tx,
  });
};

export const getDeltaSign = (contract) => {
  switch (contract.OP) {
    case 'CREDIT':
    case 'COINBASE':
    case 'TRUST':
    case 'GENESIS':
    case 'TRUSTPOOL':
    case 'GENESISPOOL':
    case 'MIGRATE':
      return '+';

    case 'DEBIT':
    case 'FEE':
    case 'LEGACY':
      return '-';

    default:
      return '';
  }
};

function watchTransactions(transactions) {
  transactions.forEach((tx) => {
    if (!isConfirmed(tx)) {
      watchTransaction(tx.txid);
    }
  });
}

export async function fetchAllTransactions() {
  const transactions = await listAll(
    'users/list/transactions',
    {
      verbose: 'summary',
    },
    { limit: 10, callback: addAndWatch }
  );
  store.dispatch({ type: TYPE.SET_TRANSACTIONS_LOADEDALL });
}

export async function fetchTransaction(txid) {
  const tx = await callApi('ledger/get/transaction', {
    txid,
    verbose: 'summary',
  });
  updateTritiumTransaction(tx);
}

export const setTxsTimeFilter = (timeSpan) => {
  store.dispatch({
    type: TYPE.SET_TXS_TIME_FILTER,
    payload: timeSpan,
  });
};

export const setTxsNameQuery = (accountName) => {
  store.dispatch({
    type: TYPE.SET_TXS_NAME_QUERY,
    payload: accountName,
  });
};

export const setTxsOperationFilter = (operation) => {
  store.dispatch({
    type: TYPE.SET_TXS_OP_FILTER,
    payload: operation,
  });
};

export const goToTxsPage = (page) => {
  store.dispatch({
    type: TYPE.SET_TXS_PAGE,
    payload: page < 1 ? 1 : page,
  });
};

export function prepareTransactions() {
  if (!legacyMode) {
    observeStore(
      ({ user: { status } }) => status,
      async (status, oldStatus) => {
        // Skip if user was just switched
        if (status?.genesis !== oldStatus?.genesis) return;

        const txCount = status?.transactions;
        const oldTxCount = oldStatus?.transactions;
        if (
          typeof txCount === 'number' &&
          typeof oldTxCount === 'number' &&
          txCount > oldTxCount
        ) {
          const transactions = await callApi('users/list/transactions', {
            verbose: 'summary',
            limit: txCount - oldTxCount,
          });
          addTritiumTransactions(transactions);

          transactions.forEach((tx) => {
            if (!isConfirmed(tx)) {
              watchTransaction(tx.txid);
            }

            const changes = getBalanceChanges(tx);
            if (changes.length) {
              const changeLines = changes.map(
                (change) =>
                  `${change.amount >= 0 ? '+' : ''}${formatNumber(
                    change.amount,
                    6
                  )} ${TokenName.from({ contract: change })}`
              );
              showDesktopNotif(__('New transaction'), changeLines.join(' \n'));
              showNotification(
                `${__('New transaction')}: ${changeLines.join(' | ')}`,
                'success'
              );
            }
          });
        }
      }
    );
  }
}
