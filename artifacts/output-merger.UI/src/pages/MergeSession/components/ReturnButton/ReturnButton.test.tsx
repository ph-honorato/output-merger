import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { ThemeProvider as StyledThemeProvider } from 'styled-components';
import { I18nextProvider } from 'react-i18next';
import { i18n } from '@translation';
import { theme } from '@theme';
import { RETURN_CONFIRMATION_DISMISSED_STORAGE_KEY } from './ReturnButton.hook';
import ReturnButton from './ReturnButton';

const renderButton = () => {
  const onConfirm = vi.fn();
  render(
    <I18nextProvider i18n={i18n}>
      <MuiThemeProvider theme={theme}>
        <StyledThemeProvider theme={theme}>
          <ReturnButton onConfirm={onConfirm} />
        </StyledThemeProvider>
      </MuiThemeProvider>
    </I18nextProvider>,
  );
  return { onConfirm };
};

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ReturnButton', () => {
  it('renders the contained button with the icon and label, and opens the dialog on click (disabled while open)', async () => {
    const { onConfirm } = renderButton();
    const user = userEvent.setup();

    const button = screen.getByTestId('merge-session-return-button');
    expect(button).toBeEnabled();
    expect(button).toHaveTextContent('Return');
    expect(button.querySelector('svg')).toBeInTheDocument();

    await user.click(button);

    expect(
      screen.getByTestId('return-confirmation-dialog'),
    ).toBeInTheDocument();
    expect(button).toBeDisabled();

    // Confirming without the checkbox proceeds and persists nothing.
    await user.click(
      within(screen.getByTestId('return-confirmation-dialog')).getByTestId(
        'return-confirmation-confirm-button',
      ),
    );

    await waitFor(() =>
      expect(screen.queryByTestId('return-confirmation-dialog')).toBeNull(),
    );
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(RETURN_CONFIRMATION_DISMISSED_STORAGE_KEY)).toBeNull();
  });

  it('persists the preference when confirmed with the checkbox checked', async () => {
    const { onConfirm } = renderButton();
    const user = userEvent.setup();

    await user.click(screen.getByTestId('merge-session-return-button'));
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByTestId('return-confirmation-confirm-button'));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(
      window.localStorage.getItem(RETURN_CONFIRMATION_DISMISSED_STORAGE_KEY),
    ).toBe('true');
  });

  it('proceeds immediately with no dialog when the preference is stored (read at click time)', async () => {
    const { onConfirm } = renderButton();
    const user = userEvent.setup();

    // Stored after mount: the click reads the preference at click
    // time, so a mid-session storage change takes effect.
    window.localStorage.setItem(
      RETURN_CONFIRMATION_DISMISSED_STORAGE_KEY,
      'true',
    );

    await user.click(screen.getByTestId('merge-session-return-button'));

    expect(screen.queryByTestId('return-confirmation-dialog')).toBeNull();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('closes without confirming or persisting on Cancel', async () => {
    const { onConfirm } = renderButton();
    const user = userEvent.setup();

    await user.click(screen.getByTestId('merge-session-return-button'));
    await user.click(
      within(screen.getByTestId('return-confirmation-dialog')).getByTestId(
        'return-confirmation-cancel-button',
      ),
    );

    await waitFor(() =>
      expect(screen.queryByTestId('return-confirmation-dialog')).toBeNull(),
    );
    expect(onConfirm).not.toHaveBeenCalled();
    expect(
      window.localStorage.getItem(RETURN_CONFIRMATION_DISMISSED_STORAGE_KEY),
    ).toBeNull();
    expect(screen.getByTestId('merge-session-return-button')).toBeEnabled();
  });

  it('keeps the dialog working when localStorage throws', async () => {
    const localStorageSpy = vi
      .spyOn(window, 'localStorage', 'get')
      .mockImplementation(() => {
        throw new Error('storage denied');
      });
    const { onConfirm } = renderButton();
    const user = userEvent.setup();

    await user.click(screen.getByTestId('merge-session-return-button'));

    // The throwing read reads as not dismissed: the dialog opens.
    expect(
      screen.getByTestId('return-confirmation-dialog'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByTestId('return-confirmation-confirm-button'));

    // The swallowed write keeps the flow alive; the return proceeds.
    expect(onConfirm).toHaveBeenCalledTimes(1);

    localStorageSpy.mockRestore();
  });
});
