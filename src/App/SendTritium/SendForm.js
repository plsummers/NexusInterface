// External
import { Component } from 'react';
import { connect } from 'react-redux';
import { reduxForm, Field, FieldArray, formValueSelector } from 'redux-form';
import styled from '@emotion/styled';

// Internal Global
import Icon from 'components/Icon';
import Button from 'components/Button';
import TextField from 'components/TextField';
import Select from 'components/Select';
import FormField from 'components/FormField';
import Switch from 'components/Switch';
import Tooltip from 'components/Tooltip';
import Arrow from 'components/Arrow';
import { openSuccessDialog, confirmPin } from 'lib/ui';
import { callApi } from 'lib/tritiumApi';
import { loadAccounts } from 'lib/user';
import {
  formName,
  defaultValues,
  defaultRecipient,
  toggleAdvancedOptions,
} from 'lib/send';
import { errorHandler } from 'utils/form';
import sendIcon from 'icons/send.svg';
import { timing } from 'styles';
import { numericOnly } from 'utils/form';
import { newUID } from 'utils/misc';
import { addressRegex } from 'consts/misc';
import plusIcon from 'icons/plus.svg';
import questionIcon from 'icons/question-mark-circle.svg';

// Internal Local
import Recipients from './Recipients';
import {
  getAccountOptions,
  getAddressNameMap,
  getRegisteredFieldNames,
  getAccountInfo,
} from './selectors';

__ = __context('Send');

const SendFormComponent = styled.form({
  maxWidth: 740,
  margin: '-.5em auto 0',
});

const SendFormButtons = styled.div({
  display: 'flex',
  justifyContent: 'space-between',
  marginTop: '3em',
});

const SendBtn = styled(Button)({
  flex: 1,
});

const MultiBtn = styled(Button)({
  marginRight: '1em',
});

const OptionsArrow = styled.span({
  display: 'inline-block',
  width: 15,
  verticalAlign: 'middle',
});

const MoreOptions = styled.div({
  paddingLeft: '1em',
});

const ShowAdvancedSwitch = styled.div(({ dim }) => ({
  display: 'flex',
  alignItems: 'center',
  transition: `opacity ${timing.normal}`,
  opacity: dim ? 0.67 : 1,
  cursor: 'pointer',
  marginTop: 10,
  fontSize: 15,
}));

const valueSelector = formValueSelector(formName);
const mapStateToProps = (state) => {
  const {
    addressBook,
    user: { accounts, tokens },
    form,
  } = state;
  const fromAddress = valueSelector(state, 'sendFrom');
  const reference = valueSelector(state, 'reference');
  const expires = valueSelector(state, 'expires');
  const accountInfo = getAccountInfo(fromAddress, accounts, tokens);
  const { advancedOptions } = state.ui.send;
  return {
    reference,
    expires,
    accountInfo,
    accountOptions: getAccountOptions(accounts, tokens),
    addressNameMap: getAddressNameMap(addressBook),
    fieldNames: getRegisteredFieldNames(
      form[formName] && form[formName].registeredFields
    ),
    advancedOptions,
  };
};

const uintRegex = /^[0-9]+$/;

async function asyncValidateRecipient(recipient) {
  const { address } = recipient;

  if (addressRegex.test(address)) {
    const addressResult = await callApi('system/validate/address', {
      address,
    });
    if (addressResult.is_valid) {
      return null;
    }
  }

  try {
    await callApi('names/get/name', { name: address });
  } catch (err) {
    throw { address: __('Invalid name/address') };
  }
}

/**
 * The Internal Send Form in the Send Page
 *
 * @class SendForm
 * @extends {Component}
 */
@connect(mapStateToProps)
@reduxForm({
  form: formName,
  destroyOnUnmount: false,
  initialValues: defaultValues,
  validate: ({ sendFrom, recipients }) => {
    const errors = {};
    if (!sendFrom) {
      errors.sendFrom = __('No accounts selected');
    }

    if (!recipients || !recipients.length) {
      errors.recipients = {
        _error: __('There must be at least one recipient'),
      };
    } else {
      const recipientsErrors = [];

      recipients.forEach(({ address, amount, reference }, i) => {
        const recipientErrors = {};
        if (!address) {
          recipientErrors.address = __('Address/Name is required');
        }
        const floatAmount = parseFloat(amount);
        if (!floatAmount || floatAmount < 0) {
          recipientErrors.amount = __('Invalid amount');
        }
        if (reference) {
          if (!uintRegex.test(reference)) {
            recipientErrors.reference = __(
              'Reference must be an unsigned integer'
            );
          } else {
            if (Number(reference) > 18446744073709551615) {
              recipientErrors.reference = __('Number is too large');
            }
          }
        }
        if (Object.keys(recipientErrors).length) {
          recipientsErrors[i] = recipientErrors;
        }
      });

      if (recipientsErrors.length) {
        errors.recipients = recipientsErrors;
      }
    }

    return errors;
  },
  asyncBlurFields: ['recipients[].address'],
  asyncValidate: async ({ recipients }) => {
    const results = await Promise.allSettled(
      recipients.map((recipient) => asyncValidateRecipient(recipient))
    );
    if (results.some(({ status }) => status === 'rejected')) {
      throw {
        recipients: results.map(({ status, reason }) =>
          status === 'rejected' ? reason : undefined
        ),
      };
    } else {
      return null;
    }
  },
  onSubmit: async (
    { recipients },
    dispatch,
    { accountInfo, advancedOptions }
  ) => {
    const pin = await confirmPin();
    if (pin) {
      const params = {
        pin,
        address: accountInfo.address,
      };

      const recipParams = recipients.map(
        (
          {
            address,
            amount,
            reference,
            expireDays,
            expireHours,
            expireMinutes,
            expireSeconds,
          },
          i
        ) => {
          const recipParam = {};

          if (addressRegex.test(address)) {
            recipParam.address_to = address;
          } else {
            recipParam.name_to = address;
          }
          if (advancedOptions) {
            const expires =
              parseInt(expireSeconds) +
              parseInt(expireMinutes) * 60 +
              parseInt(expireHours) * 3600 +
              parseInt(expireDays) * 86400;
            if (Number.isInteger(expires)) {
              recipParam.expires = expireDays;
            }
            if (reference) recipParam.reference = reference;
          }
          recipParam.amount = parseFloat(amount);

          return recipParam;
        }
      );

      if (recipParams.length === 1) {
        Object.assign(params, recipParams[0]);
      } else {
        Object.assign(params, { recipients: recipParams });
      }

      if (accountInfo.token_name === 'NXS') {
        return await callApi('finance/debit/account', params);
      } else {
        if (accountInfo.maxsupply) {
          return await callApi('tokens/debit/token', params);
        } else {
          return await callApi('tokens/debit/account', params);
        }
      }
    }
  },
  onSubmitSuccess: (result, dispatch, props) => {
    if (!result) return;

    props.reset();
    loadAccounts();
    openSuccessDialog({
      message: __('Transaction sent'),
    });
  },
  onSubmitFail: errorHandler(__('Error sending NXS')),
})
class SendForm extends Component {
  constructor(props) {
    super(props);
    this.state = {
      optionalOpen: false,
    };
  }

  switchID = newUID();

  componentDidUpdate(prevProps) {
    // if you have EVER added to these items always show till form is reset.

    if (this.props.reference || this.props.expires) {
      if (
        this.props.reference !== prevProps.reference ||
        this.props.expires !== prevProps.expires
      ) {
        this.setState({
          optionalOpen: true,
        });
      }
    }
  }

  componentDidMount() {
    // if ref or experation was in the form then open the optionals.
    // form is NOT reset on component unmount so we must show it on mount
    if (this.props.reference || this.props.expires) {
      this.setState({
        optionalOpen: true,
      });
    }
  }

  /**
   * Confirm the Send
   *
   * @memberof SendForm
   */
  confirmSend = (e) => {
    e.preventDefault();
    const { handleSubmit, invalid, touch, fieldNames } = this.props;

    if (invalid) {
      // Mark the form touched so that the validation errors will be shown.
      // redux-form doesn't have the `touchAll` feature yet so we have to list all fields manually.
      // redux-form also doesn't have the API to get all the field names yet so we have to connect to the store to retrieve it manually
      touch(...fieldNames);
      return;
    }
    handleSubmit();
  };

  toggleMoreOptions = (e) => {
    this.setState({
      optionalOpen: !this.state.optionalOpen,
    });
  };

  /**
   * Add Recipient to the queue
   *
   * @memberof SendForm
   */
  addRecipient = () => {
    this.props.array.push('recipients', defaultRecipient);
  };

  /**
   * Component's Renderable JSX
   *
   * @returns
   * @memberof SendForm
   */
  render() {
    const {
      accountOptions,
      advancedOptions,
      change,
      accountInfo,
      submitting,
    } = this.props;
    const optionsOpen =
      this.state.optionalOpen || this.props.reference || this.props.expires;
    return (
      <SendFormComponent onSubmit={this.confirmSend}>
        <div className="flex space-between">
          <div />
          <ShowAdvancedSwitch dim={!advancedOptions}>
            <Switch
              value={advancedOptions}
              onChange={toggleAdvancedOptions}
              style={{ fontSize: '.75em' }}
              id={this.switchID}
            />
            <label className="ml0_4 pointer" htmlFor={this.switchID}>
              {__('Advanced options')}
            </label>
          </ShowAdvancedSwitch>
        </div>

        <FormField label={__('Send from')}>
          <Field
            component={Select.RF}
            skin="filled-inverted"
            name="sendFrom"
            placeholder={__('Select an account')}
            options={accountOptions}
          />
        </FormField>

        <FieldArray
          component={Recipients}
          name="recipients"
          change={change}
          addRecipient={this.addRecipient}
          accBalance={accountInfo.balance}
          sendFrom={accountInfo}
          advancedOptions={advancedOptions}
        />

        {/* <div className="mt1" style={{ opacity: 0.7 }}>
          <Button onClick={this.toggleMoreOptions} skin="hyperlink">
            <OptionsArrow>
              <Arrow
                direction={optionsOpen ? 'down' : 'right'}
                height={8}
                width={10}
              />
            </OptionsArrow>
            <span className="v-align">{__('More options')}</span>
          </Button>
        </div> */}
        {optionsOpen && (
          <MoreOptions>
            {' '}
            <FormField
              label={
                <span>
                  <span className="v-align">{__('Reference number')}</span>
                  <Tooltip.Trigger
                    position="right"
                    tooltip={__(
                      'An optional number which may be provided by the recipient to identify this transaction from the others'
                    )}
                  >
                    <Icon icon={questionIcon} className="ml0_4" />
                  </Tooltip.Trigger>
                </span>
              }
            >
              <Field
                component={TextField.RF}
                name="reference"
                normalize={numericOnly}
                placeholder={__(
                  'Invoice number, order number, etc... (Optional)'
                )}
              />
            </FormField>
            {/*<FormField label={__('Expiration')}>
              <Field
                component={TextField.RF}
                name="expires"
                placeholder={__('Seconds till experation (Optional)')}
              />
        </FormField>{' '}*/}
          </MoreOptions>
        )}

        <SendFormButtons>
          <FieldArray
            component={({ fields }) => (
              <MultiBtn skin="default" onClick={this.addRecipient}>
                <Icon icon={plusIcon} />
                <span className="v-align ml0_4">{__('Add recipient')}</span>
              </MultiBtn>
            )}
            name="recipients"
          />
          <SendBtn type="submit" skin="primary" disabled={submitting}>
            <Icon icon={sendIcon} className="mr0_4" />
            {__('Send')}
          </SendBtn>
        </SendFormButtons>
      </SendFormComponent>
    );
  }
}

export default SendForm;
