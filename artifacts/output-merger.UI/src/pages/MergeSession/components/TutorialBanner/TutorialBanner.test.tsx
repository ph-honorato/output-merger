import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { ThemeProvider as StyledThemeProvider } from 'styled-components';
import { I18nextProvider } from 'react-i18next';
import { i18n, enUS, ptBR } from '@translation';
import { theme } from '@theme';
import TutorialBanner from './TutorialBanner';

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <I18nextProvider i18n={i18n}>
      <MuiThemeProvider theme={theme}>
        <StyledThemeProvider theme={theme}>
          {component}
        </StyledThemeProvider>
      </MuiThemeProvider>
    </I18nextProvider>
  );
};

const TUTORIAL_KEYS = [
  'pages.mergeSession.tutorial.title',
  'pages.mergeSession.tutorial.step1',
  'pages.mergeSession.tutorial.step2',
  'pages.mergeSession.tutorial.step3',
  'pages.mergeSession.tutorial.step4',
  'pages.mergeSession.tutorial.step5',
  'pages.mergeSession.tutorial.dismiss',
  'pages.mergeSession.tutorial.help',
] as const;

afterEach(async () => {
  await i18n.changeLanguage('en-US');
});

describe('TutorialBanner Component', () => {
  it('renders the title and the five numbered steps', () => {
    const onDismiss = vi.fn();
    renderWithProviders(<TutorialBanner onDismiss={onDismiss} />);

    const banner = screen.getByTestId('merge-session-tutorial');
    expect(screen.getByText('How it works')).toBeInTheDocument();
    const steps = banner.querySelectorAll('ol li');
    expect(steps).toHaveLength(5);
    expect(steps[0]).toHaveTextContent(
      'Type or paste your texts into the input fields.'
    );
    expect(steps[1]).toHaveTextContent(
      'Click "Start Merge" to lock your texts and start selecting.'
    );
    expect(steps[2]).toHaveTextContent(
      'Drag the handles that appear over the words boundaries to create snippets.'
    );
    expect(steps[3]).toHaveTextContent(
      'Your created snippets will appear in the preview area.'
    );
    expect(steps[4]).toHaveTextContent(
      'You can sort snippets by dragging, edit and then copy the merged text when you are done.'
    );
  });

  it('calls onDismiss when the dismiss button is clicked', async () => {
    const onDismiss = vi.fn();
    renderWithProviders(<TutorialBanner onDismiss={onDismiss} />);
    const user = userEvent.setup();

    const dismissButton = screen.getByTestId('tutorial-dismiss-button');
    expect(dismissButton).toHaveAttribute('aria-label', 'Dismiss tutorial');
    await user.click(dismissButton);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('ships all tutorial keys in both en-US and pt-BR resources', () => {
    TUTORIAL_KEYS.forEach((key) => {
      expect(enUS).toHaveProperty(key);
      expect(ptBR).toHaveProperty(key);
    });
    expect(enUS).toHaveProperty(
      'pages.mergeSession.tutorial.step3',
      'Drag the handles that appear over the words boundaries to create snippets.',
    );
    expect(enUS).toHaveProperty(
      'pages.mergeSession.tutorial.step4',
      'Your created snippets will appear in the preview area.',
    );
    expect(enUS).toHaveProperty(
      'pages.mergeSession.tutorial.step5',
      'You can sort snippets by dragging, edit and then copy the merged text when you are done.',
    );
    expect(ptBR).toHaveProperty(
      'pages.mergeSession.tutorial.step3',
      'Arraste os marcadores que aparecem sobre os limites das palavras para criar trechos.',
    );
    expect(ptBR).toHaveProperty(
      'pages.mergeSession.tutorial.step4',
      'Seus trechos criados aparecerão na área de prévia.',
    );
    expect(ptBR).toHaveProperty(
      'pages.mergeSession.tutorial.step5',
      'Você pode ordenar trechos arrastando, editar e então copiar o texto mesclado quando terminar.',
    );
  });

  it('updates all texts when the language changes', async () => {
    renderWithProviders(<TutorialBanner onDismiss={vi.fn()} />);

    await act(async () => {
      await i18n.changeLanguage('pt');
    });

    expect(screen.getByText('Como funciona')).toBeInTheDocument();
    expect(screen.queryByText('How it works')).toBeNull();
    const ptSteps = screen.getByTestId('merge-session-tutorial').querySelectorAll('ol li');
    expect(ptSteps).toHaveLength(5);
    expect(ptSteps[2]).toHaveTextContent('Arraste os marcadores que aparecem sobre os limites das palavras para criar trechos.');
    expect(ptSteps[3]).toHaveTextContent('Seus trechos criados aparecerão na área de prévia.');
    expect(ptSteps[4]).toHaveTextContent('Você pode ordenar trechos arrastando, editar e então copiar o texto mesclado quando terminar.');

    await act(async () => {
      await i18n.changeLanguage('en-US');
    });

    expect(screen.getByText('How it works')).toBeInTheDocument();
    const enSteps = screen.getByTestId('merge-session-tutorial').querySelectorAll('ol li');
    expect(enSteps).toHaveLength(5);
    expect(enSteps[2]).toHaveTextContent('Drag the handles that appear over the words boundaries to create snippets.');
    expect(enSteps[3]).toHaveTextContent('Your created snippets will appear in the preview area.');
    expect(enSteps[4]).toHaveTextContent('You can sort snippets by dragging, edit and then copy the merged text when you are done.');
  });
});