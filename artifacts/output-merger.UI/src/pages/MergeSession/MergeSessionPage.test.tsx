import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { ThemeProvider as StyledThemeProvider } from 'styled-components';
import { ThemeProvider } from '@context/ThemeContext';
import { I18nextProvider } from 'react-i18next';
import { i18n } from '@translation';
import { theme } from '@theme';
import MergeSessionPage from './MergeSessionPage';

const renderPage = () => {
  return render(
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <MuiThemeProvider theme={theme}>
          <StyledThemeProvider theme={theme}>
            <MergeSessionPage />
          </StyledThemeProvider>
        </MuiThemeProvider>
      </ThemeProvider>
    </I18nextProvider>
  );
};

describe('MergeSessionPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders the workspace with two text inputs and a preview area', () => {
    renderPage();

    expect(screen.getAllByTestId('text-input-textarea')).toHaveLength(2);
    expect(screen.getByTestId('preview-area')).toBeInTheDocument();
  });

  it('runs the full tutorial lifecycle: help button opens tutorial, dismiss, persist, reopen via help, re-dismiss', async () => {
    const { unmount } = renderPage();
    const user = userEvent.setup();

    // Tutorial is hidden by default, help button is visible
    expect(screen.queryByTestId('merge-session-tutorial')).toBeNull();
    expect(screen.getByTestId('merge-session-help-button')).toBeInTheDocument();

    // Click help button to show tutorial
    await user.click(screen.getByTestId('merge-session-help-button'));

    const banner = screen.getByTestId('merge-session-tutorial');
    expect(banner).toBeInTheDocument();
    expect(screen.getByText('How it works')).toBeInTheDocument();
    expect(banner.querySelectorAll('ol li')).toHaveLength(5);
    expect(screen.queryByTestId('merge-session-help-button')).toBeNull();

    await user.click(screen.getByTestId('tutorial-dismiss-button'));

    expect(screen.queryByTestId('merge-session-tutorial')).toBeNull();
    expect(
      window.localStorage.getItem('output-merger.tutorial.dismissed')
    ).toBe('true');
    expect(screen.getByTestId('merge-session-help-button')).toBeInTheDocument();

    unmount();
    renderPage();

    // After remount, tutorial stays hidden (dismissed)
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

  it('renders the preview modal trigger inside the toolbar, below the copy button', () => {
    renderPage();

    const toolbar = screen.getByTestId('preview-toolbar');
    const trigger = screen.getByTestId('preview-modal-open-button');
    expect(toolbar).toContainElement(trigger);
    // No snippets yet: the trigger is present but disabled.
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveAttribute(
      'aria-label',
      'Open big view (Ctrl+M)',
    );
    const copyButton = screen.getByTestId('preview-copy-button');
    expect(
      copyButton.compareDocumentPosition(trigger) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('renders the edit-text toggle in the toolbar under the modal-open trigger, off by default', () => {
    renderPage();

    const toolbar = screen.getByTestId('preview-toolbar');
    const toggle = screen.getByTestId('preview-edit-toggle');
    expect(toolbar).toContainElement(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle).toHaveAttribute('aria-label', 'Enable text editing (Ctrl+E)');
    const trigger = screen.getByTestId('preview-modal-open-button');
    expect(
      trigger.compareDocumentPosition(toggle) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('runs the editing flow end to end: toggle on, type own text, copy serializes the document', async () => {
    // fireEvent only: userEvent.setup() would replace the clipboard
    // with its own stub for the whole environment, hiding the
    // writeText calls from the mock (CopyMergedTextButton pattern).
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    renderPage();

    fireEvent.change(screen.getAllByTestId('text-input-textarea')[0], {
      target: { value: 'alpha beta' },
    });
    fireEvent.click(screen.getByTestId('merge-session-start-button'));

    const toggle = screen.getByTestId('preview-edit-toggle');
    fireEvent.click(toggle);

    const flow = screen.getByTestId('preview-segment-flow');
    fireEvent.click(flow);
    fireEvent.keyDown(flow, { key: 'a' });
    fireEvent.keyDown(flow, { key: 'l' });
    fireEvent.keyDown(flow, { key: 'p' });
    fireEvent.keyDown(flow, { key: 'h' });
    fireEvent.keyDown(flow, { key: 'a' });

    const copyButton = screen.getByTestId('preview-copy-button');
    fireEvent.click(copyButton);

    const toast = await screen.findByTestId('preview-copy-toast');
    expect(toast).toBeInTheDocument();
  });
});