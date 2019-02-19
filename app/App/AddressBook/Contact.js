// External
import React from 'react';
import { connect } from 'react-redux';
import styled from '@emotion/styled';

// Internal Global
import { selectContact } from 'actions/addressbookActionCreators';
import Icon from 'components/Icon';
import Text from 'components/Text';
import { timing } from 'styles';
import { color } from 'utils';
import plusIcon from 'images/plus.sprite.svg';

const ContactComponent = styled.div(
  ({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    padding: '.4em 30px',
    transitionProperty: 'background, color',
    transitionDuration: timing.normal,
    cursor: 'pointer',

    '&:hover': {
      background: theme.mixer(0.125),
    },
  }),
  ({ active, theme }) =>
    active && {
      '&, &:hover': {
        background: color.fade(theme.primary, 0.3),
        color: theme.primaryAccent,
      },
    }
);

const ContactAvatar = styled.div(({ theme }) => ({
  width: '2em',
  height: '2em',
  borderRadius: '50%',
  background: theme.mixer(0.25),
  color: theme.foreground,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  flexShrink: 0,
  marginRight: '1em',
}));

const ContactName = styled.div({
  flexGrow: 1,
  wordBreak: 'break-word',
});

/**
 * Contact Item
 *
 * @class Contact
 * @extends {PureComponent}
 */
@connect(
  state => ({
    activeIndex: state.addressbook.selectedContactIndex,
  }),
  { selectContact }
)
class Contact extends React.PureComponent {
  /**
   * Get the contact's initial
   *
   * @param {*} name
   * @returns
   * @memberof Contact
   */
  getinitial = name => (name && name.length >= 1 ? name.charAt(0) : '');

  select = () => {
    this.props.selectContact(this.props.index);
  };

  /**
   * render
   *
   * @returns
   * @memberof Contact
   */
  render() {
    const { contact, index, activeIndex } = this.props;

    return (
      <ContactComponent onClick={this.select} active={index === activeIndex}>
        <ContactAvatar>{this.getinitial(contact.name)}</ContactAvatar>
        <ContactName>{contact.name}</ContactName>
      </ContactComponent>
    );
  }
}

export default Contact;

const NewContactButton = props => (
  <ContactComponent {...props}>
    <ContactAvatar>
      <Icon icon={plusIcon} style={{ fontSize: '.8em', opacity: 0.7 }} />
    </ContactAvatar>
    <ContactName style={{ opacity: 0.7 }}>
      <Text id="AddressBook.NewContact" />
    </ContactName>
  </ContactComponent>
);

export { NewContactButton };
