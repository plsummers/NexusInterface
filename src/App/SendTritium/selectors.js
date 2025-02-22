import React from 'react';
import styled from '@emotion/styled';
import memoize from 'utils/memoize';

__ = __context('Send');

const TokenRecipientName = styled.span({
  color: 'gray',
});

const Separator = styled.div(({ theme }) => ({
  fontWeight: 'bold',
  color: theme.primary,
}));

export const getAccountOptions = memoize((myAccounts, myTokens) => {
  let options = [];

  if (myAccounts && myAccounts.length > 0) {
    options.push({
      value: 'AccountsSeparator',
      display: <Separator>{__('Accounts')}</Separator>,
      isSeparator: true,
      indent: false,
    });
    options.push(
      ...myAccounts.map(acc => ({
        value: acc.name || acc.address,
        display: `${acc.name || acc.address} (${acc.balance} ${acc.token_name ||
          'Tokens'})`,
        indent: true,
      }))
    );
  }
  if (myTokens && myTokens.length > 0) {
    options.push({
      value: 'TokensSeparator',
      display: <Separator>{__('Tokens')}</Separator>,
      isSeparator: true,
      indent: false,
    });
    options.push(
      ...myTokens.map(token => ({
        value: token.name || token.address,
        display: `${token.name || token.address} (${
          token.balance
        } ${token.name || 'Tokens'})`,
        indent: true,
      }))
    );
  }

  return options;
});

export const getAccountBalance = memoize(
  (accountName, myAccounts, myTokens) => {
    const account =
      myAccounts && myAccounts.find(acc => acc.name === accountName);
    const token = myTokens && myTokens(tkn => tkn.name === accountName);
    return account && account.balance;
  }
);

export const getAccountInfo = memoize((accountName, myAccounts, myTokens) => {
  const account =
    myAccounts &&
    myAccounts.find(
      acc => acc.name === accountName || acc.address === accountName
    );
  const token =
    myTokens &&
    myTokens.find(
      tkn => tkn.name === accountName || tkn.address === accountName
    );
  return account || token || { balance: 0 };
});

export const getNxsFiatPrice = memoize((rawNXSvalues, fiatCurrency) => {
  if (rawNXSvalues) {
    const marketInfo = rawNXSvalues.find(e => e.name === fiatCurrency);
    if (marketInfo) {
      return marketInfo.price;
    }
  }
  return null;
});

export const getAddressNameMap = memoize((addressBook, myTritiumAccounts) => {
  const map = {};
  if (addressBook) {
    Object.values(addressBook).forEach(contact => {
      if (contact.addresses) {
        contact.addresses.forEach(({ address, label }) => {
          map[address] = contact.name + (label ? ' - ' + label : '');
        });
      }
    });
  }
  if (myTritiumAccounts) {
    myTritiumAccounts.forEach(element => {
      map[element.address] = element.name;
    });
  }
  return map;
});

const Address = styled.span(({ theme }) => ({
  color: theme.mixer(0.75),
}));

export const getRecipientSuggestions = memoize(
  (addressBook, myTritiumAccounts) => {
    //console.log(myTritiumAccounts);
    //console.log(addressBook);
    const suggestions = [];
    if (addressBook) {
      Object.values(addressBook).forEach(contact => {
        if (contact.addresses) {
          contact.addresses
            .filter(e => !e.address.startsWith('a'))
            .forEach(({ address, label, isMine }) => {
              if (!isMine) {
                suggestions.push({
                  name: contact.name,
                  value: address,
                  token: '0',
                  display: (
                    <span>
                      {contact.name}
                      {label ? ' - ' + label : ''}{' '}
                      <TokenRecipientName>{'(NXS)'}</TokenRecipientName>{' '}
                      <Address>{address}</Address>
                    </span>
                  ),
                });
              }
            });
        }
      });
    }
    if (myTritiumAccounts) {
      myTritiumAccounts.forEach(element => {
        suggestions.push({
          name: element.name || element.address,
          value: element.address,
          token: element.token,
          display: (
            <span>
              {element.name} {'   '}
              <TokenRecipientName>{`(${element.token_name ||
                'Tokens'})`}</TokenRecipientName>{' '}
              <Address>{element.address}</Address>
            </span>
          ),
        });
      });
    }
    return suggestions;
  }
);

export const getRegisteredFieldNames = memoize(registeredFields =>
  Object.keys(registeredFields || {})
);
