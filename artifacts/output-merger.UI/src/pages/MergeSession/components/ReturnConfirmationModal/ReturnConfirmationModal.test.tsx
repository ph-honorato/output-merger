import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { ThemeProvider as StyledThemeProvider } from 'styled-components';
import { I18nextProvider } from 'react-i18next';
import { i18n } from '@translation';
import { theme } from '@theme';
import ReturnConfirmationModal from './ReturnConfirmationModal';

const renderModal = (open: boolean) => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const view = render(
    <I18nextProvider i18n={i18n}>
      <MuiThemeProvider theme={theme}>
        <StyledThemeProvider theme={theme}>
          <ReturnConfirmationModal
            open={open}
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
        </StyledThemeProvider>
      </MuiThemeProvider>
    </I18nextProvider>,
  );
  return { ...view, onConfirm, onCancel };
};

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ReturnConfirmationModal', () => {
  it('renders nothing while closed', () => {
    renderModal(false);

    expect(screen.queryByTestId('return-confirmation-dialog')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders the five approved strings with an unchecked checkbox while open', () => {
    renderModal(true);

    const dialog = screen.getByTestId('return-confirmation-dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('dialog')).toBeInTheDocument();
    expect(
      within(dialog).getByText('Return to inputs?'),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        'This will remove all selected snippets from the inputs. Your actual inputs and preview texts are kept as plain texts.',
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("Don't show this again"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByTestId('return-confirmation-confirm-button'),
    ).toHaveTextContent('Return');
    expect(
      within(dialog).getByTestId('return-confirmation-cancel-button'),
    ).toHaveTextContent('Cancel');
    expect(within(dialog).getByTestId('return-confirmation-checkbox')).toBeInTheDocument();
    expect(within(dialog).getByRole('checkbox')).not.toBeChecked();
  });

  it('Confirm reports the unchecked checkbox flag and never cancels', async () => {
    const { onConfirm, onCancel } = renderModal(true);
    const user = userEvent.setup();

    await user.click(screen.getByTestId('return-confirmation-confirm-button'));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(false);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('Confirm reports the checked checkbox flag once the box is toggled', async () => {
    const { onConfirm } = renderModal(true);
    const user = userEvent.setup();

    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('checkbox')).toBeChecked();

    await user.click(screen.getByTestId('return-confirmation-confirm-button'));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(true);
  });

  it('starts the checkbox unchecked on every reopen', async () => {
    const { rerender, onCancel } = renderModal(true);
    const user = userEvent.setup();

    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('checkbox')).toBeChecked();
    await user.click(screen.getByTestId('return-confirmation-cancel-button'));
    expect(onCancel).toHaveBeenCalledTimes(1);

    rerender(
      <I18nextProvider i18n={i18n}>
        <MuiThemeProvider theme={theme}>
          <StyledThemeProvider theme={theme}>
            <ReturnConfirmationModal
              open={false}
              onConfirm={vi.fn()}
              onCancel={onCancel}
            />
          </StyledThemeProvider>
        </MuiThemeProvider>
      </I18nextProvider>,
    );

    rerender(
      <I18nextProvider i18n={i18n}>
        <MuiThemeProvider theme={theme}>
          <StyledThemeProvider theme={theme}>
            <ReturnConfirmationModal
              open={true}
              onConfirm={vi.fn()}
              onCancel={onCancel}
            />
          </StyledThemeProvider>
        </MuiThemeProvider>
      </I18nextProvider>,
    );

    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('Cancel reports cancellation without confirming', async () => {
    const { onConfirm, onCancel } = renderModal(true);
    const user = userEvent.setup();

    await user.click(screen.getByTestId('return-confirmation-cancel-button'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('funnels a backdrop click into Cancel', () => {
    const { onConfirm, onCancel } = renderModal(true);

    // The dialog's container fills the viewport around the paper:
    // a mousedown + click on it is the backdrop click.
    const container = document.querySelector('.MuiDialog-container');
    expect(container).not.toBeNull();
    fireEvent.mouseDown(container!);
    fireEvent.click(container!);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('funnels the Escape key into Cancel', () => {
    const { onConfirm, onCancel } = renderModal(true);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
