import React from 'react';
import { ipcRenderer } from 'electron';
import { ThemeProvider } from 'emotion-theming';
import Keyboard from 'react-simple-keyboard';
import styled from '@emotion/styled';

import GlobalStyles from 'components/GlobalStyles';
import TextField from 'components/TextField';
import MaskableTextField from 'components/MaskableTextField';
import { getMixer } from 'utils/color';

import KeyboardStyles from './KeyboardStyles';

const KeyboardWrapper = styled.div({
  padding: 5,
});

const InputWrapper = styled.div({
  padding: 5,
  columnGap: 5,
  alignItems: 'stretch',
});

export default class App extends React.Component {
  state = {
    options: null,
    text: '',
    capitalized: false,
  };

  constructor(props) {
    super(props);
    ipcRenderer.once('options', (evt, options) => {
      this.setState({ options });
    });
  }

  handleChange = text => {
    this.setState({ text });
    ipcRenderer.send('keyboard-input-change', text);
  };

  handleInputChange = e => {
    this.setState({ text: e.target.value });
  };

  render() {
    if (!this.state.options) return null;

    const {
      text,
      options: { theme, maskable, placeholder },
    } = this.state;
    const themeWithMixer = {
      ...theme,
      mixer: getMixer(theme.background, theme.foreground),
    };
    const Input = maskable ? MaskableTextField : TextField;

    return (
      <ThemeProvider theme={themeWithMixer}>
        <KeyboardWrapper>
          <GlobalStyles />
          <KeyboardStyles />

          <InputWrapper>
            <Input
              value={text}
              onChange={this.handleInputChange}
              placeholder={placeholder}
              skin="filled-inverted"
              style={{ borderRadius: 5, fontSize: 18 }}
            />
          </InputWrapper>

          <Keyboard
            display={{
              '{enter}': 'done',
            }}
            mergeDisplay
            buttonTheme={[
              {
                class: 'btn-submit',
                buttons: '{enter}',
              },
            ]}
            onChange={this.handleChange}
          />
        </KeyboardWrapper>
      </ThemeProvider>
    );
  }
}
