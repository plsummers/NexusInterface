// External
import React from 'react';
import { connect } from 'react-redux';
import styled from '@emotion/styled';

// Internal
import { openModal } from 'lib/ui';
import AddEditContactModal from 'components/AddEditContactModal';
import { isCoreConnected } from 'selectors';
import Contact, { NewContactButton } from './Contact';

__ = __context('AddressBook');

const ContactListComponent = styled.div(({ theme }) => ({
  gridArea: 'list',
  maxHeight: '100%',
  overflowY: 'auto',
  borderRight: `1px solid ${theme.mixer(0.125)}`,
  marginLeft: -30,
}));

const Separator = styled.div(({ theme }) => ({
  margin: '5px 30px',
  height: 1,
  background: theme.mixer(0.125),
}));

const mapStateToProps = state => {
  const {
    addressBook,
    ui: {
      addressBook: { searchQuery },
    },
  } = state;
  return {
    addressBook,
    searchQuery,
    coreConnected: isCoreConnected(state),
  };
};

/**
 * List of contacts
 *
 * @class ContactList
 * @extends {Component}
 */
@connect(mapStateToProps)
class ContactList extends React.Component {
  createContact = () => {
    openModal(AddEditContactModal);
  };

  /**
   * Component's Renderable JSX
   *
   * @returns {JSX}
   * @memberof ContactList
   */
  render() {
    const { addressBook, searchQuery, coreConnected } = this.props;

    return (
      <ContactListComponent>
        {Object.values(addressBook).map(contact =>
          contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          contact.addresses.find(({ address }) => address === searchQuery) ? (
            <Contact key={contact.name} contact={contact} />
          ) : null
        )}
        {coreConnected && (
          <>
            <Separator />
            <NewContactButton onClick={this.createContact} />
          </>
        )}
      </ContactListComponent>
    );
  }
}

export default ContactList;
