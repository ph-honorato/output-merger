import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { ThemeProvider as StyledThemeProvider } from 'styled-components';
import { I18nextProvider } from 'react-i18next';
import { i18n } from '@translation';
import { theme } from '../../theme';
import MergeSessionPage from './MergeSessionPage';

const renderPage = () =>
  render(
    <I18nextProvider i18n={i18n}>
      <MuiThemeProvider theme={theme}>
        <StyledThemeProvider theme={theme}>
          <MergeSessionPage />
        </StyledThemeProvider>
      </MuiThemeProvider>
    </I18nextProvider>
  );

describe('MergeSessionPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders both sources in input mode with a disabled start button', () => {
    renderPage();

    expect(screen.getAllByTestId('text-input-textarea')).toHaveLength(2);
    expect(screen.getByTestId('merge-session-start-button')).toBeDisabled();
  });

  it('enables the start button once a source has text', async () => {
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getAllByTestId('text-input-textarea')[0], 'Hello world');

    expect(screen.getByTestId('merge-session-start-button')).toBeEnabled();
  });

  it('does not enable the start button for whitespace-only text', async () => {
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getAllByTestId('text-input-textarea')[0], '   ');

    expect(screen.getByTestId('merge-session-start-button')).toBeDisabled();
  });

  it('enters merge mode on click: button hidden, sources in view mode, text preserved', async () => {
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getAllByTestId('text-input-textarea')[0], 'Hello world');
    await user.click(screen.getByTestId('merge-session-start-button'));

    expect(screen.queryByTestId('merge-session-start-button')).toBeNull();
    expect(screen.queryByTestId('text-input-textarea')).toBeNull();
    expect(screen.getByTestId('text-input-view')).toHaveTextContent('Hello world');
    expect(screen.getByTestId('text-input-empty')).toBeInTheDocument();
    expect(screen.getByTestId('actions-bar-root')).toBeInTheDocument();
    expect(screen.getByTestId('preview-area')).toBeInTheDocument();
  });

  it('runs the full tutorial lifecycle: render, dismiss, persist, reopen via help, re-dismiss', async () => {
    const { unmount } = renderPage();
    const user = userEvent.setup();

    const banner = screen.getByTestId('merge-session-tutorial');
    expect(banner).toBeInTheDocument();
    expect(screen.getByText('How it works')).toBeInTheDocument();
    expect(banner.querySelectorAll('ol li')).toHaveLength(4);
    expect(screen.queryByTestId('merge-session-help-button')).toBeNull();

    await user.click(screen.getByTestId('tutorial-dismiss-button'));

    expect(screen.queryByTestId('merge-session-tutorial')).toBeNull();
    expect(
      window.localStorage.getItem('output-merger.tutorial.dismissed')
    ).toBe('true');
    expect(screen.getByTestId('merge-session-help-button')).toBeInTheDocument();

    unmount();
    renderPage();

    expect(screen.queryByTestId('merge-session-tutorial')).toBeNull();
    expect(screen.getByTestId('merge-session-help-button')).toBeInTheDocument();

    await user.click(screen.getByTestId('merge-session-help-button'));

    expect(screen.getByTestId('merge-session-tutorial')).toBeInTheDocument();
    expect(screen.queryByTestId('merge-session-help-button')).toBeNull();

    await user.click(screen.getByTestId('tutorial-dismiss-button'));

    expect(screen.queryByTestId('merge-session-tutorial')).toBeNull();
    expect(
      window.localStorage.getItem('output-merger.tutorial.dismissed')
    ).toBe('true');
    expect(screen.getByTestId('merge-session-help-button')).toBeInTheDocument();
  });

  it('treats a throwing localStorage as not dismissed and never crashes', async () => {
    const localStorageSpy = vi
      .spyOn(window, 'localStorage', 'get')
      .mockImplementation(() => {
        throw new Error('storage denied');
      });
    const { unmount } = renderPage();
    const user = userEvent.setup();

    expect(screen.getByTestId('merge-session-tutorial')).toBeInTheDocument();

    await user.click(screen.getByTestId('tutorial-dismiss-button'));

    expect(screen.queryByTestId('merge-session-tutorial')).toBeNull();

    unmount();
    renderPage();

    expect(screen.getByTestId('merge-session-tutorial')).toBeInTheDocument();

    localStorageSpy.mockRestore();
  });
});
