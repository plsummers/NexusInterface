// External
import React, { Component } from 'react';
import { connect } from 'react-redux';
import styled from '@emotion/styled';
import GA from 'lib/googleAnalytics';

// Internal Global
import Icon from 'components/Icon';
import Button from 'components/Button';
import Panel from 'components/Panel';
import { openModal } from 'lib/ui';
import AddEditContactModal from 'components/AddEditContactModal';
import { isCoreConnected } from 'selectors';

// Internal Local
import PanelControls from './PanelControls';
import ContactList from './ContactList';
import ContactDetails from './ContactDetails';

// Icons
import addressBookIcon from 'icons/address-book.svg';
import addContactIcon from 'icons/add-contact.svg';

__ = __context('AddressBook');

const AddressBookLayout = styled.div({
  display: 'grid',
  gridTemplateAreas: '"list details"',
  gridTemplateColumns: '1fr 2fr',
  columnGap: 30,
  height: '100%',
});

const mapStateToProps = state => ({
  addressBook: state.addressBook,
  coreConnected: isCoreConnected(state),
});

/**
 * The Address Book Page
 *
 * @class AddressBook
 * @extends {Component}
 */
@connect(mapStateToProps)
class AddressBook extends Component {
  state = {
    activeIndex: 0,
  };

  /**
   * componentDidMount
   *
   * @memberof AddressBook
   */
  componentDidMount() {
    GA.SendScreen('AddressBook');
  }

  /**
   * Opens Add/Edit Contact Modal
   *
   * @memberof AddressBook
   */
  showAddContact = () => {
    openModal(AddEditContactModal);
  };

  /**
   * Component's Renderable JSX
   *
   * @returns
   * @memberof AddressBook
   */
  render() {
    const { addressBook, coreConnected } = this.props;

    return (
      <Panel
        icon={addressBookIcon}
        title={__('Address book')}
        controls={<PanelControls />}
        bodyScrollable={false}
      >
        {addressBook && Object.values(addressBook).length > 0 ? (
          <AddressBookLayout>
            <ContactList />
            <ContactDetails />
          </AddressBookLayout>
        ) : (
          <div style={{ marginTop: 50, textAlign: 'center' }}>
            <div className="dim">{__('Your address book is empty')}</div>
            {coreConnected && (
              <Button
                skin="plain"
                onClick={this.showAddContact}
                className="mt1"
              >
                <Icon icon={addContactIcon} className="space-right" />
                {__('Create new contact')}
              </Button>
            )}
          </div>
        )}
      </Panel>
    );
  }
}

export default AddressBook;
