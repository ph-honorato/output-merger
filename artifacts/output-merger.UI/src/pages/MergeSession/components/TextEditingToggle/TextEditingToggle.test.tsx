import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { ThemeProvider as StyledThemeProvider } from 'styled-components';
import { I18nextProvider } from 'react-i18next';
import { i18n, enUS, ptBR } from '@translation';
import { theme } from '@theme';
import {
  SnippetsProvider,
  useSnippets,
} from '../../../../context/SnippetsContext';
import TextEditingToggle from './TextEditingToggle';

const TogglePair = () => (
  <>
    <TextEditingToggle />
    <TextEditingToggle />
  </>
);

const renderToggle = (ui = <TextEditingToggle />) =>
  render(
    <I18nextProvider i18n={i18n}>
      <MuiThemeProvider theme={theme}>
        <StyledThemeProvider theme={theme}>
          <SnippetsProvider>{ui}</SnippetsProvider>
        </StyledThemeProvider>
      </MuiThemeProvider>
    </I18nextProvider>,
  );

describe('TextEditingToggle', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en-US');
  });

  it('renders an icon-only toggle button with the Title icon and the edit-toggle testid', () => {
    renderToggle();
    const button = screen.getByTestId('preview-edit-toggle');
    expect(button).toBeInTheDocument();
    expect(button.querySelector('svg')).not.toBeNull();
    expect(button.textContent).toBe('');
  });

  it('defaults to off: aria-pressed false and the enabling label', () => {
    renderToggle();
    const button = screen.getByTestId('preview-edit-toggle');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveAttribute('aria-label', 'Enable text editing');
  });

  it('flips the shared edit state and both label and pressed state on click', () => {
    renderToggle();
    const button = screen.getByTestId('preview-edit-toggle');

    fireEvent.click(button);

    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveAttribute('aria-label', 'Disable text editing');

    fireEvent.click(button);

    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveAttribute('aria-label', 'Enable text editing');
  });

  it('is idempotent: pressing the same state again keeps it', () => {
    renderToggle();
    const button = screen.getByTestId('preview-edit-toggle');
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('shares ONE session state: clicking either instance updates the other', () => {
    renderToggle(<TogglePair />);
    const [first, second] = screen.getAllByTestId('preview-edit-toggle');
    expect(first).toHaveAttribute('aria-pressed', 'false');
    expect(second).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(first);

    expect(first).toHaveAttribute('aria-pressed', 'true');
    expect(second).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(second);

    expect(first).toHaveAttribute('aria-pressed', 'false');
    expect(second).toHaveAttribute('aria-pressed', 'false');
  });

  it('drives the context editEnabled flag directly', () => {
    const Probe = () => {
      const { editEnabled } = useSnippets();
      return <span data-testid="edit-enabled-probe">{String(editEnabled)}</span>;
    };
    renderToggle(
      <>
        <TextEditingToggle />
        <Probe />
      </>,
    );
    expect(screen.getByTestId('edit-enabled-probe')).toHaveTextContent('false');
    fireEvent.click(screen.getByTestId('preview-edit-toggle'));
    expect(screen.getByTestId('edit-enabled-probe')).toHaveTextContent('true');
  });

  it('ships the four editing keys verbatim in both en-US and pt-BR resources', () => {
    expect(enUS).toHaveProperty(
      'pages.mergeSession.previewArea.editing.label',
      'Merged text editor',
    );
    expect(enUS).toHaveProperty(
      'pages.mergeSession.previewArea.editing.placeholder',
      'Type here to add your own text',
    );
    expect(enUS).toHaveProperty(
      'pages.mergeSession.previewArea.editing.toggleOn',
      'Enable text editing',
    );
    expect(enUS).toHaveProperty(
      'pages.mergeSession.previewArea.editing.toggleOff',
      'Disable text editing',
    );
    expect(ptBR).toHaveProperty(
      'pages.mergeSession.previewArea.editing.label',
      'Editor de texto mesclado',
    );
    expect(ptBR).toHaveProperty(
      'pages.mergeSession.previewArea.editing.placeholder',
      'Digite aqui para adicionar seu próprio texto',
    );
    expect(ptBR).toHaveProperty(
      'pages.mergeSession.previewArea.editing.toggleOn',
      'Ativar edição de texto',
    );
    expect(ptBR).toHaveProperty(
      'pages.mergeSession.previewArea.editing.toggleOff',
      'Desativar edição de texto',
    );
  });

  it('follows the active language for the labels', async () => {
    renderToggle();
    expect(screen.getByTestId('preview-edit-toggle')).toHaveAttribute(
      'aria-label',
      'Enable text editing',
    );

    fireEvent.click(screen.getByTestId('preview-edit-toggle'));
    expect(screen.getByTestId('preview-edit-toggle')).toHaveAttribute(
      'aria-label',
      'Disable text editing',
    );

    await i18n.changeLanguage('pt');
    expect(screen.getByTestId('preview-edit-toggle')).toHaveAttribute(
      'aria-label',
      'Desativar edição de texto',
    );

    fireEvent.click(screen.getByTestId('preview-edit-toggle'));
    expect(screen.getByTestId('preview-edit-toggle')).toHaveAttribute(
      'aria-label',
      'Ativar edição de texto',
    );
  });

  it('tints the pressed state through the aria-pressed styling', () => {
    renderToggle();
    const button = screen.getByTestId('preview-edit-toggle');
    const css = Array.from(document.querySelectorAll('style'))
      .map((style) => style.textContent)
      .join('');
    expect(css).toContain(`[aria-pressed='true']`);
    expect(css).toContain(theme.palette.action.selected);
    fireEvent.click(button);
    expect(button).toHaveStyle({ color: theme.palette.primary.main });
  });
});
